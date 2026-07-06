import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { Button, List, Space } from 'react-native-nice-ui';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { useFhirRepo } from '@/src/hooks/useFhirRepo';
import { on } from '@/src/lib/bus';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';

// FHIR resource types
export type FhirPractitioner = {
    resourceType: 'Practitioner';
    id: string;
    name?: Array<{ text?: string; family?: string; given?: string[] }>;
    telecom?: Array<{ system?: string; value?: string }>;
    address?: Array<{
        line?: string[];
        city?: string;
        postalCode?: string;
        country?: string;
    }>;
    qualification?: Array<{
        code?: { text?: string };
    }>;
    extension?: Array<{ url: string; valueBoolean?: boolean }>;
    meta?: { lastUpdated?: string };
};

export type FhirOrganization = {
    resourceType: 'Organization';
    id: string;
    name?: string;
    type?: Array<{ text?: string }>;
    telecom?: Array<{ system?: string; value?: string }>;
    address?: Array<{
        line?: string[];
        city?: string;
        postalCode?: string;
        country?: string;
    }>;
    extension?: Array<{ url: string; valueBoolean?: boolean }>;
    meta?: { lastUpdated?: string };
};

export const CUSTOM_ENTRY_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/custom-entry';
export const SUPPLIER_LINKED_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/supplier-linked';

export function isCustomEntry(resource: any): boolean {
    return resource?.extension?.some(
        (e: any) => e.url === CUSTOM_ENTRY_EXTENSION_URL && e.valueBoolean === true
    ) ?? false;
}

export function isSupplierLinked(resource: any): boolean {
    return resource?.extension?.some(
        (e: any) => e.url === SUPPLIER_LINKED_EXTENSION_URL && e.valueBoolean === true
    ) ?? false;
}

export type CareProvider = {
    id: string;
    type: 'practitioner' | 'organization';
    name: string;
    specialty?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    isCustom?: boolean;
    isSupplierLinked?: boolean;
};

function practitionerToProvider(p: FhirPractitioner, t: (key: string) => string): CareProvider {
    const name = p.name?.[0]?.text ||
        [p.name?.[0]?.given?.join(' '), p.name?.[0]?.family].filter(Boolean).join(' ') ||
        t('careProvider.unknownDoctor');

    const phone = p.telecom?.find(t => t.system === 'phone')?.value;
    const addr = p.address?.[0];

    return {
        id: p.id,
        type: 'practitioner',
        name,
        specialty: p.qualification?.[0]?.code?.text,
        phone,
        address: addr?.line?.join(', '),
        city: addr?.city,
        country: addr?.country,
        isCustom: isCustomEntry(p)
    };
}

function organizationToProvider(o: FhirOrganization, t: (key: string) => string): CareProvider {
    const phone = o.telecom?.find(t => t.system === 'phone')?.value;
    const addr = o.address?.[0];

    return {
        id: o.id,
        type: 'organization',
        name: o.name || t('careProvider.unknownClinic'),
        specialty: o.type?.[0]?.text,
        phone,
        address: addr?.line?.join(', '),
        city: addr?.city,
        country: addr?.country,
        isCustom: isCustomEntry(o),
        isSupplierLinked: isSupplierLinked(o)
    };
}

function getProviderIcon(type: 'practitioner' | 'organization'): string {
    return type === 'practitioner' ? 'person' : 'building.2';
}

function formatProviderSubtitle(provider: CareProvider, t: (key: string) => string): string {
    const parts: string[] = [];
    if (provider.specialty) {
        parts.push(provider.specialty);
    }
    if (provider.city) {
        parts.push(provider.city);
    }
    return parts.join(' · ') || t('careProvider.noDetails');
}

