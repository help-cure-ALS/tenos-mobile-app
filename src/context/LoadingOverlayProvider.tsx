import React, { createContext, useCallback, useContext, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/src/theme';

type LoadingOverlayContextValue = {
    visible: boolean;
    showLoading(): void;
    hideLoading(): void;
};

const LoadingOverlayContext = createContext<LoadingOverlayContextValue | null>(null);

export function LoadingOverlayProvider({ children }: { children: React.ReactNode }) {
    const [visible, setVisible] = useState(false);

    const showLoading = useCallback(() => setVisible(true), []);
    const hideLoading = useCallback(() => setVisible(false), []);

    return (
        <LoadingOverlayContext.Provider value={{ visible, showLoading, hideLoading }}>
            {children}
        </LoadingOverlayContext.Provider>
    );
}

export function useLoadingOverlay() {
    const context = useContext(LoadingOverlayContext);
    if (!context) {
        throw new Error('useLoadingOverlay must be used within a LoadingOverlayProvider');
    }
    return context;
}

export function LoadingOverlay() {
    const { visible } = useLoadingOverlay();
    const { colors } = useAppTheme();

    if (!visible) return null;

    return (
        <View style={[styles.overlay, { backgroundColor: colors.background }]}>
            <ActivityIndicator color={colors.textSecondary} />
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFill,
        zIndex: 1000,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
