// Care-backend supplier linking flow (multi-step)
// Step 1: Select organization from proxy list
// Step 2: Consent (DataSelector) for data sharing policy
// Step 3: Confirm & activate

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Badge, Button, List, Space, Text } from 'react-native-nice-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppTheme } from '@/src/theme';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import { useFhirRepo } from '@/src/hooks/useFhirRepo';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { DataSelector, type DataSelection } from '@/src/components/ui/DataSelector';
import { supplierClient, setToken } from '@/src/services/supplierExchange';
import type { SupplierOrganization } from '@/src/services/supplierExchange';
import type { SupplierSelectionPolicy } from '@/src/stores/patientPreferencesStore';
import type { FhirOrganization } from '@/app/settings/careProvider/index';
import { SUPPLIER_LINKED_EXTENSION_URL } from '@/app/settings/careProvider/index';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { on } from '@/src/lib/bus';
import { getCountryByCode, getCountryLabel } from '@/src/components/ui/CountryPicker';
import { FilterChip } from '@/src/components/ui/FilterChip';
import { getCurrentLanguage } from '@/src/i18n';
import { useActivePatientId } from '@/src/context/AppRoleProvider';
import { useAssistiveAidsRouteGuard } from '@/src/hooks/useAssistiveAidsRouteGuard';

type Step = 'select' | 'consent' | 'done' | 'verificationRequired';

export default function SupplierLinkScreen() {
    const { isAllowed } = useAssistiveAidsRouteGuard('/(tabs)/share');

    if (!isAllowed) {
        return null;
    }

    return <SupplierLinkContent />;
}

