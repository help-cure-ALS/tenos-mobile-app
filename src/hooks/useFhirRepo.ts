/**
 * useFhirRepo - Hook for accessing FHIR data with automatic patient context.
 *
 * This hook provides a simplified API that automatically uses the correct
 * patient ID based on the current app role.
 */
import { useCallback, useEffect, useMemo } from 'react';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { initPatientFhirRepo, type PatientFhirRepo } from '@/src/repos/patientFhirRepo';
import { getPatientFhirStore } from '@/src/stores/patientFhirStore';
import { preloadObservationsCache } from '@/src/metrics/hooks/observationsCache';
import type { AppRole } from '@/src/types/appRole';

// Module-level set: ensures backfillTags runs exactly once per patient per app session
const _backfilledPatients = new Set<string>();

/**
 * Extension URL for recording who made changes to a resource.
 * Uses a URN to avoid needing a real domain.
 */
const RECORDED_BY_ROLE_URL = 'urn:medical-sync-vault:recorded-by-role';

/**
 * Adds meta.extension with the current role to a FHIR resource.
 * This allows tracking who (patient, caregiver, doctor) created/modified the resource.
 */
function addRecordedByRole<T extends { meta?: { extension?: any[] } }>(
    resource: T,
    role: AppRole | null
): T {
    // Only add role for real roles (not demo, not null)
    if (!role || role === 'demo') {
        return resource;
    }

    const result = { ...resource };
    result.meta = { ...(result.meta ?? {}) };
    result.meta.extension = [...(result.meta.extension ?? [])];

    // Remove any existing recorded-by-role extension (in case of update)
    result.meta.extension = result.meta.extension.filter(
        (ext: any) => ext?.url !== RECORDED_BY_ROLE_URL
    );

    // Add the new extension
    result.meta.extension.push({
        url: RECORDED_BY_ROLE_URL,
        valueCode: role,
    });

    return result;
}

export type FhirRepoResult = {
    /** The underlying PatientFhirRepo */
    repo: PatientFhirRepo;

    /** Current active patient ID */
    activePatientId: string | null;

    /** All accessible patient IDs */
    patientIds: string[];

    /** Whether user can write data */
    canWrite: boolean;

    /**
     * Upsert a resource for the active patient.
     * @param tag - Optional unencrypted tag for SQL-level filtering (e.g. 'q:alsfrs-r')
     */
    upsert(resourceType: string, id: string, resource: any, updatedAt?: string, tag?: string | null): Promise<void>;

    /**
     * Mark a resource as deleted for the active patient.
     */
    markDeleted(resourceType: string, id: string, updatedAt?: string): Promise<void>;

    /**
     * List resources for the active patient.
     */
    list(
        resourceType?: string,
        opts?: {
            includeDeleted?: boolean;
            limit?: number;
            tag?: string;
            metricTag?: string;
            fromDate?: string;
            toDate?: string;
            source?: string;
            orderBy?: 'updated_at' | 'effective_date';
        }
    ): Promise<Array<{ resource: any; updated_at: string; deleted: boolean }>>;

    /**
     * Count resources for the active patient.
     */
    count(
        resourceType?: string,
        opts?: {
            includeDeleted?: boolean;
            tag?: string;
            metricTag?: string;
            fromDate?: string;
            toDate?: string;
            source?: string;
        }
    ): Promise<number>;

    /**
     * Get a specific resource for the active patient.
     */
    get(
        resourceType: string,
        id: string
    ): Promise<{ resource: any; updated_at: string; deleted: boolean } | null>;

    /**
     * List resources across all accessible patients (for caregivers/doctors).
     */
    listAll(
        resourceType?: string,
        opts?: { includeDeleted?: boolean; limit?: number }
    ): Promise<Array<{ subjectId: string; resource: any; updated_at: string; deleted: boolean }>>;

    /**
     * Upsert for a specific patient (useful for caregivers managing multiple patients).
     * @param tag - Optional unencrypted tag for SQL-level filtering (e.g. 'q:alsfrs-r')
     */
    upsertFor(
        patientId: string,
        resourceType: string,
        id: string,
        resource: any,
        updatedAt?: string,
        tag?: string | null
    ): Promise<void>;

    /**
     * List for a specific patient.
     */
    listFor(
        patientId: string,
        resourceType?: string,
        opts?: {
            includeDeleted?: boolean;
            limit?: number;
            tag?: string;
            metricTag?: string;
            fromDate?: string;
            toDate?: string;
            source?: string;
            orderBy?: 'updated_at' | 'effective_date';
        }
    ): Promise<Array<{ resource: any; updated_at: string; deleted: boolean }>>;
};

