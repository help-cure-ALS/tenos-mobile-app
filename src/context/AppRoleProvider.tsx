import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import type {
    AppRole,
    ActiveScope,
    PatientAlias,
    PatientAliasStore
} from '@/src/types/appRole';
import {
    getRoleFromScope,
    getActivePatientIdFromScope,
    hasMultiplePatients,
    getAllPatientIds
} from '@/src/types/appRole';
import { getKeyProvider } from '@/src/services/keyProvider';
import { clearStaleDataIfFreshInstall } from '@/src/utils/freshInstallCheck';

// SecureStore keys
const SCOPE_STORAGE_KEY = 'app_role_scope_v1';
const ALIASES_STORAGE_KEY = 'patient_aliases_local_v1';

/**
 * Context value type for AppRoleProvider
 */
export type AppRoleContextValue = {
    // Current state
    scope: ActiveScope | null;
    isLoading: boolean;

    // Derived helpers
    role: AppRole | null;
    activePatientId: string | null;
    isDemo: boolean;
    patientIds: string[];

    // Role setters
    setDemo(): Promise<void>;
    setPatient(subjectId: string): Promise<void>;
    setCaregiver(caregiverId: string, patientIds: string[], activePatientId: string): Promise<void>;
    setDoctor(doctorId: string, grantedPatientIds: string[], activePatientId: string): Promise<void>;

    // Patient management (for caregiver/doctor)
    selectActivePatient(patientId: string): Promise<void>;
    addPatient(patientId: string): Promise<void>;
    removePatient(patientId: string): Promise<void>;

    // Patient aliases (local only)
    getPatientAlias(patientId: string): PatientAlias | null;
    setPatientAlias(alias: PatientAlias): Promise<void>;
    removePatientAlias(patientId: string): Promise<void>;
    aliases: PatientAlias[];

    // Reset
    reset(keepLocalData?: boolean): Promise<void>;

    // Abilities (computed)
    canWriteForActive: boolean;
    canReadPrivateData: boolean;
    canConfirm: boolean;
    canManagePatients: boolean;
    canSwitchPatient: boolean;
};

const AppRoleContext = createContext<AppRoleContextValue | null>(null);

type AppRoleProviderProps = {
    children: React.ReactNode;
};

