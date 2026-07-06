import React, { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
    EXTERNAL_HEALTH_AUTO_IMPORT_DELAY_MS,
    shouldRunExternalHealthAutoImport,
} from './autoImportPolicy';
import { isExternalHealthImportInFlight } from './importLock';
import { useExternalHealthImport } from './hooks/useExternalHealthImport';
import { getExternalHealthPreferences } from './preferences';

export function ExternalHealthAutoImportProvider({ children }: { children?: React.ReactNode }) {
    const healthImport = useExternalHealthImport();
    const healthImportRef = useRef(healthImport);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);
    const lastAutoAttemptAtRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        healthImportRef.current = healthImport;
    }, [healthImport]);

    const clearScheduledImport = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, []);

    const shouldRunNow = useCallback(() => {
        const current = healthImportRef.current;
        return appStateRef.current === 'active' &&
            !isExternalHealthImportInFlight() &&
            shouldRunExternalHealthAutoImport({
                canUseHealthImport: current.canUseHealthImport,
                availability: current.availability,
                enabled: current.preferences.enabled,
                selectedMetricCount: current.selectedMetricIds.length,
                isLoading: current.isLoading,
                isSyncing: current.isSyncing,
                lastImportedAt: current.preferences.lastImportedAt,
                lastAutoAttemptAtMs: lastAutoAttemptAtRef.current,
            });
    }, []);

    const runSilently = useCallback(async () => {
        timeoutRef.current = null;
        if (!shouldRunNow()) return;

        const latestPreferences = await getExternalHealthPreferences();
        const current = healthImportRef.current;
        const selectedMetricCount = latestPreferences.enabledMetricIds.length > 0
            ? latestPreferences.enabledMetricIds.length
            : current.selectedMetricIds.length;
        if (!shouldRunExternalHealthAutoImport({
            canUseHealthImport: current.canUseHealthImport,
            availability: current.availability,
            enabled: latestPreferences.enabled,
            selectedMetricCount,
            isLoading: current.isLoading,
            isSyncing: current.isSyncing,
            lastImportedAt: latestPreferences.lastImportedAt,
            lastAutoAttemptAtMs: lastAutoAttemptAtRef.current,
        })) {
            return;
        }

        lastAutoAttemptAtRef.current = Date.now();
        try {
            await current.syncNow();
        } catch {
            // Silent background import: user-visible errors are reserved for manual imports.
        }
    }, [shouldRunNow]);

    const scheduleAutoImport = useCallback(() => {
        if (timeoutRef.current || !shouldRunNow()) return;
        timeoutRef.current = setTimeout(() => {
            runSilently().catch(() => undefined);
        }, EXTERNAL_HEALTH_AUTO_IMPORT_DELAY_MS);
    }, [runSilently, shouldRunNow]);

    useEffect(() => {
        scheduleAutoImport();
    }, [
        healthImport.availability,
        healthImport.canUseHealthImport,
        healthImport.isLoading,
        healthImport.isSyncing,
        healthImport.preferences.enabled,
        healthImport.preferences.lastImportedAt,
        healthImport.selectedMetricIds.length,
        scheduleAutoImport,
    ]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            appStateRef.current = nextState;
            if (nextState === 'active') {
                scheduleAutoImport();
            } else {
                clearScheduledImport();
            }
        });

        return () => {
            clearScheduledImport();
            subscription.remove();
        };
    }, [clearScheduledImport, scheduleAutoImport]);

    return children ? <>{children}</> : null;
}
