import React, { useCallback, useState, useEffect } from 'react';
import {
    Alert,
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
import { getCurrentLanguage } from '@/src/i18n';
import { on } from '@/src/lib/bus';
import * as Crypto from 'expo-crypto';
import type { FhirPractitioner, FhirOrganization } from './index';
import { CUSTOM_ENTRY_EXTENSION_URL } from './index';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { CloseButton } from "@/src/components/ui/navigation/CloseButton";
import { HeaderButton } from "@/src/components/ui/navigation/HeaderButton";

type ProviderType = 'practitioner' | 'organization';

function nowIso() {
    return new Date().toISOString();
}

export default function CareProviderAddScreen() {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const params = useLocalSearchParams<{ country?: string; id?: string; type?: string }>();
    const isEditMode = !!params.id;
    const { syncEnabled, fullSync } = useAppSync();
    const fhirRepo = useFhirRepo();
    const router = useSafeRouter();

    const typeOptions: { value: ProviderType; label: string }[] = [
        { value: 'practitioner', label: t('careProvider.typePractitioner') },
        { value: 'organization', label: t('careProvider.typeOrganization') }
    ];

    const getTypeLabel = (value: ProviderType): string => {
        return typeOptions.find(o => o.value === value)?.label ?? t('careProvider.typeUnknown');
    };

    const [providerType, setProviderType] = useState<ProviderType>('practitioner');
    const [name, setName] = useState('');
    const [specialty, setSpecialty] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [city, setCity] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [country, setCountry] = useState(params.country || 'DE');
    const [isSaving, setIsSaving] = useState(false);

    // Listen for country selection
    useEffect(() => {
        const unsubscribe = on('country:selected', (code: string) => {
            setCountry(code);
        });
        return () => unsubscribe();
    }, []);

    // Load existing data in edit mode
    useEffect(() => {
        if (!isEditMode) {
            return;
        }
        const resourceType = params.type === 'organization' ? 'Organization' : 'Practitioner';
        setProviderType(params.type === 'organization' ? 'organization' : 'practitioner');

        (async () => {
            try {
                const row = await fhirRepo.get(resourceType, params.id!);
                if (!row || row.deleted) {
                    return;
                }

                if (resourceType === 'Practitioner') {
                    const p = row.resource as FhirPractitioner;
                    const displayName = p.name?.[0]?.text ||
                        [p.name?.[0]?.given?.join(' '), p.name?.[0]?.family].filter(Boolean).join(' ') || '';
                    setName(displayName);
                    setSpecialty(p.qualification?.[0]?.code?.text || '');
                    setPhone(p.telecom?.find(tel => tel.system === 'phone')?.value || '');
                    const addr = p.address?.[0];
                    setAddress(addr?.line?.join(', ') || '');
                    setCity(addr?.city || '');
                    setPostalCode(addr?.postalCode || '');
                    if (addr?.country) {
                        setCountry(addr.country);
                    }
                } else {
                    const o = row.resource as FhirOrganization;
                    setName(o.name || '');
                    setSpecialty(o.type?.[0]?.text || '');
                    setPhone(o.telecom?.find(tel => tel.system === 'phone')?.value || '');
                    const addr = o.address?.[0];
                    setAddress(addr?.line?.join(', ') || '');
                    setCity(addr?.city || '');
                    setPostalCode(addr?.postalCode || '');
                    if (addr?.country) {
                        setCountry(addr.country);
                    }
                }
            }
            catch (e) {
                console.error('Failed to load provider for edit:', e);
            }
        })();
    }, []);

    const showTypePicker = useCallback(() => {
        if (Platform.OS === 'ios') {
            const { ActionSheetIOS } = require('react-native');
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options: [t('common.cancel'), ...typeOptions.map(o => o.label)],
                    cancelButtonIndex: 0
                },
                (buttonIndex) => {
                    if (buttonIndex > 0) {
                        setProviderType(typeOptions[buttonIndex - 1].value);
                    }
                }
            );
        } else {
            Alert.alert(
                t('careProvider.selectType'),
                t('careProvider.selectTypeMessage'),
                typeOptions.map(o => ({
                    text: o.label,
                    onPress: () => setProviderType(o.value)
                }))
            );
        }
    }, [t, typeOptions]);

    const handleSelectCountry = useCallback(() => {
        router.push({
            pathname: '/settings/profile/countryPicker',
            params: { selected: country, prioritizeForLanguage: getCurrentLanguage() }
        });
    }, [country]);

    const handleSave = useCallback(async () => {
        if (!name.trim()) {
            Alert.alert(t('common.error'), t('careProvider.enterName'));
            return;
        }

        setIsSaving(true);

        try {
            if (providerType === 'practitioner') {
                const nameParts = name.trim().split(' ');
                const family = nameParts.pop() || '';
                const given = nameParts;

                const practitioner: FhirPractitioner = {
                    resourceType: 'Practitioner',
                    id: isEditMode ? params.id! : Crypto.randomUUID(),
                    name: [{ text: name.trim(), family, given }],
                    telecom: phone.trim() ? [{ system: 'phone', value: phone.trim() }] : undefined,
                    address: [{
                        line: address.trim() ? [address.trim()] : undefined,
                        city: city.trim() || undefined,
                        postalCode: postalCode.trim() || undefined,
                        country: country
                    }],
                    qualification: specialty.trim() ? [{ code: { text: specialty.trim() } }] : undefined,
                    extension: [{ url: CUSTOM_ENTRY_EXTENSION_URL, valueBoolean: true }],
                    meta: { lastUpdated: nowIso() }
                };

                await fhirRepo.upsert('Practitioner', practitioner.id, practitioner, practitioner.meta?.lastUpdated);
            } else {
                const organization: FhirOrganization = {
                    resourceType: 'Organization',
                    id: isEditMode ? params.id! : Crypto.randomUUID(),
                    name: name.trim(),
                    type: specialty.trim() ? [{ text: specialty.trim() }] : undefined,
                    telecom: phone.trim() ? [{ system: 'phone', value: phone.trim() }] : undefined,
                    address: [{
                        line: address.trim() ? [address.trim()] : undefined,
                        city: city.trim() || undefined,
                        postalCode: postalCode.trim() || undefined,
                        country: country
                    }],
                    extension: [{ url: CUSTOM_ENTRY_EXTENSION_URL, valueBoolean: true }],
                    meta: { lastUpdated: nowIso() }
                };

                await fhirRepo.upsert('Organization', organization.id, organization, organization.meta?.lastUpdated);
            }

            if (syncEnabled) {
                await fullSync(isEditMode ? 'care provider edit' : 'care provider add custom');
            }

            if (isEditMode) {
                router.back();
            } else {
                // Go back two screens (to careProviders list)
                router.dismiss(2);
            }
        }
        catch (e: any) {
            Alert.alert(t('common.error'), e?.message ?? String(e));
        }
        finally {
            setIsSaving(false);
        }
    }, [providerType, name, specialty, phone, address, city, postalCode, country, fhirRepo, syncEnabled, fullSync, isEditMode, params.id]);

    const handleDelete = useCallback(() => {
        Alert.alert(
            t('careProvider.deleteProviderTitle'),
            t('careProvider.deleteProviderMessage'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const resourceType = providerType === 'practitioner' ? 'Practitioner' : 'Organization';
                            await fhirRepo.markDeleted(resourceType, params.id!);

                            if (syncEnabled) {
                                await fullSync('care provider delete');
                            }

                            // Back to list (dismiss edit modal + detail)
                            router.dismiss(2);
                        }
                        catch (e: any) {
                            Alert.alert(t('common.error'), e?.message ?? String(e));
                        }
                    }
                }
            ]
        );
    }, [providerType, params.id, fhirRepo, syncEnabled, fullSync, t]);

    return (
        <>
            {
                Platform.OS === 'android' ? (
                    <Stack.Screen
                        options={ {
                            headerTransparent: false,
                            headerBackVisible: false,
                            title: isEditMode ? t('careProvider.editProvider') : t('navigation.addCareProvider'),
                            headerLeft: () => (
                                <CloseButton onPress={ () => router.back() } />
                            ),
                            headerRight: () => (
                                <HeaderButton
                                    onPress={ handleSave }
                                    icon="checkmark"
                                    variant="done"
                                    disabled={ isSaving }
                                />
                            )
                        } }
                    />
                ) : (
                    <>
                        <Stack.Screen.Title>{ isEditMode ? t('careProvider.editProvider') : t('navigation.addCareProvider') }</Stack.Screen.Title>
                        <Stack.Toolbar placement="left">
                            <Stack.Toolbar.Button icon="xmark" variant="plain" onPress={ () => router.back() } />
                        </Stack.Toolbar>
                        <Stack.Toolbar placement="right">
                            <Stack.Toolbar.Button icon="checkmark" variant="done" onPress={ handleSave } disabled={ isSaving } />
                        </Stack.Toolbar>
                    </>
                )
            }

            <ScrollView
                style={ { backgroundColor: colors.modalBackground } }
                contentContainerStyle={ styles.scrollView }
                contentInsetAdjustmentBehavior="automatic"
                keyboardShouldPersistTaps="handled"
            >
                <ScrollViewContent>
                    <List.Wrapper rounded>
                        <Text style={ [styles.headerText, { color: colors.textSecondary }] }>
                            { t(isEditMode ? 'careProvider.editHeaderText' : 'careProvider.addHeaderText') }
                        </Text>
                    </List.Wrapper>

                    {/* Type Selection */ }
                    <List.Section title={ t('careProvider.type') } rounded>
                        <List.Item
                            title={ t('careProvider.type') }
                            rightTitle={ getTypeLabel(providerType) }
                            onPress={ isEditMode ? undefined : showTypePicker }
                            hideChevron={ isEditMode }
                            lastItem
                        />
                    </List.Section>

                    {/* Basic Info */ }
                    <List.Section title={ t('careProvider.information') } rounded>
                        <List.InputItem
                            label={ t('careProvider.name') }
                            required={ true }
                            value={ name }
                            onChangeText={ setName }
                            placeholder={ providerType === 'practitioner' ? t('careProvider.namePlaceholderPractitioner') : t('careProvider.namePlaceholderOrganization') }
                            autoCapitalize="words"
                            inline
                        />
                        <List.InputItem
                            label={ t('careProvider.specialty') }
                            value={ specialty }
                            onChangeText={ setSpecialty }
                            placeholder={ t('careProvider.specialtyPlaceholder') }
                            autoCapitalize="words"
                            inline
                        />
                        <List.InputItem
                            label={ t('careProvider.phone') }
                            value={ phone }
                            onChangeText={ setPhone }
                            placeholder={ t('careProvider.phonePlaceholder') }
                            keyboardType="phone-pad"
                            inline
                        />
                    </List.Section>

                    {/* Address */ }
                    <List.Section title={ t('careProvider.address') } rounded>
                        <List.InputItem
                            label={ t('careProvider.street') }
                            value={ address }
                            onChangeText={ setAddress }
                            placeholder={ t('careProvider.streetPlaceholder') }
                            autoCapitalize="words"
                        />
                        <List.InputItem
                            label={ t('careProvider.postalCode') }
                            value={ postalCode }
                            onChangeText={ setPostalCode }
                            placeholder={ t('careProvider.postalCodePlaceholder') }
                            keyboardType="number-pad"
                            inline
                        />
                        <List.InputItem
                            label={ t('careProvider.city') }
                            value={ city }
                            onChangeText={ setCity }
                            placeholder={ t('careProvider.cityPlaceholder') }
                            autoCapitalize="words"
                            inline
                        />
                        <List.Item
                            title={ t('careProvider.country') }
                            rightTitle={ getCountryLabel(country) }
                            onPress={ handleSelectCountry }
                        />
                    </List.Section>

                    <List.Wrapper>
                        <List.Text textStyle={ { color: colors.textHint } }>
                            { t('careProvider.requiredField') }
                        </List.Text>
                    </List.Wrapper>

                    { isEditMode && (
                        <>
                            <Space size="2xl" />
                            <List.Wrapper>
                                <Button
                                    title={ t('careProvider.deleteProvider') }
                                    onPress={ handleDelete }
                                    variant="danger"
                                    rounded
                                />
                                <List.Text>
                                    { t('careProvider.deleteProviderHint') }
                                </List.Text>
                            </List.Wrapper>
                        </>
                    ) }
                </ScrollViewContent>
            </ScrollView>
        </>
    );
}

const styles = StyleSheet.create({

    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    headerText: {
        fontSize: 17,
        lineHeight: 22,
        fontWeight: 500
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12
    },
    inputLabel: {
        fontSize: 17,
        width: 120
    },
    textInput: {
        flex: 1,
        fontSize: 17,
        textAlign: 'right',
        paddingVertical: 8
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        marginLeft: 16
    }
});
