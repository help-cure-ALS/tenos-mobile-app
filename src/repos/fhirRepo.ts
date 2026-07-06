// src/repos/fhirRepo.ts
// @deprecated - Use patientFhirRepo.ts instead. This file is kept for backward compatibility.
import * as Crypto from "expo-crypto";
import { emit } from "@/src/lib/bus";
import { createFhirOutboxPointer, type FhirOutboxPointer } from "@/src/stores/fhirOutbox";
import type { OutboxStore } from "@/src/lib/medical-sync-vault/outbox/types";

/**
 * @deprecated Use createPatientFhirRepo from patientFhirRepo.ts instead.
 * This legacy repo doesn't support multi-patient scenarios.
 */
export function createFhirRepo(services: {
    fhirStore: any;
    outbox: OutboxStore;
    /** Subject ID to use for all operations. Required for outbox compatibility. */
    subjectId: string;
}) {
    const { fhirStore, outbox, subjectId } = services;

    async function init() {
        await fhirStore.init();
        await outbox.init();
    }

    async function upsert(resourceType: string, id: string, resource: any, updatedAt?: string) {
        await init();
        await fhirStore.upsert(resourceType, id, resource, updatedAt);

        // Create FHIR pointer
        const fhirPtr: FhirOutboxPointer = {
            event_id: Crypto.randomUUID(),
            op: "upsert",
            subject_id: subjectId,
            resource_type: resourceType,
            resource_id: id,
            updated_at: updatedAt ?? new Date().toISOString()
        };

        // Convert to library's OutboxPointer format
        const outboxPtr = createFhirOutboxPointer(fhirPtr);
        await outbox.enqueue([outboxPtr]);

        emit("fhir:changed");
    }

    async function markDeleted(resourceType: string, id: string, updatedAt?: string) {
        await init();
        await fhirStore.markDeleted(resourceType, id, updatedAt);

        // Create FHIR pointer
        const fhirPtr: FhirOutboxPointer = {
            event_id: Crypto.randomUUID(),
            op: "delete",
            subject_id: subjectId,
            resource_type: resourceType,
            resource_id: id,
            updated_at: updatedAt ?? new Date().toISOString()
        };

        // Convert to library's OutboxPointer format
        const outboxPtr = createFhirOutboxPointer(fhirPtr);
        await outbox.enqueue([outboxPtr]);

        emit("fhir:changed");
    }

    async function list(resourceType: string, opts?: any) {
        await init();
        return fhirStore.list(resourceType, opts);
    }

    async function get(resourceType: string, id: string) {
        await init();
        return fhirStore.get(resourceType, id);
    }

    return { init, upsert, markDeleted, list, get };
}
