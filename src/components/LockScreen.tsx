import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/src/components/ui/AppIcon';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAppTheme } from '@/src/theme';
import { useAuthLock } from '@/src/context/AuthLockProvider';

export function LockScreen() {
    const { colors } = useAppTheme();
    const { unlock, isAuthenticating, biometryType } = useAuthLock();

    // Automatically prompt for authentication on mount
    useEffect(() => {
        unlock();
    }, []);

    const getBiometryIcon = (): string => {
        if (biometryType === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) {
            return 'faceid';
        }
        if (biometryType === LocalAuthentication.AuthenticationType.FINGERPRINT) {
            return 'touchid';
        }
        return 'lock.fill';
    };

    const getBiometryLabel = (): string => {
        if (biometryType === LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) {
            return 'Mit Face ID entsperren';
        }
        if (biometryType === LocalAuthentication.AuthenticationType.FINGERPRINT) {
            return 'Mit Touch ID entsperren';
        }
        return 'Entsperren';
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.content}>
                <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
                    <AppIcon
                        name={getBiometryIcon()}
                        tintColor={colors.primary}
                        size={48}
                    />
                </View>

                <Text style={[styles.title, { color: colors.text }]}>
                    App gesperrt
                </Text>

                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Authentifiziere dich, um fortzufahren
                </Text>
            </View>

            <View style={styles.footer}>
                <Pressable
                    style={({ pressed }) => [
                        styles.unlockButton,
                        {
                            backgroundColor: colors.primary,
                            opacity: pressed || isAuthenticating ? 0.8 : 1,
                        },
                    ]}
                    onPress={unlock}
                    disabled={isAuthenticating}
                >
                    {isAuthenticating ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <AppIcon
                                name={getBiometryIcon()}
                                tintColor="white"
                                size={20}
                            />
                            <Text style={styles.unlockButtonText}>
                                {getBiometryLabel()}
                            </Text>
                        </>
                    )}
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
    },
    footer: {
        paddingHorizontal: 32,
        paddingBottom: 48,
    },
    unlockButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 14,
        gap: 10,
    },
    unlockButtonText: {
        color: 'white',
        fontSize: 17,
        fontWeight: '600',
    },
});
