/**
 * PatientFhirRepo - Patient-aware FHIR repository that handles both storage and outbox.
 *
 * This is the main API for reading and writing FHIR data in the app.
 * It automatically handles:
 * - Storing data with the correct patient context
 * - Using the correct encryption key per patient
 * - Queueing changes to the outbox for sync
 */
import * as Crypto from 'expo-crypto';
import { emit } from '@/src/lib/bus';
import { createFhirOutboxPointer, type FhirOutboxPointer } from '@/src/stores/fhirOutbox';
import { getPatientFhirStore, type PatientFhirStore } from '@/src/stores/patientFhirStore';
import type { OutboxStore } from '@/src/lib/medical-sync-vault/outbox/types';
import { DEMO_PATIENT_ID } from '@/src/demo/demoData';

export type PatientFhirRepo = {
    init(): Promise<void>;

    /**
     * Upsert a resource for a specific patient.
     * @param tag - Optional unencrypted tag for SQL-level filtering (e.g. 'q:alsfrs-r')
     */
    upsert(
        subjectId: string,
        resourceType: string,
        id: string,
        resource: any,
        updatedAt?: string,
        tag?: string | null
    ): Promise<void>;

    /**
     * Mark a resource as deleted for a specific patient.
     */
    markDeleted(
        subjectId: string,
        resourceType: string,
        id: string,
        updatedAt?: string
    ): Promise<void>;

    /**
     * List resources for a specific patient.
     */
    list(
        subjectId: string,
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
     * Count resources for a specific patient.
     */
    count(
        subjectId: string,
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
     * Get a specific resource for a patient.
     */
    get(
        subjectId: string,
        resourceType: string,
        id: string
    ): Promise<{ resource: any; updated_at: string; deleted: boolean } | null>;

    /**
     * List resources across multiple patients.
     */
    listMultiple(
        subjectIds: string[],
        resourceType?: string,
        opts?: { includeDeleted?: boolean; limit?: number }
    ): Promise<Array<{ subjectId: string; resource: any; updated_at: string; deleted: boolean }>>;
};

export function createPatientFhirRepo(services: { outbox: OutboxStore }): PatientFhirRepo {
    const { outbox } = services;
    const fhirStore = getPatientFhirStore();

    async function init() {
        await fhirStore.init();
        await outbox.init();
    }

    async function upsert(
        subjectId: string,
        resourceType: string,
        id: string,
        resource: any,
        updatedAt?: string,
        tag?: string | null
    ) {
        await init();
        const ts = updatedAt ?? new Date().toISOString();

        await fhirStore.upsert(subjectId, resourceType, id, resource, ts, tag);

        // Skip outbox for demo patient — demo data must never sync
        if (subjectId !== DEMO_PATIENT_ID) {
            const fhirPtr: FhirOutboxPointer = {
                event_id: Crypto.randomUUID(),
                op: 'upsert',
                subject_id: subjectId,
                resource_type: resourceType,
                resource_id: id,
                updated_at: ts,
            };
            const outboxPtr = createFhirOutboxPointer(fhirPtr);
            await outbox.enqueue([outboxPtr]);
        }

        emit('fhir:changed');
    }

    async function markDeleted(
        subjectId: string,
        resourceType: string,
        id: string,
        updatedAt?: string
    ) {
        await init();
        const ts = updatedAt ?? new Date().toISOString();

        await fhirStore.markDeleted(subjectId, resourceType, id, ts);

        // Skip outbox for demo patient — demo data must never sync
        if (subjectId !== DEMO_PATIENT_ID) {
            const fhirPtr: FhirOutboxPointer = {
                event_id: Crypto.randomUUID(),
                op: 'delete',
                subject_id: subjectId,
                resource_type: resourceType,
                resource_id: id,
                updated_at: ts,
            };
            const outboxPtr = createFhirOutboxPointer(fhirPtr);
            await outbox.enqueue([outboxPtr]);
        }

        emit('fhir:changed');
    }

    async function list(
        subjectId: string,
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
    ) {
        await init();
        return fhirStore.list(subjectId, resourceType, opts);
    }

    async function count(
        subjectId: string,
        resourceType?: string,
        opts?: {
            includeDeleted?: boolean;
            tag?: string;
            metricTag?: string;
            fromDate?: string;
            toDate?: string;
            source?: string;
        }
    ) {
        await init();
        return fhirStore.count(subjectId, resourceType, opts);
    }

    async function get(subjectId: string, resourceType: string, id: string) {
        await init();
        return fhirStore.get(subjectId, resourceType, id);
    }

    async function listMultiple(
        subjectIds: string[],
        resourceType?: string,
        opts?: { includeDeleted?: boolean; limit?: number }
    ) {
        await init();
        return fhirStore.listMultiple(subjectIds, resourceType, opts);
    }

    return { init, upsert, markDeleted, list, count, get, listMultiple };
}

// Singleton (requires outbox to be set)
let _repo: PatientFhirRepo | null = null;
let _outbox: OutboxStore | null = null;

export function initPatientFhirRepo(outbox: OutboxStore): PatientFhirRepo {
    if (!_repo || _outbox !== outbox) {
        _outbox = outbox;
        _repo = createPatientFhirRepo({ outbox });
    }
    return _repo;
}

export function getPatientFhirRepo(): PatientFhirRepo {
    if (!_repo) {
        throw new Error('PatientFhirRepo not initialized. Call initPatientFhirRepo first.');
    }
    return _repo;
}
