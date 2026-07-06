import React, {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useMemo,
    useState
} from 'react';
import { Platform, StatusBar, useColorScheme as useRNColorScheme } from 'react-native';
import { NavigationBar } from 'expo-navigation-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    ThemeProvider as NavigationThemeProvider,
    DefaultTheme,
    DarkTheme
} from "expo-router/react-navigation";

import { UIThemeProvider } from 'react-native-nice-ui';
import type { ThemeName, CustomStyles, CustomVariants } from 'react-native-nice-ui';

import { lightColors, darkColors } from './colors';
import type { AppColors } from './colors.app';
import { tokens } from './tokens';
import type { AppTokens } from './tokens.app';

export type DeviceTheme = 'automatic' | 'light' | 'dark';

const STORAGE_KEY_DEVICE_THEME = 'deviceTheme';

export interface AppThemeContextType {
    themeName: ThemeName;
    deviceTheme: DeviceTheme;
    colorScheme: ThemeName;
    isDark: boolean;
    colors: AppColors;
    tokens: AppTokens;

    setDeviceTheme: (theme: DeviceTheme) => Promise<boolean>;
    toggleTheme: () => void;
}

const AppThemeContext = createContext<AppThemeContextType | undefined>(undefined);

function toNavigationTheme(colors: AppColors, isDark: boolean) {
    const base = isDark ? DarkTheme : DefaultTheme;

    return {
        ...base,
        dark: isDark,
        colors: {
            ...base.colors,
            primary: colors.tint ?? colors.primary,
            background: colors.mainBackground ?? colors.background,
            card: colors.card,
            text: colors.text,
            border: colors.border,
            notification: colors.accent ?? colors.error ?? colors.primary
        }
    };
}

function isDeviceTheme(v: string | null): v is DeviceTheme {
    return v === 'automatic' || v === 'light' || v === 'dark';
}

const customStyles: CustomStyles = {
    listSectionTitle: ({ colors }) => ({
        fontSize: 18,
        fontWeight: '700',
        color: colors.textSecondary
    })
};

const customVariants: CustomVariants = {
    tinted: ({ pressed, colors: c }) => {
        const colors = c as AppColors;
        return {
            container: {
                backgroundColor: colors.brandColor + '20',
                opacity: pressed ? 0.85 : 1
            },
            text: {
                color: colors.brandColor
            }
        };
    },
    danger: ({ pressed, colors: c }) => {
        const colors = c as AppColors;
        return {
            container: {
                backgroundColor: colors.listItemBackground,
                opacity: pressed ? 0.85 : 1
            },
            text: {
                color: colors.red
            }
        };
    }
};

export function AppThemeProvider({ children }: { children: ReactNode }) {
    const rnScheme = useRNColorScheme();
    const colorScheme: ThemeName = rnScheme === 'dark' ? 'dark' : 'light';

    const [deviceTheme, setDeviceThemeState] =
        useState<DeviceTheme>('automatic');

    const themeName: ThemeName =
        deviceTheme === 'automatic' ? colorScheme : deviceTheme;

    const isDark = themeName === 'dark';
    const colors: AppColors = isDark ? darkColors : lightColors;

    useEffect(() => {
        (async () => {
            const saved = await AsyncStorage.getItem(STORAGE_KEY_DEVICE_THEME);

            if (isDeviceTheme(saved) && saved !== 'automatic') {
                setDeviceThemeState(saved);
            } else {
                setDeviceThemeState('automatic');
            }
        })();
    }, []);

    // Keep Android system navigation bar button style in sync with theme
    useEffect(() => {
        if (Platform.OS === 'android') {
            NavigationBar.setStyle(isDark ? 'light' : 'dark');
        }
    }, [isDark]);

    const setDeviceTheme = async (next: DeviceTheme) => {
        setDeviceThemeState(next);

        try {
            if (next === 'automatic') {
                await AsyncStorage.removeItem(STORAGE_KEY_DEVICE_THEME);
            } else {
                await AsyncStorage.setItem(STORAGE_KEY_DEVICE_THEME, next);
            }
            return true;
        }
        catch {
            return false;
        }
    };

    const toggleTheme = () => {
        if (deviceTheme === 'automatic') {
            setDeviceTheme('dark');
        } else {
            setDeviceTheme(themeName === 'dark' ? 'light' : 'dark');
        }
    };

    const ctxValue = useMemo<AppThemeContextType>(
        () => ({
            themeName,
            deviceTheme,
            colorScheme,
            isDark,
            colors,
            tokens,
            setDeviceTheme,
            toggleTheme
        }),
        [themeName, deviceTheme, colorScheme, isDark, colors]
    );

    const navigationTheme = useMemo(
        () => toNavigationTheme(colors, isDark),
        [colors, isDark]
    );

    return (
        <AppThemeContext.Provider value={ ctxValue }>
            <UIThemeProvider
                themeName={ themeName }
                colors={ colors }
                tokens={ tokens }
                customStyles={ customStyles }
                customVariants={ customVariants }
            >
                <NavigationThemeProvider value={ navigationTheme }>
                    <StatusBar
                        backgroundColor={ colors.statusBar }
                        barStyle={ colors.statusBarStyle }
                    />
                    { children }
                </NavigationThemeProvider>
            </UIThemeProvider>
        </AppThemeContext.Provider>
    );
}

export function useAppTheme(): AppThemeContextType {
    const ctx = useContext(AppThemeContext);
    if (!ctx) {
        throw new Error('useAppTheme must be used within AppThemeProvider');
    }
    return ctx;
}