export function useFhirRepo(): FhirRepoResult {
    const { outbox } = useAppSync();
    const { activePatientId, patientIds, canWriteForActive, role } = useAppRole();

    // Initialize the repo with the outbox
    const repo = useMemo(() => initPatientFhirRepo(outbox), [outbox]);

    const upsert = useCallback(
        async (resourceType: string, id: string, resource: any, updatedAt?: string, tag?: string | null) => {
            if (!activePatientId) {
                throw new Error('No active patient selected');
            }
            const resourceWithRole = addRecordedByRole(resource, role);
            await repo.upsert(activePatientId, resourceType, id, resourceWithRole, updatedAt, tag);
        },
        [repo, activePatientId, role]
    );

    const markDeleted = useCallback(
        async (resourceType: string, id: string, updatedAt?: string) => {
            if (!activePatientId) {
                throw new Error('No active patient selected');
            }
            await repo.markDeleted(activePatientId, resourceType, id, updatedAt);
        },
        [repo, activePatientId]
    );

    const list = useCallback(
        async (resourceType?: string, opts?: {
            includeDeleted?: boolean;
            limit?: number;
            tag?: string;
            metricTag?: string;
            fromDate?: string;
            toDate?: string;
            source?: string;
            orderBy?: 'updated_at' | 'effective_date';
        }) => {
            if (!activePatientId) {
                return [];
            }
            return repo.list(activePatientId, resourceType, opts);
        },
        [repo, activePatientId]
    );

    const count = useCallback(
        async (resourceType?: string, opts?: {
            includeDeleted?: boolean;
            tag?: string;
            metricTag?: string;
            fromDate?: string;
            toDate?: string;
            source?: string;
        }) => {
            if (!activePatientId) {
                return 0;
            }
            return repo.count(activePatientId, resourceType, opts);
        },
        [repo, activePatientId]
    );

    const get = useCallback(
        async (resourceType: string, id: string) => {
            if (!activePatientId) {
                return null;
            }
            return repo.get(activePatientId, resourceType, id);
        },
        [repo, activePatientId]
    );

    const listAll = useCallback(
        async (resourceType?: string, opts?: { includeDeleted?: boolean; limit?: number }) => {
            if (!patientIds.length) {
                return [];
            }
            return repo.listMultiple(patientIds, resourceType, opts);
        },
        [repo, patientIds]
    );

    const upsertFor = useCallback(
        async (
            patientId: string,
            resourceType: string,
            id: string,
            resource: any,
            updatedAt?: string,
            tag?: string | null
        ) => {
            const resourceWithRole = addRecordedByRole(resource, role);
            await repo.upsert(patientId, resourceType, id, resourceWithRole, updatedAt, tag);
        },
        [repo, role]
    );

    const listFor = useCallback(
        async (
            patientId: string,
            resourceType?: string,
            opts?: {
                includeDeleted?: boolean;
                limit?: number;
                tag?: string;
                metricTag?: string;
                fromDate?: string;
                toDate?: string;
                source?: string;
                orderBy?: 'updated_at' | 'effective_date';
            }
        ) => {
            return repo.list(patientId, resourceType, opts);
        },
        [repo]
    );

    // One-time backfill: tag existing untagged Observation/QuestionnaireResponse rows,
    // backfill effective_date + source metadata, and backfill metric_tag for all Observations
    useEffect(() => {
        if (!activePatientId || _backfilledPatients.has(activePatientId)) return;
        _backfilledPatients.add(activePatientId);
        const store = getPatientFhirStore();
        store.backfillTags(activePatientId).catch(() => {});
        store.backfillMetadata(activePatientId).catch(() => {});
        store.backfillMetricTags(activePatientId).catch(() => {});
    }, [activePatientId]);

    // Pre-load observations cache so Home Screen metrics render faster
    useEffect(() => {
        if (activePatientId) {
            preloadObservationsCache(activePatientId, list, count);
        }
    }, [activePatientId, list, count]);

    return {
        repo,
        activePatientId,
        patientIds,
        canWrite: canWriteForActive,
        upsert,
        markDeleted,
        list,
        count,
        get,
        listAll,
        upsertFor,
        listFor,
    };
}
