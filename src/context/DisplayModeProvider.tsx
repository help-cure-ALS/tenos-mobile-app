import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAppRole } from './AppRoleProvider';
import { on } from '@/src/lib/bus';
import type { AppRole } from '@/src/types/appRole';

// Storage key
const DISPLAY_MODE_STORAGE_KEY = 'display_mode_v1';
const DISPLAY_PREFS_STORAGE_KEY = 'display_preferences_v1';

/**
 * Display modes for health data visualization
 * - clinical: Full data with colors and trends (for healthcare professionals)
 * - comfort: Reduced information without evaluative elements (for patients)
 * - minimal: Just the scores, no evaluation or comparisons (for patients who prefer minimal info)
 */
export type DisplayMode = 'clinical' | 'comfort' | 'minimal';

/**
 * Granular preferences for what to show/hide
 */
export type DisplayPreferences = {
    /** Show numerical scores (e.g., "38/48") */
    showScores: boolean;
    /** Show individual domain scores */
    showDomainScores: boolean;
    /** Show trend arrows (up/down/stable) */
    showTrends: boolean;
    /** Show progression rate (Verlaufswert) */
    showProgressRate: boolean;
    /** Show score changes (e.g., "-2 in 30 Tagen") */
    showScoreChanges: boolean;
    /** Show progress bars */
    showProgressBars: boolean;
    /** Use signal colors (red/orange/green) */
    useSignalColors: boolean;
    /** Show status labels (e.g., "Erhöht", "Normal") */
    showStatusLabels: boolean;
};

/**
 * Default preferences for each display mode
 */
const MODE_DEFAULTS: Record<DisplayMode, DisplayPreferences> = {
    clinical: {
        showScores: true,
        showDomainScores: true,
        showTrends: true,
        showProgressRate: true,
        showScoreChanges: true,
        showProgressBars: true,
        useSignalColors: true,
        showStatusLabels: true,
    },
    comfort: {
        showScores: true,
        showDomainScores: true,
        showTrends: false,
        showProgressRate: false,
        showScoreChanges: false,
        showProgressBars: true,
        useSignalColors: false,
        showStatusLabels: false,
    },
    minimal: {
        showScores: true,
        showDomainScores: false,
        showTrends: false,
        showProgressRate: false,
        showScoreChanges: false,
        showProgressBars: false,
        useSignalColors: false,
        showStatusLabels: false,
    },
};

/**
 * Get the default display mode for a given role
 */
function getDefaultModeForRole(role: AppRole | null): DisplayMode {
    switch (role) {
        case 'doctor':
            return 'clinical';
        case 'caregiver':
            return 'comfort';
        case 'patient':
            return 'comfort';
        case 'demo':
            return 'clinical';
        default:
            return 'comfort';
    }
}

/**
 * Trend display information
 */
export type TrendDisplayInfo = {
    icon: string;
    color: string;
    label: string;
};

/**
 * Context value type
 */
export type DisplayModeContextValue = {
    /** Current effective display mode */
    mode: DisplayMode;

    /** Whether the mode has been overridden from the role default */
    isOverridden: boolean;

    /** The default mode based on the current role */
    defaultMode: DisplayMode;

    /** Current effective preferences (from mode or custom overrides) */
    preferences: DisplayPreferences;

    /** Whether individual preferences have been customized */
    hasCustomPreferences: boolean;

    /** Loading state */
    isLoading: boolean;

    /**
     * Set the display mode
     * Pass 'default' to reset to role-based default
     */
    setMode(mode: DisplayMode | 'default'): Promise<void>;

    /**
     * Set an individual preference (creates custom preferences)
     */
    setPreference<K extends keyof DisplayPreferences>(
        key: K,
        value: DisplayPreferences[K]
    ): Promise<void>;

    /**
     * Reset all custom preferences to mode defaults
     */
    resetPreferences(): Promise<void>;

    /**
     * Get a score color based on current preferences
     * Returns neutral color if useSignalColors is false
     */
    getScoreColor(score: number, maxScore: number, neutralColor: string): string;

    /**
     * Get trend display info based on current preferences
     * Returns null if trends are disabled
     */
    getTrendDisplay(trend: 'up' | 'down' | 'stable'): TrendDisplayInfo | null;

    /**
     * Get status color based on current preferences
     */
    getStatusColor(status: 'normal' | 'elevated' | 'low' | 'critical', neutralColor: string): string;
};

const DisplayModeContext = createContext<DisplayModeContextValue | null>(null);

type DisplayModeProviderProps = {
    children: React.ReactNode;
};

type PersistedState = {
    mode: DisplayMode | null; // null means use role default
    customPreferences: Partial<DisplayPreferences> | null;
};

