/**
 * Add Patient Screen - For caregivers to add a new patient.
 *
 * Allows creating a new patient or linking to an existing account.
 */
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { useAppTheme } from '@/src/theme';
import { Button, List, Space } from 'react-native-nice-ui';
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { CloseButton } from "@/src/components/ui/navigation/CloseButton";
import { useAppRole } from "@/src/context/AppRoleProvider";

type AddMode = 'select' | 'create' | 'link';

export default function PatientsAddScreen() {
    const { t } = useTranslation();
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();

    const { role } = useAppRole();
    const [mode, setMode] = useState<AddMode>('select');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [patientName, setPatientName] = useState('');

    const handleCreatePatient = useCallback(() => {
        if (!patientName.trim()) {
            setError(t('patientsAdd.enterName'));
            return;
        }
        router.push({
            pathname: '/settings/patients/mnemonic',
            params: { patientName: patientName.trim() },
        });
    }, [patientName, t]);

    const handleLinkPatient = useCallback(() => {
        router.push({
            pathname: '/settings/patients/link',
            params: { expectedRole: role === 'doctor' ? 'doctor' : 'caregiver' },
        });
    }, [role, router]);

    return (
        <>
            {
                Platform.OS === 'android' ? (
                    <Stack.Screen
                        options={ {
                            headerRight: () => (
                                <CloseButton onPress={ () => router.back() } />
                            )
                        } }
                    />
                ) : (
                        <Stack.Toolbar placement="right">
                            <Stack.Toolbar.Button icon="xmark" variant="plain" onPress={() => router.back()} />
                        </Stack.Toolbar>
                )
            }

            { mode === 'select' ? (
                <View style={ [styles.container, { backgroundColor: colors.modalBackground }] }>
                    <ScrollView
                        contentContainerStyle={ styles.scrollContent }
                        keyboardShouldPersistTaps="handled"
                        contentInsetAdjustmentBehavior="automatic"
                    >
                        <ScreenHeader
                            icon="person.badge.plus"
                            iconTintColor={ colors.brandColorMuted }
                            title={t('patientsAdd.addPatient')}
                            subtitle={t('patientsAdd.howToAdd')}
                        />

                        <List.Section rounded spaced>
                            { role !== 'doctor' && (
                                <List.Item
                                    title={t('patientsAdd.createNew')}
                                    titleNumberOfLines={ 2 }
                                    titleStyle={ { fontWeight: '600' } }
                                    subtitle={t('patientsAdd.createNewSubtitle')}
                                    onPress={ () => setMode('create') }
                                    leftCmpSize={56}
                                    leftCmp={
                                        <ListItemIcon name="person.badge.plus" color={colors.brandColorMuted} size="lg" backgroundColor={colors.listItemBackgroundMuted} />
                                    }
                                />
                            ) }

                            <List.Item
                                title={t('patientsAdd.linkExisting')}
                                titleNumberOfLines={ 2 }
                                titleStyle={ { fontWeight: '600' } }
                                subtitle={t('patientsAdd.linkExistingSubtitle')}
                                onPress={ handleLinkPatient }
                                leftCmpSize={56}
                                leftCmp={
                                    <ListItemIcon name="qrcode.viewfinder" color={colors.brandColorMuted} size="lg" backgroundColor={colors.listItemBackgroundMuted} />
                                }
                            />
                        </List.Section>

                    </ScrollView>
                </View>
            ) : (
                // Create Patient Screen
                <KeyboardAvoidingView
                    style={ [styles.container, { backgroundColor: colors.modalBackground }] }
                    behavior={ Platform.OS === 'ios' ? 'padding' : 'height' }
                >
                    <ScrollView
                        contentContainerStyle={ styles.scrollContent }
                        keyboardShouldPersistTaps="handled"
                        contentInsetAdjustmentBehavior="automatic"
                    >
                        <ScreenHeader
                            icon="person.badge.plus"
                            iconTintColor={ colors.brandColorMuted }
                            title={t('patientsAdd.createTitle')}
                            subtitle={t('patientsAdd.createSubtitle')}
                        />

                        <Space />

                        <View style={ styles.content }>

                            <View style={ styles.inputSection }>
                                <Text style={ [styles.inputLabel, { color: colors.text }] }>
                                    {t('patientsAdd.whoAreYouCaringFor')}
                                </Text>
                                <TextInput
                                    style={ [
                                        styles.textInput,
                                        {
                                            backgroundColor: colors.listItemBackground,
                                            color: colors.text,
                                            borderColor: error && !patientName.trim() ? '#FF3B30' : colors.listItemBackground
                                        }
                                    ] }
                                    placeholder={t('patientsAdd.namePlaceholder')}
                                    placeholderTextColor={ colors.textHint }
                                    value={ patientName }
                                    onChangeText={ setPatientName }
                                    autoCapitalize="words"
                                    autoCorrect={ false }
                                    autoFocus
                                />
                                <Text style={ [styles.inputHint, { color: colors.textHint }] }>
                                    {t('patientsAdd.nameLocalHint')}
                                </Text>
                            </View>

                            <View style={ styles.features }>
                                <FeatureItem
                                    icon="key.fill"
                                    text={t('patientsAdd.featureOwnKey')}
                                    colors={ colors }
                                />
                                <FeatureItem
                                    icon="lock.fill"
                                    text={t('patientsAdd.featureEncrypted')}
                                    colors={ colors }
                                />
                            </View>

                            { error && (
                                <View style={ [styles.errorContainer, { backgroundColor: '#FF3B3015' }] }>
                                    <Text style={ [styles.errorText, { color: '#FF3B30' }] }>
                                        { error }
                                    </Text>
                                </View>
                            ) }
                        </View>
                    </ScrollView>

                    <View style={ [styles.footer, { paddingBottom: insets.bottom + 20 }] }>
                        <View style={ styles.footerButtons }>
                            <Button
                                title={ isLoading ? '' : t('patientsAdd.createButton') }
                                onPress={ handleCreatePatient }
                                disabled={ isLoading }
                                rounded
                                style={ styles.primaryButton }
                                leftIcon={ isLoading ? <ActivityIndicator color="white" /> : undefined }
                            />
                        </View>
                    </View>
                </KeyboardAvoidingView>
            ) }
        </>
    )
}

