import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAppRole } from '@/src/context/AppRoleProvider';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import { on } from '@/src/lib/bus';
import { createExpoSecureStore, createKeybag } from '@/src/lib/medical-sync-vault';

export function useActivePatientOwnerAccess(): { hasOwnerAccess: boolean; isLoaded: boolean } {
    const { role, isLoading: roleLoading } = useAppRole();
    const { deviceAccessStore } = usePatientStores();
    const store = useMemo(() => createExpoSecureStore('medical_sync_vault'), []);
    const K = useMemo(() => createKeybag(), []);
    const [hasDeviceOwnerAccess, setHasDeviceOwnerAccess] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    const readDeviceOwnerAccess = useCallback(async (): Promise<boolean> => {
        if (!deviceAccessStore) {
            return false;
        }
        const deviceId = await store.get(K.DEVICE_ID);
        const entry = deviceId ? await deviceAccessStore.getEntry(deviceId) : null;
        return entry?.role === 'owner';
    }, [deviceAccessStore, store, K]);

    useEffect(() => {
        let cancelled = false;

        if (roleLoading) {
            setHasDeviceOwnerAccess(false);
            setIsLoaded(false);
            return;
        }

        if (role === 'patient' || role === 'demo') {
            setHasDeviceOwnerAccess(true);
            setIsLoaded(true);
            return;
        }

        if (role !== 'caregiver') {
            setHasDeviceOwnerAccess(false);
            setIsLoaded(true);
            return;
        }

        const load = () => {
            setIsLoaded(false);
            readDeviceOwnerAccess()
                .then((next) => {
                    if (cancelled) return;
                    setHasDeviceOwnerAccess(next);
                    setIsLoaded(true);
                })
                .catch(() => {
                    if (cancelled) return;
                    setHasDeviceOwnerAccess(false);
                    setIsLoaded(true);
                });
        };

        load();
        const offFhir = on('fhir:changed', load);

        return () => {
            cancelled = true;
            offFhir();
        };
    }, [role, roleLoading, readDeviceOwnerAccess]);

    return { hasOwnerAccess: hasDeviceOwnerAccess, isLoaded };
}
