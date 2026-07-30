/**
 * Blocking full-screen shown when the installed binary is below the
 * server-defined minimum version (see services/appVersionGate.ts).
 * Rendered INSTEAD of the navigator, so nothing else is reachable.
 * The only action is opening the platform store page.
 */
import React from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/src/theme';

type ForceUpdateScreenProps = {
    storeUrl: string | null;
};

export function ForceUpdateScreen({ storeUrl }: ForceUpdateScreenProps) {
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();

    return (
        <View
            style={ [
                styles.container,
                {
                    backgroundColor: colors.mainBackground,
                    paddingTop: insets.top + 24,
                    paddingBottom: insets.bottom + 24
                }
            ] }
        >
            <View style={ styles.content }>
                <Text style={ [styles.title, { color: colors.text }] }>
                    { t('forceUpdate.title') }
                </Text>
                <Text style={ [styles.message, { color: colors.placeholder }] }>
                    { t('forceUpdate.message') }
                </Text>
            </View>
            { storeUrl && (
                <TouchableOpacity
                    style={ [styles.button, { backgroundColor: colors.primary }] }
                    onPress={ () => {
                        Linking.openURL(storeUrl).catch(() => {
                        });
                    } }
                    activeOpacity={ 0.8 }
                >
                    <Text style={ styles.buttonLabel }>
                        { t('forceUpdate.button') }
                    </Text>
                </TouchableOpacity>
            ) }
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 32,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    title: {
        fontSize: 22,
        fontWeight: '600',
        textAlign: 'center',
    },
    message: {
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
    },
    button: {
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
    },
    buttonLabel: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
});
