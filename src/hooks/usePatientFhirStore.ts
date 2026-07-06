/**
 * usePatientFhirStore - Hook for accessing FHIR data with automatic patient context.
 *
 * This hook provides a simplified API for reading and writing FHIR data that
 * automatically uses the correct patient ID and encryption key based on the
 * current app role.
 */
import { useCallback, useMemo } from 'react';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { getPatientFhirStore, type PatientFhirStore } from '@/src/stores/patientFhirStore';

export type UsePatientFhirStoreResult = {
    /** The underlying PatientFhirStore instance */
    store: PatientFhirStore;

    /** Current active patient ID (null if no patient selected) */
    activePatientId: string | null;

    /** All patient IDs the user has access to */
    patientIds: string[];

    /** Whether the user can write data */
    canWrite: boolean;

    /**
     * Upsert a resource for the active patient.
     * Throws if no active patient is selected.
     */
    upsert(resourceType: string, resourceId: string, resource: any, updatedAt?: string): Promise<void>;

    /**
     * Mark a resource as deleted for the active patient.
     */
    markDeleted(resourceType: string, resourceId: string, updatedAt?: string): Promise<void>;

    /**
     * Get a resource for the active patient.
     */
    get(
        resourceType: string,
        resourceId: string
    ): Promise<{ resource: any; updated_at: string; deleted: boolean } | null>;

    /**
     * List resources for the active patient.
     */
    list(
        resourceType?: string,
        opts?: { includeDeleted?: boolean; limit?: number }
    ): Promise<Array<{ resource: any; updated_at: string; deleted: boolean }>>;

    /**
     * List resources across all accessible patients.
     * Useful for caregivers/doctors who manage multiple patients.
     */
    listAll(
        resourceType?: string,
        opts?: { includeDeleted?: boolean; limit?: number }
    ): Promise<Array<{ subjectId: string; resource: any; updated_at: string; deleted: boolean }>>;

    /**
     * Upsert a resource for a specific patient.
     * Useful when managing multiple patients.
     */
    upsertFor(
        patientId: string,
        resourceType: string,
        resourceId: string,
        resource: any,
        updatedAt?: string
    ): Promise<void>;

    /**
     * List resources for a specific patient.
     */
    listFor(
        patientId: string,
        resourceType?: string,
        opts?: { includeDeleted?: boolean; limit?: number }
    ): Promise<Array<{ resource: any; updated_at: string; deleted: boolean }>>;

    /**
     * List all resources for export (no limit).
     */
    listForExport(
        resourceType: string,
        opts?: { tag?: string; metricTag?: string; tagPrefix?: string }
    ): Promise<Array<{ resource: any; updated_at: string; deleted: boolean }>>;
};

/**
 * Hook for accessing FHIR data with automatic patient context.
 */
export function usePatientFhirStore(): UsePatientFhirStoreResult {
    const { activePatientId, patientIds, canWriteForActive } = useAppRole();
    const store = useMemo(() => getPatientFhirStore(), []);

    const upsert = useCallback(
        async (resourceType: string, resourceId: string, resource: any, updatedAt?: string) => {
            if (!activePatientId) {
                throw new Error('No active patient selected');
            }
            await store.upsert(activePatientId, resourceType, resourceId, resource, updatedAt);
        },
        [store, activePatientId]
    );

    const markDeleted = useCallback(
        async (resourceType: string, resourceId: string, updatedAt?: string) => {
            if (!activePatientId) {
                throw new Error('No active patient selected');
            }
            await store.markDeleted(activePatientId, resourceType, resourceId, updatedAt);
        },
        [store, activePatientId]
    );

    const get = useCallback(
        async (resourceType: string, resourceId: string) => {
            if (!activePatientId) {
                return null;
            }
            return store.get(activePatientId, resourceType, resourceId);
        },
        [store, activePatientId]
    );

    const list = useCallback(
        async (resourceType?: string, opts?: { includeDeleted?: boolean; limit?: number }) => {
            if (!activePatientId) {
                return [];
            }
            return store.list(activePatientId, resourceType, opts);
        },
        [store, activePatientId]
    );

    const listAll = useCallback(
        async (resourceType?: string, opts?: { includeDeleted?: boolean; limit?: number }) => {
            if (!patientIds.length) {
                return [];
            }
            return store.listMultiple(patientIds, resourceType, opts);
        },
        [store, patientIds]
    );

    const upsertFor = useCallback(
        async (
            patientId: string,
            resourceType: string,
            resourceId: string,
            resource: any,
            updatedAt?: string
        ) => {
            await store.upsert(patientId, resourceType, resourceId, resource, updatedAt);
        },
        [store]
    );

    const listFor = useCallback(
        async (
            patientId: string,
            resourceType?: string,
            opts?: { includeDeleted?: boolean; limit?: number }
        ) => {
            return store.list(patientId, resourceType, opts);
        },
        [store]
    );

    const listForExport = useCallback(
        async (
            resourceType: string,
            opts?: { tag?: string; metricTag?: string; tagPrefix?: string }
        ) => {
            if (!activePatientId) {
                return [];
            }
            return store.listForExport(activePatientId, resourceType, opts);
        },
        [store, activePatientId]
    );

    return {
        store,
        activePatientId,
        patientIds,
        canWrite: canWriteForActive,
        upsert,
        markDeleted,
        get,
        list,
        listAll,
        upsertFor,
        listFor,
        listForExport,
    };
}
