import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/src/theme';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { Button, List, Space } from 'react-native-nice-ui';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { useFhirRepo } from '@/src/hooks/useFhirRepo';
import { getCountryLabel } from '@/src/components/ui/CountryPicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { FhirPractitioner, FhirOrganization } from './index';
import { isCustomEntry, isSupplierLinked } from './index';
import { useFocusEffect } from "expo-router/react-navigation";
import { AppIcon } from '@/src/components/ui/AppIcon';
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { CloseButton } from "@/src/components/ui/navigation/CloseButton";

type ProviderType = 'practitioner' | 'organization';

function getProviderIcon(type: 'practitioner' | 'organization'): string {
    return type === 'practitioner' ? 'person' : 'building.2';
}

export default function CareProviderDetailScreen() {
    const { t } = useTranslation();
    const { colors } = useAppTheme();

    const getTypeLabel = (type: ProviderType): string => {
        return type === 'practitioner' ? t('careProvider.typePractitioner') : t('careProvider.typeOrganization');
    };
    const params = useLocalSearchParams<{ id: string; type: string }>();
    const { syncEnabled, fullSync } = useAppSync();
    const fhirRepo = useFhirRepo();
    const router = useSafeRouter();

    const providerType = (params.type as ProviderType) || 'practitioner';
    const providerId = params.id || '';

    // Store fhirRepo in a ref to avoid re-creating loadProvider on every render
    const fhirRepoRef = useRef(fhirRepo);
    fhirRepoRef.current = fhirRepo;

    const [name, setName] = useState('');
    const [specialty, setSpecialty] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [country, setCountry] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isCustom, setIsCustom] = useState(false);
    const [isSupplierOrg, setIsSupplierOrg] = useState(false);
    const loadingRef = useRef(false);

    const loadProvider = useCallback(async () => {
        if (!providerId || loadingRef.current) return;
        loadingRef.current = true;

        try {
            const resourceType = providerType === 'practitioner' ? 'Practitioner' : 'Organization';
            const row = await fhirRepoRef.current.get(resourceType, providerId);

            if (!row || row.deleted) {
                Alert.alert(t('common.error'), t('careProvider.providerNotFound'));
                router.back();
                return;
            }

            setIsCustom(isCustomEntry(row.resource));
            setIsSupplierOrg(isSupplierLinked(row.resource));

            if (providerType === 'practitioner') {
                const p = row.resource as FhirPractitioner;
                const displayName = p.name?.[0]?.text ||
                    [p.name?.[0]?.given?.join(' '), p.name?.[0]?.family].filter(Boolean).join(' ') ||
                    t('careProvider.unknownDoctor');
                setName(displayName);
                setSpecialty(p.qualification?.[0]?.code?.text || '');
                setPhone(p.telecom?.find(tel => tel.system === 'phone')?.value || '');
                const addr = p.address?.[0];
                setAddress(addr?.line?.join(', ') || '');
                setCity(addr?.city || '');
                setPostalCode(addr?.postalCode || '');
                setCountry(addr?.country || '');
            } else {
                const o = row.resource as FhirOrganization;
                setName(o.name || t('careProvider.unknownClinic'));
                setSpecialty(o.type?.[0]?.text || '');
                setPhone(o.telecom?.find(tel => tel.system === 'phone')?.value || '');
                const addr = o.address?.[0];
                setAddress(addr?.line?.join(', ') || '');
                setCity(addr?.city || '');
                setPostalCode(addr?.postalCode || '');
                setCountry(addr?.country || '');
            }
        } catch (e) {
            console.error('Failed to load provider:', e);
        } finally {
            setIsLoading(false);
            loadingRef.current = false;
        }
    }, [providerId, providerType]);

    // Load on mount + reload on focus (e.g. after returning from edit)
    useFocusEffect(
        useCallback(() => {
            loadProvider();
        }, [loadProvider])
    );

    const handleEdit = useCallback(() => {
        router.push({
            pathname: '/settings/careProvider/add',
            params: { id: providerId, type: providerType }
        });
    }, [providerId, providerType]);

    const handleCall = useCallback(() => {
        if (!phone) return;
        const phoneUrl = `tel:${phone.replace(/\s/g, '')}`;
        Linking.openURL(phoneUrl).catch(() => {
            Alert.alert(t('common.error'), t('careProvider.callFailed'));
        });
    }, [phone, t]);

    const handleOpenMaps = useCallback(() => {
        const addressParts = [address, postalCode, city, country && getCountryLabel(country)].filter(Boolean);
        if (addressParts.length === 0) return;

        const query = encodeURIComponent(addressParts.join(', '));
        const url = Platform.OS === 'ios'
            ? `maps:?q=${query}`
            : `geo:0,0?q=${query}`;

        Linking.openURL(url).catch(() => {
            // Fallback to Google Maps
            Linking.openURL(`https://maps.google.com/?q=${query}`);
        });
    }, [address, city, postalCode, country]);

    const handleDelete = useCallback(() => {
        Alert.alert(
            t('careProvider.removeProviderTitle'),
            t('careProvider.removeProviderMessage', { name }),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.remove'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const resourceType = providerType === 'practitioner' ? 'Practitioner' : 'Organization';
                            await fhirRepoRef.current.markDeleted(resourceType, providerId);

                            if (syncEnabled) {
                                await fullSync('care provider delete');
                            }

                            router.back();
                        } catch (e: any) {
                            Alert.alert(t('common.error'), e?.message ?? String(e));
                        }
                    }
                }
            ]
        );
    }, [name, providerType, providerId, syncEnabled, fullSync, t]);

    const formattedAddress = useMemo(() => {
        const parts = [address, [postalCode, city].filter(Boolean).join(' ')].filter(Boolean);
        return parts.join('\n');
    }, [address, city, postalCode]);

    if (isLoading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.modalBackground }]}>
                <Text style={[styles.loadingText, { color: colors.textHint }]}>
                    { t('common.loading') }
                </Text>
            </View>
        );
    }

    return (<>
            {
                Platform.OS === 'android' ? (
                    <Stack.Screen
                        options={ {
                            headerTransparent: false,
                            headerBackVisible: false,
                            headerRight: () => (
                                <CloseButton onPress={ () => router.back() } />
                            )
                        } }
                    />
                ) : (
                    <>
                        <Stack.Toolbar placement="right">
                            <Stack.Toolbar.Button icon="xmark" variant="plain" onPress={ () => router.back() } />
                        </Stack.Toolbar>
                    </>
                )
            }
            <ScrollView
                style={{ backgroundColor: colors.modalBackground }}
                contentContainerStyle={styles.scrollView}
                contentInsetAdjustmentBehavior="automatic"
            >
                <ScrollViewContent>
                <ScreenHeader
                    icon={getProviderIcon(providerType)}
                    iconTintColor={ colors.brandColorMuted }
                    title={name}
                    titleVariant="headlineSmall"
                    subtitle={getTypeLabel(providerType)}
                />
                <Space />
                <View style={styles.container}>

                    {/* Quick Actions */}
                    {(phone || formattedAddress) && (
                        <View style={styles.actionsRow}>
                            {phone && (
                                <View style={styles.actionButton}>
                                    <Button
                                        title={ t('careProvider.call') }
                                        onPress={handleCall}
                                        rounded
                                        style={{ minWidth: 120 }}
                                    />
                                </View>
                            )}
                            {formattedAddress && (
                                <View style={styles.actionButton}>
                                    <Button
                                        title={ t('careProvider.route') }
                                        onPress={handleOpenMaps}
                                        rounded
                                        variant="secondary"
                                        style={{ minWidth: 120 }}
                                    />
                                </View>
                            )}
                        </View>
                    )}

                    {/* Details */}
                    <List.Section title={ t('careProvider.details') } rounded>
                        {specialty && (
                            <List.Item
                                title={ t('careProvider.specialty') }
                                rightTitle={specialty}
                                hideChevron
                            />
                        )}
                        {phone && (
                            <List.Item
                                title={ t('careProvider.phone') }
                                rightTitle={phone}
                                onPress={handleCall}
                                hideChevron
                            />
                        )}
                        {!specialty && !phone && (
                            <List.Item
                                title={ t('careProvider.noDetailsTitle') }
                                subtitle={ t('careProvider.noDetailsSubtitle') }
                                hideChevron
                            />
                        )}
                    </List.Section>

                    {/* Address */}
                    {(formattedAddress || country) && (
                        <List.Section title={ t('careProvider.address') } rounded>
                            {formattedAddress && (
                                <List.Item
                                    title={formattedAddress}
                                    titleNumberOfLines={3}
                                    onPress={handleOpenMaps}
                                    hideChevron
                                />
                            )}
                            {country && (
                                <List.Item
                                    title={ t('careProvider.country') }
                                    rightTitle={getCountryLabel(country)}
                                    hideChevron
                                    lastItem
                                />
                            )}
                        </List.Section>
                    )}

                    { isCustom && (
                        <>
                            <Space size="2xl" />

                            <List.Wrapper>
                                <Button
                                    title={ t('careProvider.editProvider') }
                                    onPress={handleEdit}
                                    rounded
                                />
                            </List.Wrapper>
                        </>
                    ) }

                    { !isSupplierOrg && (
                        <>
                            <Space size="2xl" />

                            <List.Wrapper>
                                <Button
                                    title={ t('careProvider.removeProvider') }
                                    onPress={handleDelete}
                                    variant="danger"
                                    rounded
                                />
                                <List.Text>
                                    { t('careProvider.removeProviderHint') }
                                </List.Text>
                            </List.Wrapper>
                        </>
                    ) }

                </View>
                    </ScrollViewContent>
            </ScrollView>
    </>
    );
}

const styles = StyleSheet.create({
    container: {},
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        fontSize: 16,
    },
    headerSection: {
        alignItems: 'center',
        paddingVertical: 24,
        paddingHorizontal: 20,
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    nameText: {
        fontSize: 24,
        fontWeight: '600',
        textAlign: 'center',
    },
    typeText: {
        fontSize: 16,
        marginTop: 4,
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    actionButton: {
        flex: 1,
        maxWidth: 160,
    }
});
