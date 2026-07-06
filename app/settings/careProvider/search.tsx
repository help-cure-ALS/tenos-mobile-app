import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { Stack } from 'expo-router';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { Badge, List } from 'react-native-nice-ui';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { useFhirRepo } from '@/src/hooks/useFhirRepo';
import { getCountryByCode } from '@/src/components/ui/CountryPicker';
import { getCurrentLanguage } from '@/src/i18n';
import { on, emit } from '@/src/lib/bus';
import { useActivePatientId, useAppRole } from '@/src/context/AppRoleProvider';
import { useTranslation } from 'react-i18next';
import * as Crypto from 'expo-crypto';
import type { FhirPractitioner, FhirOrganization } from './index';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { FilterChip } from '@/src/components/ui/FilterChip';
import { getCareClient } from '@/src/studies/careClient';
import type { Organization, Practitioner } from '@medplum/fhirtypes';
import { CloseButton } from "@/src/components/ui/navigation/CloseButton";

type ProviderItem = {
    id: string;
    type: 'practitioner' | 'organization';
    name: string;
    specialty?: string;
    phone?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country: string;
};

function organizationToProvider(org: Organization): ProviderItem {
    const addr = org.address?.[0];
    const phone = org.telecom?.find(t => t.system === 'phone')?.value;
    const specialty = org.type?.[0]?.coding?.[0]?.display || org.type?.[0]?.text;

    return {
        id: org.id || Crypto.randomUUID(),
        type: 'organization',
        name: org.name || 'Unknown',
        specialty,
        phone,
        address: addr?.line?.[0],
        city: addr?.city,
        postalCode: addr?.postalCode,
        country: addr?.country || '',
    };
}

function practitionerToProvider(prac: Practitioner): ProviderItem {
    const addr = prac.address?.[0];
    const phone = prac.telecom?.find(t => t.system === 'phone')?.value;
    const specialty = prac.qualification?.[0]?.code?.coding?.[0]?.display
        || prac.qualification?.[0]?.code?.text;
    const name = prac.name?.[0]?.text
        || [prac.name?.[0]?.given?.join(' '), prac.name?.[0]?.family].filter(Boolean).join(' ')
        || 'Unknown';

    return {
        id: prac.id || Crypto.randomUUID(),
        type: 'practitioner',
        name,
        specialty,
        phone,
        address: addr?.line?.[0],
        city: addr?.city,
        postalCode: addr?.postalCode,
        country: addr?.country || '',
    };
}

function getProviderIcon(type: 'practitioner' | 'organization'): string {
    return type === 'practitioner' ? 'person' : 'building.2';
}

function nowIso() {
    return new Date().toISOString();
}

function providerToPractitioner(provider: ProviderItem): FhirPractitioner {
    const nameParts = provider.name.split(' ');
    const family = nameParts.pop() || '';
    const given = nameParts;

    return {
        resourceType: 'Practitioner',
        id: Crypto.randomUUID(),
        name: [{ text: provider.name, family, given }],
        telecom: provider.phone ? [{ system: 'phone', value: provider.phone }] : undefined,
        address: [{
            line: provider.address ? [provider.address] : undefined,
            city: provider.city,
            postalCode: provider.postalCode,
            country: provider.country
        }],
        qualification: provider.specialty ? [{ code: { text: provider.specialty } }] : undefined,
        meta: { lastUpdated: nowIso() }
    };
}

function providerToOrganization(provider: ProviderItem): FhirOrganization {
    return {
        resourceType: 'Organization',
        id: Crypto.randomUUID(),
        name: provider.name,
        type: provider.specialty ? [{ text: provider.specialty }] : undefined,
        telecom: provider.phone ? [{ system: 'phone', value: provider.phone }] : undefined,
        address: [{
            line: provider.address ? [provider.address] : undefined,
            city: provider.city,
            postalCode: provider.postalCode,
            country: provider.country
        }],
        meta: { lastUpdated: nowIso() }
    };
}


// Cache for fetched providers per country
const providerCache = new Map<string, ProviderItem[]>();