export default function CareProvidersScreen() {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const { syncEnabled, fullSync } = useAppSync();
    const fhirRepo = useFhirRepo();
    const router = useSafeRouter();

    const [providers, setProviders] = useState<CareProvider[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const loadingRef = useRef(false);
    const initialLoadDone = useRef(false);

    // Store fhirRepo in a ref to avoid re-creating loadProviders on every render
    const fhirRepoRef = useRef(fhirRepo);
    fhirRepoRef.current = fhirRepo;

    const loadProviders = useCallback(async () => {
        if (loadingRef.current) {
            return;
        }
        loadingRef.current = true;
        setIsLoading(true);

        try {
            const allProviders: CareProvider[] = [];

            // Load all Practitioners
            const practitioners = await fhirRepoRef.current.list('Practitioner');
            for (const row of practitioners) {
                if (!row.deleted) {
                    allProviders.push(practitionerToProvider(row.resource as FhirPractitioner, t));
                }
            }

            // Load all Organizations
            const organizations = await fhirRepoRef.current.list('Organization');
            for (const row of organizations) {
                if (!row.deleted) {
                    allProviders.push(organizationToProvider(row.resource as FhirOrganization, t));
                }
            }

            // Sort by name
            allProviders.sort((a, b) => a.name.localeCompare(b.name));
            setProviders(allProviders);
        }
        catch (e) {
            console.error('Failed to load care providers:', e);
        }
        finally {
            loadingRef.current = false;
            setIsLoading(false);
        }
    }, []);

    // Initial load only once
    useEffect(() => {
        if (!initialLoadDone.current) {
            initialLoadDone.current = true;
            loadProviders();
        }
    }, [loadProviders]);

    // Subscribe to fhir:changed to reload after adding/deleting providers
    useEffect(() => {
        const unsubscribe = on('fhir:changed', loadProviders);
        return () => unsubscribe();
    }, [loadProviders]);

    const handleAddProvider = useCallback(() => {
        router.push('/settings/careProvider/search');
    }, []);

    const handleProviderPress = useCallback((provider: CareProvider) => {
        router.push({
            pathname: '/settings/careProvider/detail',
            params: {
                id: provider.id,
                type: provider.type
            }
        });
    }, []);

    const handleDeleteProvider = useCallback(async (provider: CareProvider) => {
        if (provider.isSupplierLinked) {
            Alert.alert(
                t('careProvider.supplierLinkedTitle'),
                t('careProvider.supplierLinkedMessage', { name: provider.name }),
                [{ text: t('common.ok') }]
            );
            return;
        }

        Alert.alert(
            t('careProvider.removeProviderTitle'),
            t('careProvider.removeProviderMessage', { name: provider.name }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.remove'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const resourceType = provider.type === 'practitioner' ? 'Practitioner' : 'Organization';
                            await fhirRepo.markDeleted(resourceType, provider.id);

                            if (syncEnabled) {
                                await fullSync('care provider delete');
                            }
                        }
                        catch (e: any) {
                            Alert.alert(t('common.error'), e?.message ?? String(e));
                        }
                    }
                }
            ]
        );
    }, [fhirRepo, syncEnabled, fullSync, t]);

    return (
        <ScrollView
            style={ { backgroundColor: colors.modalBackground } }
            contentContainerStyle={ styles.scrollView }
            contentInsetAdjustmentBehavior="automatic"
        >
            <ScrollViewContent>
                <ScreenHeader
                    icon="staroflife"
                    iconTintColor={ colors.brandColorMuted }
                    subtitle={ t('careProvider.headerSubtitle') }
                />

                <Space />

                {/* Add Provider Button */ }
                <List.Wrapper>
                    <Button
                        title={ t('careProvider.addProvider') }
                        onPress={ handleAddProvider }
                        rounded
                    />
                </List.Wrapper>

                {/* Provider List */ }
                { providers.length > 0 && (
                    <List.Section title={ t('careProvider.yourProviders') } rounded>
                        { providers.map((provider, index) => (
                            <List.Item
                                key={ `${ provider.type }-${ provider.id }` }
                                title={ provider.name }
                                subtitle={ formatProviderSubtitle(provider, t) }
                                onPress={ () => handleProviderPress(provider) }
                                onLongPress={ () => handleDeleteProvider(provider) }
                                leftCmpSize={56}
                                leftCmp={
                                    <ListItemIcon name={getProviderIcon(provider.type)} color={colors.text} size="lg" backgroundColor={colors.listItemBackgroundMuted} />
                                }
                                lastItem={ index === providers.length - 1 }
                            />
                        )) }
                    </List.Section>
                ) }

                <List.Wrapper>

                    {/* Empty State */ }
                    { !isLoading && providers.length === 0 && (
                        <List.Text align="center">
                            { t('careProvider.noProviders') }
                        </List.Text>
                    ) }

                    { providers.length > 0 && (
                        <List.Text>
                            { t('careProvider.longPressHint') }
                        </List.Text>
                    ) }

                </List.Wrapper>
            </ScrollViewContent>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    headerSection: {
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 16
    },
    illustrationContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16
    },
    headerText: {
        fontSize: 17,
        lineHeight: 22,
        fontWeight: 500,
        textAlign: 'center'
    },
});