export function AppRoleProvider({ children }: AppRoleProviderProps) {
    const [scope, setScope] = useState<ActiveScope | null>(null);
    const scopeRef = useRef<ActiveScope | null>(null);
    const [aliases, setAliases] = useState<PatientAlias[]>([]);
    const aliasesRef = useRef<PatientAlias[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Load persisted data on mount
    useEffect(() => {
        loadPersistedData();
    }, []);

    const loadPersistedData = async () => {
        try {
            // Check for fresh install (SecureStore persists across reinstalls on iOS)
            await clearStaleDataIfFreshInstall();

            // Load scope (will be null after fresh install cleanup)
            const scopeJson = await SecureStore.getItemAsync(SCOPE_STORAGE_KEY);
            if (scopeJson) {
                const parsedScope = JSON.parse(scopeJson) as ActiveScope;
                scopeRef.current = parsedScope;
                setScope(parsedScope);
            }

            // Load aliases
            const aliasesJson = await SecureStore.getItemAsync(ALIASES_STORAGE_KEY);
            if (aliasesJson) {
                const parsedAliases = JSON.parse(aliasesJson) as PatientAliasStore;
                const nextAliases = parsedAliases.aliases ?? [];
                aliasesRef.current = nextAliases;
                setAliases(nextAliases);
            }
        }
        catch (e) {
            console.error('Failed to load app role data:', e);
        }
        finally {
            setIsLoading(false);
        }
    };

    const persistScope = useCallback(async (newScope: ActiveScope | null) => {
        try {
            if (newScope) {
                await SecureStore.setItemAsync(SCOPE_STORAGE_KEY, JSON.stringify(newScope));
            } else {
                await SecureStore.deleteItemAsync(SCOPE_STORAGE_KEY);
            }
        }
        catch (e) {
            console.error('Failed to persist scope:', e);
        }
    }, []);

    const persistAliases = useCallback(async (newAliases: PatientAlias[]) => {
        try {
            if (newAliases.length === 0) {
                await SecureStore.deleteItemAsync(ALIASES_STORAGE_KEY);
                return;
            }
            const store: PatientAliasStore = { aliases: newAliases };
            await SecureStore.setItemAsync(ALIASES_STORAGE_KEY, JSON.stringify(store));
        }
        catch (e) {
            console.error('Failed to persist aliases:', e);
        }
    }, []);

    const commitScope = useCallback(async (nextScope: ActiveScope | null) => {
        scopeRef.current = nextScope;
        setScope(nextScope);
        await persistScope(nextScope);
    }, [persistScope]);

    const commitAliases = useCallback(async (nextAliases: PatientAlias[]) => {
        aliasesRef.current = nextAliases;
        setAliases(nextAliases);
        await persistAliases(nextAliases);
    }, [persistAliases]);

    // Role setters
    const setDemo = useCallback(async () => {
        const newScope: ActiveScope = { role: 'demo' };
        await commitScope(newScope);
    }, [commitScope]);

    const setPatient = useCallback(async (subjectId: string) => {
        const newScope: ActiveScope = { role: 'patient', subjectId };
        await commitScope(newScope);
    }, [commitScope]);

    const setCaregiver = useCallback(async (
        caregiverId: string,
        patientIds: string[],
        activePatientId: string
    ) => {
        const newScope: ActiveScope = {
            role: 'caregiver',
            caregiverId,
            patientIds,
            activePatientId
        };
        await commitScope(newScope);
    }, [commitScope]);

    const setDoctor = useCallback(async (
        doctorId: string,
        grantedPatientIds: string[],
        activePatientId: string
    ) => {
        const newScope: ActiveScope = {
            role: 'doctor',
            doctorId,
            grantedPatientIds,
            activePatientId
        };
        await commitScope(newScope);
    }, [commitScope]);

    // Patient management
    const selectActivePatient = useCallback(async (patientId: string) => {
        const currentScope = scopeRef.current;
        if (!currentScope) {
            throw new Error('No active scope available');
        }

        if (currentScope.role === 'caregiver') {
            if (!currentScope.patientIds.includes(patientId)) {
                throw new Error(`Patient ${patientId} is not available in caregiver scope`);
            }
            if (currentScope.activePatientId === patientId) return;
            await commitScope({ ...currentScope, activePatientId: patientId });
            return;
        }

        if (currentScope.role === 'doctor') {
            if (!currentScope.grantedPatientIds.includes(patientId)) {
                throw new Error(`Patient ${patientId} is not available in doctor scope`);
            }
            if (currentScope.activePatientId === patientId) return;
            await commitScope({ ...currentScope, activePatientId: patientId });
            return;
        }

        throw new Error('Cannot select active patient outside caregiver/doctor scope');
    }, [commitScope]);

    const addPatient = useCallback(async (patientId: string) => {
        const currentScope = scopeRef.current;
        if (!currentScope) return;

        if (currentScope.role === 'caregiver') {
            if (currentScope.patientIds.includes(patientId)) return;
            const newScope: ActiveScope = {
                ...currentScope,
                patientIds: [...currentScope.patientIds, patientId]
            };
            await commitScope(newScope);
        } else if (currentScope.role === 'doctor') {
            if (currentScope.grantedPatientIds.includes(patientId)) return;
            const newScope: ActiveScope = {
                ...currentScope,
                grantedPatientIds: [...currentScope.grantedPatientIds, patientId]
            };
            await commitScope(newScope);
        }
    }, [commitScope]);

    // Alias management
    const getPatientAlias = useCallback((patientId: string): PatientAlias | null => {
        return aliasesRef.current.find(a => a.patientId === patientId) ?? null;
    }, []);

    const setPatientAlias = useCallback(async (alias: PatientAlias) => {
        const newAliases = aliasesRef.current.filter(a => a.patientId !== alias.patientId);
        newAliases.push(alias);
        await commitAliases(newAliases);
    }, [commitAliases]);

    const removePatientAlias = useCallback(async (patientId: string) => {
        const newAliases = aliasesRef.current.filter(a => a.patientId !== patientId);
        await commitAliases(newAliases);
    }, [commitAliases]);

    const removePatient = useCallback(async (patientId: string) => {
        const currentScope = scopeRef.current;
        if (!currentScope) return;

        if (currentScope.role === 'caregiver') {
            const newPatientIds = currentScope.patientIds.filter(id => id !== patientId);
            if (newPatientIds.length === 0) {
                throw new Error('Cannot remove last patient');
            }

            const newActivePatientId = currentScope.activePatientId === patientId
                ? newPatientIds[0]
                : currentScope.activePatientId;

            const newScope: ActiveScope = {
                ...currentScope,
                patientIds: newPatientIds,
                activePatientId: newActivePatientId
            };
            await commitScope(newScope);
        } else if (currentScope.role === 'doctor') {
            const newPatientIds = currentScope.grantedPatientIds.filter(id => id !== patientId);
            if (newPatientIds.length === 0) {
                throw new Error('Cannot remove last patient');
            }

            const newActivePatientId = currentScope.activePatientId === patientId
                ? newPatientIds[0]
                : currentScope.activePatientId;

            const newScope: ActiveScope = {
                ...currentScope,
                grantedPatientIds: newPatientIds,
                activePatientId: newActivePatientId
            };
            await commitScope(newScope);
        } else {
            return;
        }

        // Also remove alias
        await removePatientAlias(patientId);
    }, [commitScope, removePatientAlias]);

    // Reset
    const reset = useCallback(async (keepLocalData = false) => {
        await commitScope(null);

        if (!keepLocalData) {
            await commitAliases([]);
        }
    }, [commitAliases, commitScope]);

    // Derived values
    const role = useMemo(() => getRoleFromScope(scope), [scope]);
    const activePatientId = useMemo(() => getActivePatientIdFromScope(scope), [scope]);
    const isDemo = useMemo(() => scope?.role === 'demo', [scope]);
    const patientIds = useMemo(() => getAllPatientIds(scope), [scope]);

    // Sync KeyProvider context whenever scope changes
    useEffect(() => {
        const keyProvider = getKeyProvider();
        keyProvider.setContext({
            role: role,
            activePatientId: activePatientId
        });
    }, [role, activePatientId]);

    // Abilities
    const canWriteForActive = useMemo(() => {
        if (!scope) {
            return false;
        }
        return scope.role === 'patient' || scope.role === 'caregiver' || scope.role === 'doctor';
    }, [scope]);

    const canReadPrivateData = useMemo(() => {
        if (!scope) {
            return false;
        }
        // Patient and caregiver can always read
        // Doctor can only read if granted (simplified: always true if doctor has the patient)
        return scope.role === 'patient' || scope.role === 'caregiver' || scope.role === 'doctor';
    }, [scope]);

    const canConfirm = useMemo(() => {
        return scope?.role === 'doctor';
    }, [scope]);

    const canManagePatients = useMemo(() => {
        return scope?.role === 'caregiver';
    }, [scope]);

    const canSwitchPatient = useMemo(() => {
        return hasMultiplePatients(scope);
    }, [scope]);

    const contextValue: AppRoleContextValue = {
        // State
        scope,
        isLoading,

        // Derived
        role,
        activePatientId,
        isDemo,
        patientIds,

        // Role setters
        setDemo,
        setPatient,
        setCaregiver,
        setDoctor,

        // Patient management
        selectActivePatient,
        addPatient,
        removePatient,

        // Aliases
        getPatientAlias,
        setPatientAlias,
        removePatientAlias,
        aliases,

        // Reset
        reset,

        // Abilities
        canWriteForActive,
        canReadPrivateData,
        canConfirm,
        canManagePatients,
        canSwitchPatient
    };

    return (
        <AppRoleContext.Provider value={ contextValue }>
            { children }
        </AppRoleContext.Provider>
    );
}

/**
 * Hook to access the AppRole context
 */
export function useAppRole(): AppRoleContextValue {
    const context = useContext(AppRoleContext);
    if (!context) {
        throw new Error('useAppRole must be used within an AppRoleProvider');
    }
    return context;
}

/**
 * Convenience hook to get the active patient ID
 */
export function useActivePatientId(): string | null {
    const { activePatientId } = useAppRole();
    return activePatientId;
}

/**
 * Convenience hook to check if in demo mode
 */
export function useIsDemo(): boolean {
    const { isDemo } = useAppRole();
    return isDemo;
}

/**
 * Hook to get display info for a patient (using local alias)
 */
export function usePatientDisplay(patientId: string) {
    const { getPatientAlias } = useAppRole();
    const alias = getPatientAlias(patientId);

    return {
        displayName: alias?.localName ?? `Patient ${ patientId.slice(0, 6) }`,
        color: alias?.color ?? '#888888',
        icon: alias?.icon ?? 'person.fill',
        hasAlias: !!alias,
    };
}