export default function CareProviderSearchScreen() {
    const { colors } = useAppTheme();
    const { syncEnabled, fullSync } = useAppSync();
    const fhirRepo = useFhirRepo();
    const router = useSafeRouter();
    const patientId = useActivePatientId();
    const { isDemo } = useAppRole();
    const { t } = useTranslation();

    const fhirRepoRef = useRef(fhirRepo);
    fhirRepoRef.current = fhirRepo;
    const syncEnabledRef = useRef(syncEnabled);
    syncEnabledRef.current = syncEnabled;
    const fullSyncRef = useRef(fullSync);
    fullSyncRef.current = fullSync;

    const [selectedCountry, setSelectedCountry] = useState('DE');
    const [searchQuery, setSearchQuery] = useState('');
    const [existingNames, setExistingNames] = useState<Set<string>>(new Set());
    const [providers, setProviders] = useState<ProviderItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const pickerOpenedFromHere = useRef(false);

    // Load names of already-added providers to prevent duplicates
    useEffect(() => {
        (async () => {
            const names = new Set<string>();
            const practitioners = await fhirRepoRef.current.list('Practitioner');
            for (const row of practitioners) {
                if (!row.deleted) {
                    const p = row.resource as FhirPractitioner;
                    const name = p.name?.[0]?.text;
                    if (name) names.add(name);
                }
            }
            const organizations = await fhirRepoRef.current.list('Organization');
            for (const row of organizations) {
                if (!row.deleted) {
                    const o = row.resource as FhirOrganization;
                    if (o.name) names.add(o.name);
                }
            }
            setExistingNames(names);
        })();
    }, []);

    // Load country from patient on mount
    useEffect(() => {
        if (!patientId) return;
        fhirRepoRef.current.get('Patient', patientId).then(row => {
            const country = (row?.resource as any)?.address?.[0]?.country;
            if (country) setSelectedCountry(country);
        });
    }, [patientId]);

    // Fetch providers from Medplum when country changes
    useEffect(() => {
        let cancelled = false;

        async function fetchProviders() {
            // Check cache first
            if (providerCache.has(selectedCountry)) {
                setProviders(providerCache.get(selectedCountry)!);
                return;
            }

            setIsLoading(true);
            try {
                const client = await getCareClient();

                // Fetch organizations and practitioners in parallel
                const [orgs, pracs] = await Promise.all([
                    client.searchResources('Organization', {
                        'address-country': selectedCountry,
                        _count: '500',
                        _sort: 'name',
                    }),
                    client.searchResources('Practitioner', {
                        'address-country': selectedCountry,
                        _count: '500',
                        _sort: 'name',
                    }),
                ]);

                if (cancelled) return;

                const items: ProviderItem[] = [
                    ...orgs.map(organizationToProvider),
                    ...pracs.map(practitionerToProvider),
                ];

                providerCache.set(selectedCountry, items);
                setProviders(items);
            } catch (e) {
                console.error('Failed to fetch providers:', e);
                if (!cancelled) setProviders([]);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        }

        fetchProviders();
        return () => { cancelled = true; };
    }, [selectedCountry]);

    // Listen for country selection
    useEffect(() => {
        const unsubscribe = on('country:selected', async (code: string) => {
            if (!pickerOpenedFromHere.current) return;
            pickerOpenedFromHere.current = false;

            setSelectedCountry(code);

            if (!patientId) return;
            const row = await fhirRepoRef.current.get('Patient', patientId);
            const now = new Date().toISOString();

            const patient = row?.resource
                ? { ...row.resource } as any
                : { resourceType: 'Patient', id: patientId };
            patient.address = [{ ...patient.address?.[0], country: code }];
            patient.meta = { ...patient.meta, lastUpdated: now };

            await fhirRepoRef.current.upsert('Patient', patientId, patient, patient.meta.lastUpdated);
            emit('fhir:changed');

            if (syncEnabledRef.current) {
                await fullSyncRef.current('country update');
            }
        });
        return () => unsubscribe();
    }, [patientId]);

    // Live filtering (client-side on already-fetched data)
    const filteredProviders = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return providers;
        return providers.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.specialty?.toLowerCase().includes(query) ||
            p.city?.toLowerCase().includes(query)
        );
    }, [providers, searchQuery]);

    const handleSelectCountry = useCallback(() => {
        pickerOpenedFromHere.current = true;
        router.push({
            pathname: '/settings/profile/countryPicker',
            params: { selected: selectedCountry, prioritizeForLanguage: getCurrentLanguage() }
        });
    }, [selectedCountry]);

    const handleAddProvider = useCallback(async (provider: ProviderItem) => {
        try {
            if (provider.type === 'practitioner') {
                const practitioner = providerToPractitioner(provider);
                await fhirRepo.upsert('Practitioner', practitioner.id, practitioner, practitioner.meta?.lastUpdated);
            } else {
                const organization = providerToOrganization(provider);
                await fhirRepo.upsert('Organization', organization.id, organization, organization.meta?.lastUpdated);
            }

            setExistingNames(prev => new Set(prev).add(provider.name));

            if (syncEnabled) {
                await fullSync('care provider add');
            }

            router.back();
        }
        catch (e: any) {
            console.error('Failed to add provider:', e);
        }
    }, [fhirRepo, syncEnabled, fullSync]);

    const handleAddCustom = useCallback(() => {
        if (isDemo) {
            Alert.alert(t('common.demoModeTitle'), t('common.demoModeMessage'), [{ text: t('common.ok') }]);
            return;
        }
        router.push({
            pathname: '/settings/careProvider/add',
            params: { country: selectedCountry }
        });
    }, [selectedCountry, isDemo, t]);

    const country = getCountryByCode(selectedCountry);
    const countryChipLabel = country ? country.name : selectedCountry;

    return (
        <>
            {
                Platform.OS === 'android' ? (
                    <Stack.Screen
                        options={ {
                            headerTransparent: false,
                            headerBackVisible: false,
                            headerSearchBarOptions: {
                                placeholder: 'Name, Fachrichtung oder Stadt',
                                onChangeText: (e) => setSearchQuery(e.nativeEvent.text),
                                autoCapitalize: 'none'
                            },
                            headerRight: () => (
                                <CloseButton onPress={ () => router.back() } />
                            )
                        } }
                    />
                ) : (
                    <>
                        <Stack.Screen
                            options={ {
                                headerSearchBarOptions: {
                                    placeholder: 'Name, Fachrichtung oder Stadt',
                                    onChangeText: (e) => setSearchQuery(e.nativeEvent.text),
                                    autoCapitalize: 'none'
                                }
                            } }
                        >
                        <Stack.Toolbar placement="right">
                            <Stack.Toolbar.Button icon="xmark" variant="plain" onPress={() => router.back()} />
                        </Stack.Toolbar>
                        </Stack.Screen>
                    </>
                )
            }

            <ScrollView
                style={ { backgroundColor: colors.modalBackground } }
                contentContainerStyle={ styles.scrollView }
                contentInsetAdjustmentBehavior="automatic"
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
            >
                <ScrollViewContent>
                {/* Filter Chips */ }
                <View style={ styles.chipContainer }>
                    <FilterChip label={ countryChipLabel } onPress={ handleSelectCountry } showChevron={true} variant="filled" />
                </View>

                {/* Loading */ }
                { isLoading ? (
                    <View style={ styles.emptyContainer }>
                        <ActivityIndicator size="large" color={ colors.textSecondary } />
                        <Text style={ [styles.emptyText, { color: colors.textHint, marginTop: 16 }] }>
                            { t('careProvider.loadingProviders') }
                        </Text>
                    </View>
                ) : filteredProviders.length > 0 ? (
                    <>
                        <List.Section title={ t('careProvider.resultsCount', { count: filteredProviders.length }) } rounded>
                            { filteredProviders.map((provider) => {
                                const alreadyAdded = existingNames.has(provider.name);
                                return (
                                    <List.Item
                                        key={ provider.id }
                                        title={ provider.name }
                                        subtitle={ [provider.specialty, provider.city].filter(Boolean).join(' · ') }
                                        onPress={ alreadyAdded ? undefined : () => handleAddProvider(provider) }
                                        disabled={ alreadyAdded }
                                        leftCmpSize={56}
                                        leftCmp={
                                            <ListItemIcon name={getProviderIcon(provider.type)} color={colors.text} size="lg" backgroundColor={colors.listItemBackgroundMuted} />
                                        }
                                        badge={ alreadyAdded ? <Badge label={t('careProvider.added')} variant="success" size="small" /> : undefined }
                                        hideChevron
                                    />
                                );
                            }) }
                        </List.Section>
                        <List.Wrapper>
                            <List.Text>
                                { t('careProvider.tapToAddHint') }
                            </List.Text>
                        </List.Wrapper>
                    </>
                ) : (
                    <View style={ styles.emptyContainer }>
                        <AppIcon
                            name={ "magnifyingglass" }
                            tintColor={ colors.textHint }
                            size={ 40 }
                        />
                        <Text style={ [styles.emptyTitle, { color: colors.text }] }>
                            { t('common.noResults') }
                        </Text>
                        <Text style={ [styles.emptyText, { color: colors.textHint }] }>
                            { searchQuery
                                ? t('careProvider.noSearchResults')
                                : t('careProvider.noCountryResults') }
                        </Text>
                    </View>
                ) }

                {/* Add Custom Provider — always visible */ }
                <List.Section rounded>
                    <List.Item
                        title={t('careProvider.createCustomEntry')}
                        subtitle={t('careProvider.createCustomEntryHint')}
                        onPress={ handleAddCustom }
                        leftCmpSize={56}
                        leftCmp={
                            <ListItemIcon name="plus" color={colors.primary} size="lg" />
                        }
                        hideChevron
                        lastItem
                    />
                </List.Section>
                </ScrollViewContent>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    chipContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 4,
        gap: 8
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 20
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16
    },
    emptyText: {
        fontSize: 15,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 22
    },
});