function FeatureItem({
                         icon,
                         text,
                         colors
                     }: {
    icon: string;
    text: string;
    colors: any;
}) {
    return (
        <View style={ styles.featureItem }>
            <AppIcon
                name={ icon }
                tintColor={ colors.brandColorMuted }
                size={ 20 }
            />
            <Text style={ [styles.featureText, { color: colors.text }] }>
                { text }
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    scrollContent: {
        flexGrow: 1
    },
    content: {
        // flex: 1,
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingTop: 10
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 12,
        textAlign: 'center'
    },
    description: {
        fontSize: 16,
        lineHeight: 24,
        textAlign: 'center'
    },
    optionContent: {
        flex: 1
    },
    optionTitle: {
        fontSize: 17,
        fontWeight: '600',
        marginBottom: 4
    },
    optionDescription: {
        fontSize: 14,
        lineHeight: 20
    },
    inputSection: {
        alignSelf: 'stretch',
        marginBottom: 32
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8
    },
    textInput: {
        fontSize: 17,
        padding: 16,
        borderRadius: 12,
        borderWidth: 2
    },
    inputHint: {
        fontSize: 13,
        marginTop: 8,
        lineHeight: 18
    },
    features: {
        alignSelf: 'stretch',
        gap: 16
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    featureText: {
        fontSize: 16
    },
    errorContainer: {
        marginTop: 24,
        padding: 16,
        borderRadius: 12,
        alignSelf: 'stretch'
    },
    errorText: {
        fontSize: 14,
        textAlign: 'center'
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 16
    },
    footerButtons: {
        flexDirection: 'row',
        gap: 12
    },
    backButton: {
        flex: 0
    },
    primaryButton: {
        flex: 1
    }
});
