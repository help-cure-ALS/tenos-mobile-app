/**
 * Minimal transient toast, driven via the app bus:
 *
 *   emit('toast:show', { message: '...' });
 *
 * Non-blocking (unlike Alert), fades in at the bottom and auto-dismisses
 * after a few seconds. Mounted once in the root layout.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/src/theme';
import { on } from '@/src/lib/bus';

const SHOW_MS = 4000;

export type ToastPayload = { message: string };

export function ToastHost() {
    const { colors } = useAppTheme();
    const insets = useSafeAreaInsets();
    const [message, setMessage] = useState<string | null>(null);
    const opacity = useRef(new Animated.Value(0)).current;
    const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return on<ToastPayload>('toast:show', (payload) => {
            if (!payload?.message) return;
            if (hideTimerRef.current) clearTimeout(hideTimerRef.current);

            setMessage(payload.message);
            Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();

            hideTimerRef.current = setTimeout(() => {
                Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true })
                    .start(({ finished }) => {
                        if (finished) setMessage(null);
                    });
            }, SHOW_MS);
        });
    }, [opacity]);

    useEffect(() => () => {
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    }, []);

    if (!message) return null;

    return (
        <Animated.View
            pointerEvents="none"
            style={[
                styles.container,
                {
                    bottom: insets.bottom + 90,
                    backgroundColor: colors.text,
                    opacity,
                },
            ]}
        >
            <Text style={[styles.message, { color: colors.background }]} numberOfLines={2}>
                {message}
            </Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 24,
        right: 24,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },
    message: {
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
    },
});
