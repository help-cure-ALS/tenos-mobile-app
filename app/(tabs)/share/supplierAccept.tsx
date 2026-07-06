// Partner-app token accept flow
// Receives token from QR code scan or deep link, shows org details, asks for consent

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, List, Space, Text } from 'react-native-nice-ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useAppTheme } from '@/src/theme';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import { useFhirRepo } from '@/src/hooks/useFhirRepo';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { DataSelector, type DataSelection } from '@/src/components/ui/DataSelector';
import { supplierClient, setToken } from '@/src/services/supplierExchange';
import type { LinkRequestDetails, SupplierSelectionPolicy } from '@/src/services/supplierExchange';
import type { FhirOrganization } from '@/app/settings/careProvider/index';
import { SUPPLIER_LINKED_EXTENSION_URL } from '@/app/settings/careProvider/index';
import { HeaderButton } from '@/src/components/ui/navigation/HeaderButton';
import { on } from '@/src/lib/bus';
import { useAssistiveAidsRouteGuard } from '@/src/hooks/useAssistiveAidsRouteGuard';

type Step = 'loading' | 'consent' | 'done' | 'expired' | 'verificationRequired';

export default function SupplierAcceptScreen() {
    const { isAllowed } = useAssistiveAidsRouteGuard('/(tabs)/share');

    if (!isAllowed) {
        return null;
    }

    return <SupplierAcceptContent />;
}

function SupplierAcceptContent() {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const router = useSafeRouter();
    const insets = useSafeAreaInsets();
    const { isDemo } = useAppRole();
    const { patientPreferencesStore: store } = usePatientStores();
    const fhirRepo = useFhirRepo();
    const fhirRepoRef = useRef(fhirRepo);
    fhirRepoRef.current = fhirRepo;
    const { token } = useLocalSearchParams<{ token: string }>();

    const [step, setStep] = useState<Step>('loading');
    const [details, setDetails] = useState<LinkRequestDetails | null>(null);
    const [selection, setSelection] = useState<DataSelection>({
        metricIds: [],
        categories: { medications: true, aids: true, questionnaires: false },
    });
    const [accepting, setAccepting] = useState(false);

    const load = useCallback(async () => {
        if (step === 'done') {
            return;
        }

        if (isDemo) {
            Alert.alert(t('common.demoModeTitle'), t('common.demoModeMessage'), [{ text: t('common.ok'), onPress: () => router.back() }]);
            return;
        }
        if (!token) {
            setDetails(null);
            setStep('expired');
            return;
        }

        const prefs = await store?.getAll();
        const verification = prefs?.verification;
        if (!verification || verification.status !== 'verified' || !verification.tokenId) {
            setDetails(null);
            setStep('verificationRequired');
            return;
        }

        try {
            const requestDetails = await supplierClient.getRequestDetails(token);
            if (new Date(requestDetails.expires_at) < new Date()) {
                setDetails(null);
                setStep('expired');
            } else {
                setDetails(requestDetails);
                setStep('consent');
            }
        } catch (err) {
            console.warn('Failed to load request details:', err);
            setDetails(null);
            setStep('expired');
        }
    }, [isDemo, router, step, store, t, token]);

    useFocusEffect(
        useCallback(() => {
            void load();
        }, [load]),
    );

    useEffect(() => {
        const off = on('verification:changed', () => {
            void load();
        });
        return off;
    }, [load]);

    const handleAccept = useCallback(async () => {
        if (!token || !details || !store) return;
        setAccepting(true);

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
                integrationId: '',
                metricIds: selection.metricIds,
                categories: selection.categories,
                directions: { outbound: true, inbound: true },
            };

            const result = await supplierClient.acceptPartnerRequest(token, policy, verification.tokenId);

            await setToken(result.integration_id, result.token);

            await store.setSupplierIntegration({
                id: result.integration_id,
                organizationId: result.organization_id,
                organizationName: result.organization_name,
                linkedAt: new Date().toISOString(),
                active: true,
            });

            policy.integrationId = result.integration_id;
            await store.setSupplierPolicy(policy);

            // Save supplier as FHIR Organization for care provider detail screen
            const fhirOrg: FhirOrganization = {
                resourceType: 'Organization',
                id: result.organization_id,
                name: result.organization_name,
                extension: [{ url: SUPPLIER_LINKED_EXTENSION_URL, valueBoolean: true }],
                meta: { lastUpdated: new Date().toISOString() },
            };
            await fhirRepoRef.current.upsert('Organization', fhirOrg.id, fhirOrg, fhirOrg.meta?.lastUpdated);

            setStep('done');
        } catch (err) {
            console.warn('Accept failed:', err);
            Alert.alert(t('common.error'), t('supplier.acceptError'));
        } finally {
            setAccepting(false);
        }
    }, [details, router, selection, store, t, token]);

    const handleClose = useCallback(() => {
        router.back();
    }, [router]);

    const headerTitle = t('supplier.acceptTitle');

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
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
                contentInsetAdjustmentBehavior="automatic"
            >
                {step === 'loading' && (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator />
                        <Text variant="bodyMedium" color="secondary" style={{ marginTop: 12 }}>
                            {t('supplier.loadingRequest')}
                        </Text>
                    </View>
                )}

                {step === 'expired' && (
                    <>
                        <ScreenHeader
                            icon="exclamationmark.triangle.fill"
                            iconTintColor="#FF9500"
                            title={t('supplier.requestExpired')}
                            subtitle={t('supplier.requestExpiredDesc')}
                        />
                        <Space size="xl" />
                        <List.Wrapper>
                            <Button title={t('common.done')} onPress={handleClose} rounded />
                        </List.Wrapper>
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
                        <Space size="xl" />
                        <List.Wrapper>
                            <Button
                                title={t('supplier.openVerification')}
                                onPress={() => router.push('/settings/account/verification')}
                                rounded
                            />
                        </List.Wrapper>
                    </>
                )}

                {step === 'consent' && details && (
                    <>
                        <ScreenHeader
                            icon="checkmark.shield.fill"
                            iconTintColor="#34C759"
                            title={t('supplier.consentTitle')}
                            subtitle={t('supplier.consentDesc', { name: details.organization_name })}
                        />

                        <List.Section title={t('supplier.orgDetails')} rounded>
                            <List.Item
                                title={details.organization_name}
                                subtitle={details.specialty}
                                hideChevron
                                lastItem
                            />
                        </List.Section>

                        <DataSelector
                            selection={selection}
                            onSelectionChange={setSelection}
                        />

                        <Space size="lg" />

                        <List.Wrapper>
                            <Button
                                title={accepting ? t('common.loading') : t('supplier.confirmAccept')}
                                onPress={handleAccept}
                                disabled={accepting}
                                rounded
                            />
                        </List.Wrapper>
                    </>
                )}

                {step === 'done' && (
                    <>
                        <ScreenHeader
                            icon="checkmark.circle.fill"
                            iconTintColor="#34C759"
                            title={t('supplier.acceptSuccess')}
                            subtitle={t('supplier.acceptSuccessDesc', { name: details?.organization_name })}
                        />
                        <Space size="xl" />
                        <List.Wrapper>
                            <Button title={t('common.done')} onPress={handleClose} rounded />
                        </List.Wrapper>
                    </>
                )}
            </ScrollView>
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
});
