import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useAppRole } from './AppRoleProvider';

// SecureStore key for patient preference
const AUTH_LOCK_ENABLED_KEY = 'auth_lock_enabled_v1';

// Lock timeout in milliseconds (3 minutes)
const LOCK_TIMEOUT_MS = 3 * 60 * 1000;

export type AuthLockContextValue = {
    // State
    isLocked: boolean;
    isAuthenticating: boolean;
    authLockEnabled: boolean;
    isLoading: boolean;

    // Actions
    unlock: () => Promise<boolean>;
    lock: () => void;

    // Settings (for patient role)
    setAuthLockEnabled: (enabled: boolean) => Promise<void>;

    // Helpers
    requiresAuthLock: boolean;
    biometryType: LocalAuthentication.AuthenticationType | null;
};

const AuthLockContext = createContext<AuthLockContextValue | null>(null);

type AuthLockProviderProps = {
    children: React.ReactNode;
};

export function AuthLockProvider({ children }: AuthLockProviderProps) {
    const { role, isLoading: isRoleLoading } = useAppRole();

    const [isLocked, setIsLocked] = useState(true);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [authLockEnabled, setAuthLockEnabledState] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [biometryType, setBiometryType] = useState<LocalAuthentication.AuthenticationType | null>(null);

    const lastActiveRef = useRef<number>(Date.now());
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);

    // Determine if auth lock is required based on role
    const requiresAuthLock = React.useMemo(() => {
        if (!role) {
            return false;
        }

        // Caregiver and Doctor always require auth lock
        if (role === 'caregiver' || role === 'doctor') {
            return true;
        }

        // Patient: based on user preference
        if (role === 'patient') {
            return authLockEnabled;
        }

        // Demo: no auth lock
        return false;
    }, [role, authLockEnabled]);

    // Load settings and check biometry on mount
    useEffect(() => {
        loadSettings();
        checkBiometryType();
    }, []);

    // Handle app state changes (background/foreground)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => subscription.remove();
    }, [requiresAuthLock]);

    // Set initial lock state based on role
    useEffect(() => {
        if (!isRoleLoading && !isLoading) {
            // If auth lock is required, start locked
            // Otherwise, start unlocked
            setIsLocked(requiresAuthLock);
        }
    }, [isRoleLoading, isLoading, requiresAuthLock]);

    const loadSettings = async () => {
        try {
            const enabled = await SecureStore.getItemAsync(AUTH_LOCK_ENABLED_KEY);
            setAuthLockEnabledState(enabled === 'true');
        }
        catch (e) {
            console.error('Failed to load auth lock settings:', e);
        }
        finally {
            setIsLoading(false);
        }
    };

    const checkBiometryType = async () => {
        try {
            const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
            if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
                setBiometryType(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
            } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
                setBiometryType(LocalAuthentication.AuthenticationType.FINGERPRINT);
            }
        }
        catch (e) {
            console.error('Failed to check biometry type:', e);
        }
    };

    const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
        const previousState = appStateRef.current;
        appStateRef.current = nextAppState;

        if (!requiresAuthLock) {
            return;
        }

        // App went to background
        if (nextAppState === 'background' || nextAppState === 'inactive') {
            lastActiveRef.current = Date.now();
        }

        // App came to foreground
        if (previousState.match(/inactive|background/) && nextAppState === 'active') {
            const timeSinceActive = Date.now() - lastActiveRef.current;

            if (timeSinceActive >= LOCK_TIMEOUT_MS) {
                setIsLocked(true);
            }
        }
    }, [requiresAuthLock]);

    const unlock = useCallback(async (): Promise<boolean> => {
        if (!requiresAuthLock) {
            setIsLocked(false);
            return true;
        }

        setIsAuthenticating(true);

        try {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();

            if (!hasHardware || !isEnrolled) {
                // No biometry available, unlock anyway (device passcode will be used as fallback)
                setIsLocked(false);
                return true;
            }

            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Entsperre die App',
                fallbackLabel: 'Code eingeben',
                cancelLabel: 'Abbrechen',
                disableDeviceFallback: false
            });

            if (result.success) {
                setIsLocked(false);
                lastActiveRef.current = Date.now();
                return true;
            }

            return false;
        }
        catch (e) {
            console.error('Authentication failed:', e);
            return false;
        }
        finally {
            setIsAuthenticating(false);
        }
    }, [requiresAuthLock]);

    const lock = useCallback(() => {
        if (requiresAuthLock) {
            setIsLocked(true);
        }
    }, [requiresAuthLock]);

    const setAuthLockEnabled = useCallback(async (enabled: boolean) => {
        try {
            await SecureStore.setItemAsync(AUTH_LOCK_ENABLED_KEY, enabled ? 'true' : 'false');
            setAuthLockEnabledState(enabled);

            // If enabling, lock immediately
            if (enabled && role === 'patient') {
                setIsLocked(true);
            }
            // If disabling, unlock
            if (!enabled && role === 'patient') {
                setIsLocked(false);
            }
        }
        catch (e) {
            console.error('Failed to save auth lock setting:', e);
            throw e;
        }
    }, [role]);

    const contextValue: AuthLockContextValue = {
        isLocked: requiresAuthLock && isLocked,
        isAuthenticating,
        authLockEnabled,
        isLoading: isLoading || isRoleLoading,
        unlock,
        lock,
        setAuthLockEnabled,
        requiresAuthLock,
        biometryType
    };

    return (
        <AuthLockContext.Provider value={ contextValue }>
            { children }
        </AuthLockContext.Provider>
    );
}

export function useAuthLock(): AuthLockContextValue {
    const context = useContext(AuthLockContext);
    if (!context) {
        throw new Error('useAuthLock must be used within an AuthLockProvider');
    }
    return context;
}