export function DisplayModeProvider({ children }: DisplayModeProviderProps) {
    const { role } = useAppRole();

    const [isLoading, setIsLoading] = useState(true);
    const [modeOverride, setModeOverride] = useState<DisplayMode | null>(null);
    const [customPreferences, setCustomPreferences] = useState<Partial<DisplayPreferences> | null>(null);

    // Load persisted state on mount + re-read when preferences change externally
    useEffect(() => {
        loadPersistedState();
        const off = on('preferences:changed', () => loadPersistedState());
        return () => off();
    }, []);

    const loadPersistedState = async () => {
        try {
            const modeJson = await SecureStore.getItemAsync(DISPLAY_MODE_STORAGE_KEY);
            if (modeJson) {
                const mode = JSON.parse(modeJson) as DisplayMode | null;
                setModeOverride(mode);
            }

            const prefsJson = await SecureStore.getItemAsync(DISPLAY_PREFS_STORAGE_KEY);
            if (prefsJson) {
                const prefs = JSON.parse(prefsJson) as Partial<DisplayPreferences> | null;
                setCustomPreferences(prefs);
            }
        } catch (e) {
            console.error('Failed to load display mode settings:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const persistMode = async (mode: DisplayMode | null) => {
        try {
            if (mode !== null) {
                await SecureStore.setItemAsync(DISPLAY_MODE_STORAGE_KEY, JSON.stringify(mode));
            } else {
                await SecureStore.deleteItemAsync(DISPLAY_MODE_STORAGE_KEY);
            }
        } catch (e) {
            console.error('Failed to persist display mode:', e);
        }
    };

    const persistPreferences = async (prefs: Partial<DisplayPreferences> | null) => {
        try {
            if (prefs !== null && Object.keys(prefs).length > 0) {
                await SecureStore.setItemAsync(DISPLAY_PREFS_STORAGE_KEY, JSON.stringify(prefs));
            } else {
                await SecureStore.deleteItemAsync(DISPLAY_PREFS_STORAGE_KEY);
            }
        } catch (e) {
            console.error('Failed to persist display preferences:', e);
        }
    };

    // Computed values
    const defaultMode = useMemo(() => getDefaultModeForRole(role), [role]);

    const mode = useMemo(() => modeOverride ?? defaultMode, [modeOverride, defaultMode]);

    const isOverridden = useMemo(() => modeOverride !== null, [modeOverride]);

    const hasCustomPreferences = useMemo(
        () => customPreferences !== null && Object.keys(customPreferences).length > 0,
        [customPreferences]
    );

    const preferences = useMemo<DisplayPreferences>(() => {
        const modeDefaults = MODE_DEFAULTS[mode];
        if (!customPreferences) {
            return modeDefaults;
        }
        return { ...modeDefaults, ...customPreferences };
    }, [mode, customPreferences]);

    // Actions
    const setMode = useCallback(async (newMode: DisplayMode | 'default') => {
        const modeToSet = newMode === 'default' ? null : newMode;
        setModeOverride(modeToSet);
        await persistMode(modeToSet);

        // Reset custom preferences when changing mode
        setCustomPreferences(null);
        await persistPreferences(null);
    }, []);

    const setPreference = useCallback(async <K extends keyof DisplayPreferences>(
        key: K,
        value: DisplayPreferences[K]
    ) => {
        const newPrefs = { ...customPreferences, [key]: value };
        setCustomPreferences(newPrefs);
        await persistPreferences(newPrefs);
    }, [customPreferences]);

    const resetPreferences = useCallback(async () => {
        setCustomPreferences(null);
        await persistPreferences(null);
    }, []);

    // Helper functions
    const getScoreColor = useCallback((score: number, maxScore: number, neutralColor: string): string => {
        if (!preferences.useSignalColors) {
            return neutralColor;
        }

        const percentage = score / maxScore;
        if (percentage >= 0.75) {
            return '#399B65'; // Green
        }
        if (percentage >= 0.5) {
            return '#FF9500'; // Orange
        }
        if (percentage >= 0.25) {
            return '#FF6B00'; // Dark Orange
        }
        return '#F9154A'; // Red
    }, [preferences.useSignalColors]);

    const getTrendDisplay = useCallback((trend: 'up' | 'down' | 'stable'): TrendDisplayInfo | null => {
        if (!preferences.showTrends) {
            return null;
        }

        switch (trend) {
            case 'up':
                return {
                    icon: 'arrow.up',
                    color: preferences.useSignalColors ? '#34C759' : '#8E8E93',
                    label: 'Verbessert',
                };
            case 'down':
                return {
                    icon: 'arrow.down',
                    color: preferences.useSignalColors ? '#C63552' : '#8E8E93',
                    label: 'Verändert',
                };
            default:
                return {
                    icon: 'minus',
                    color: '#8E8E93',
                    label: 'Stabil',
                };
        }
    }, [preferences.showTrends, preferences.useSignalColors]);

    const getStatusColor = useCallback((
        status: 'normal' | 'elevated' | 'low' | 'critical',
        neutralColor: string
    ): string => {
        if (!preferences.useSignalColors) {
            return neutralColor;
        }

        switch (status) {
            case 'normal':
                return '#34C759';
            case 'elevated':
            case 'low':
                return '#FF9500';
            case 'critical':
                return '#FF3B30';
            default:
                return neutralColor;
        }
    }, [preferences.useSignalColors]);

    const contextValue: DisplayModeContextValue = {
        mode,
        isOverridden,
        defaultMode,
        preferences,
        hasCustomPreferences,
        isLoading,
        setMode,
        setPreference,
        resetPreferences,
        getScoreColor,
        getTrendDisplay,
        getStatusColor,
    };

    return (
        <DisplayModeContext.Provider value={contextValue}>
            {children}
        </DisplayModeContext.Provider>
    );
}

/**
 * Hook to access the display mode context
 */
export function useDisplayMode(): DisplayModeContextValue {
    const context = useContext(DisplayModeContext);
    if (!context) {
        throw new Error('useDisplayMode must be used within a DisplayModeProvider');
    }
    return context;
}

/**
 * Hook to get just the preferences (convenience)
 */
export function useDisplayPreferences(): DisplayPreferences {
    const { preferences } = useDisplayMode();
    return preferences;
}

/**
 * Hook to check if a specific feature should be shown
 */
export function useShowFeature(feature: keyof DisplayPreferences): boolean {
    const { preferences } = useDisplayMode();
    return preferences[feature];
}