function SupplierLinkContent() {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { patientPreferencesStore: store } = usePatientStores();
    const fhirRepo = useFhirRepo();
    const fhirRepoRef = useRef(fhirRepo);
    fhirRepoRef.current = fhirRepo;
    const patientId = useActivePatientId();

    const [step, setStep] = useState<Step>('select');
    const [country, setCountry] = useState('DE');
    const pickerOpenedFromHere = useRef(false);
    const [organizations, setOrganizations] = useState<SupplierOrganization[]>([]);
    const [linkedOrgIds, setLinkedOrgIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [selectedOrg, setSelectedOrg] = useState<SupplierOrganization | null>(null);
    const [selection, setSelection] = useState<DataSelection>({
        metricIds: ['alsfrs-r'],
        categories: { medications: false, aids: true, questionnaires: false },
    });
    const [linking, setLinking] = useState(false);

    const load = useCallback(async () => {
        if (step === 'done') {
            return;
        }

        setLoading(true);
        try {
            const prefs = await store?.getAll();
            const verification = prefs?.verification;
            if (!verification || verification.status !== 'verified' || !verification.tokenId) {
                setOrganizations([]);
                setLinkedOrgIds(new Set());
                setSelectedOrg(null);
                setStep('verificationRequired');
                return;
            }

            const [orgs, integrations] = await Promise.all([
                supplierClient.listOrganizations(country),
                store?.getSupplierIntegrations() ?? Promise.resolve([]),
            ]);
            setOrganizations(orgs);
            setLinkedOrgIds(new Set(integrations.map(i => i.organizationId)));
            setStep((current) => (current === 'consent' || current === 'done') ? current : 'select');
        } catch (err) {
            console.warn('Failed to load organizations:', err);
            Alert.alert(t('common.error'), t('supplier.loadError'));
        } finally {
            setLoading(false);
        }
    }, [step, store, t, country]);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load]),
    );

    useEffect(() => {
        const off = on('verification:changed', () => {
            void load();
        });
        return off;
    }, [load]);

    // Load country from patient on mount
    useEffect(() => {
        if (!patientId) return;
        fhirRepoRef.current.get('Patient', patientId).then(row => {
            const patientCountry = (row?.resource as any)?.address?.[0]?.country;
            if (patientCountry) setCountry(patientCountry);
        });
    }, [patientId]);

    // Listen for country selection from picker
    useEffect(() => {
        const unsubscribe = on('country:selected', (code: string) => {
            if (!pickerOpenedFromHere.current) return;
            pickerOpenedFromHere.current = false;
            setCountry(code);
        });
        return () => unsubscribe();
    }, []);

    const handleSelectCountry = useCallback(() => {
        pickerOpenedFromHere.current = true;
        router.push({
            pathname: '/settings/profile/countryPicker',
            params: { selected: country, prioritizeForLanguage: getCurrentLanguage() },
        });
    }, [country]);

    const handleSelectOrg = useCallback((org: SupplierOrganization) => {
        if (step !== 'select') return;
        setSelectedOrg(org);
        setStep('consent');
    }, [step]);

    const handleLink = useCallback(async () => {
        if (!selectedOrg || !store) return;
        setLinking(true);

        try {
            const prefs = await store.getAll();
            const verification = prefs.verification;
            if (verification?.status !== 'verified' || !verification.tokenId) {
                Alert.alert(
                    t('supplier.verificationRequiredTitle'),
                    t('supplier.verificationRequiredDesc'),
                    [
                        { text: t('common.cancel'), style: 'cancel' },
                        {
                            text: t('supplier.openVerification'),
                            onPress: () => router.push('/settings/account/verification'),
                        },
                    ],
                );
                return;
            }

            const policy: SupplierSelectionPolicy = {
                integrationId: '', // will be set after linking
                metricIds: selection.metricIds,
                categories: selection.categories,
                directions: { outbound: true, inbound: true },
            };

            const result = await supplierClient.linkCareOrg(selectedOrg.id, policy, verification.tokenId);

            // Store token in SecureStore
            await setToken(result.integration_id, result.token);

            // Store metadata + policy in preferences
            await store.setSupplierIntegration({
                id: result.integration_id,
                organizationId: selectedOrg.id,
                organizationName: selectedOrg.name,
                linkedAt: new Date().toISOString(),
                active: true,
                address: selectedOrg.address,
                phone: selectedOrg.phone,
                email: selectedOrg.email,
            });

            policy.integrationId = result.integration_id;
            await store.setSupplierPolicy(policy);

            // Save supplier as FHIR Organization for care provider detail screen
            const fhirOrg: FhirOrganization = {
                resourceType: 'Organization',
                id: selectedOrg.id,
                name: selectedOrg.name,
                type: selectedOrg.specialty ? [{ text: selectedOrg.specialty }] : undefined,
                telecom: [
                    ...(selectedOrg.phone ? [{ system: 'phone' as const, value: selectedOrg.phone }] : []),
                    ...(selectedOrg.email ? [{ system: 'email' as const, value: selectedOrg.email }] : []),
                ].length > 0 ? [
                    ...(selectedOrg.phone ? [{ system: 'phone' as const, value: selectedOrg.phone }] : []),
                    ...(selectedOrg.email ? [{ system: 'email' as const, value: selectedOrg.email }] : []),
                ] : undefined,
                address: selectedOrg.address ? [{
                    line: [selectedOrg.address],
                    country: selectedOrg.country,
                }] : selectedOrg.country ? [{
                    country: selectedOrg.country,
                }] : undefined,
                extension: [{ url: SUPPLIER_LINKED_EXTENSION_URL, valueBoolean: true }],
                meta: { lastUpdated: new Date().toISOString() },
            };
            await fhirRepoRef.current.upsert('Organization', fhirOrg.id, fhirOrg, fhirOrg.meta?.lastUpdated);

            setStep('done');
        } catch (err) {
            console.warn('Linking failed:', err);
            Alert.alert(t('common.error'), t('supplier.linkError'));
        } finally {
            setLinking(false);
        }
    }, [router, selectedOrg, selection, store, t]);

    const handleClose = useCallback(() => {
        router.back();
    }, [router]);

    const headerTitle = t('supplier.linkTitle');

    const countryLabel = getCountryByCode(country);
    const countryChipLabel = countryLabel ? countryLabel.name : '';

    return (
        <View style={[styles.container, { backgroundColor: colors.modalBackground }]}>
            {Platform.OS === 'android' ? (
                <Stack.Screen
                    options={{
                        headerTitle,
                        headerRight: () => (
                            <HeaderButton onPress={handleClose} title={t('common.done')} />
                        ),
                    }}
                />
            ) : (
                <Stack.Screen options={{ headerTitle }}>
                    <Stack.Toolbar placement="right">
                        <Stack.Toolbar.Button onPress={handleClose}>{t('common.done')}</Stack.Toolbar.Button>
                    </Stack.Toolbar>
                </Stack.Screen>
            )}

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                contentInsetAdjustmentBehavior="automatic"
            >
                {step === 'select' && (
                    <>
                        <ScreenHeader
                            icon="cross.case.fill"
                            iconTintColor={colors.brandColorMuted}
                            title={t('supplier.selectOrg')}
                            subtitle={t('supplier.selectOrgDesc')}
                        />

                        <View style={styles.chipContainer}>
                            <FilterChip
                                label={countryChipLabel}
                                onPress={handleSelectCountry}
                                showChevron
                                variant="filled"
                            />
                        </View>

                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator />
                            </View>
                        ) : (
                            <List.Section title={t('supplier.availableOrgs')} rounded>
                                {organizations.map((org, idx) => {
                                    const alreadyLinked = linkedOrgIds.has(org.id);
                                    return (
                                        <List.Item
                                            key={org.id}
                                            title={org.name}
                                            subtitle={[org.specialty, org.address].filter(Boolean).join('\n')}
                                            subtitleNumberOfLines={2}
                                            leftCmpSize={40}
                                            leftCmp={<ListItemIcon name="cross.case.fill" color={alreadyLinked ? colors.textTertiary : '#007AFF'} size="md" />}
                                            rightCmp={alreadyLinked ? (
                                                <Badge label={t('supplier.alreadyLinked')} color={colors.listItemBackgroundMuted} textColor={colors.textTertiary} />
                                            ) : undefined}
                                            onPress={alreadyLinked ? undefined : () => handleSelectOrg(org)}
                                            disabled={alreadyLinked}
                                            lastItem={idx === organizations.length - 1}
                                        />
                                    );
                                })}
                                {organizations.length === 0 && (
                                    <List.Item
                                        title={t('supplier.noOrgsAvailable')}
                                        hideChevron
                                        lastItem
                                    />
                                )}
                            </List.Section>
                        )}
                    </>
                )}

                {step === 'verificationRequired' && (
                    <>
                        <ScreenHeader
                            icon="checkmark.shield.fill"
                            iconTintColor="#FF9500"
                            title={t('supplier.verificationRequiredTitle')}
                            subtitle={t('supplier.verificationRequiredDesc')}
                        />
                        <Space />
                        <List.Wrapper>
                            <Button
                                title={t('supplier.openVerification')}
                                onPress={() => router.push('/settings/account/verification')}
                                rounded
                            />
                        </List.Wrapper>
                    </>
                )}

                {step === 'consent' && selectedOrg && (
                    <>
                        <ScreenHeader
                            icon="checkmark.shield.fill"
                            iconTintColor="#34C759"
                            title={t('supplier.consentTitle')}
                            subtitle={t('supplier.consentDesc', { name: selectedOrg.name })}
                        />

                        <DataSelector
                            selection={selection}
                            onSelectionChange={setSelection}
                        />
                    </>
                )}

                {step === 'done' && (
                    <ScreenHeader
                        icon="checkmark.circle.fill"
                        iconTintColor="#34C759"
                        title={t('supplier.linkSuccess')}
                        subtitle={t('supplier.linkSuccessDesc', { name: selectedOrg?.name })}
                    />
                )}
            </ScrollView>

            {/* Fixed bottom actions */}
            {step === 'consent' && (
                <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 16 }]}>
                    <List.Wrapper>
                        <Button
                            title={linking ? t('common.loading') : t('supplier.confirmLink')}
                            onPress={handleLink}
                            disabled={linking}
                            rounded
                        />
                    </List.Wrapper>
                    <Space />
                    <List.Wrapper>
                        <Button
                            title={t('common.back')}
                            onPress={() => setStep('select')}
                            variant="secondary"
                            rounded
                        />
                    </List.Wrapper>
                </View>
            )}
            {step === 'done' && (
                <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 16 }]}>
                    <List.Wrapper>
                        <Button
                            title={t('common.done')}
                            onPress={handleClose}
                            rounded
                        />
                    </List.Wrapper>
                </View>
            )}
            {step === 'verificationRequired' && (
                <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 16 }]}>
                    <List.Wrapper>
                        <Button
                            title={t('common.done')}
                            onPress={handleClose}
                            variant="secondary"
                            rounded
                        />
                    </List.Wrapper>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 20,
    },
    loadingContainer: {
        paddingVertical: 60,
        alignItems: 'center',
    },
    chipContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    bottomActions: {
        paddingTop: 8,
    },
});
