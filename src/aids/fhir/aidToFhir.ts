// FHIR DeviceRequest conversion for assistive aids

import * as Crypto from 'expo-crypto';
import type { AidCategory, AidItem, AidStatus, AidTransitionRecord } from '../types';

const AID_META_URL = 'urn:medical-sync-vault:aid-meta';

type FhirExtension = {
    url: string;
    valueString?: string;
};

type FhirDeviceRequest = {
    resourceType: 'DeviceRequest';
    id: string;
    status: 'draft' | 'active' | 'completed' | 'entered-in-error';
    intent: 'proposal' | 'plan' | 'order';
    codeCodeableConcept: {
        text: string;
    };
    note?: Array<{ text: string }>;
    meta?: {
        lastUpdated?: string;
        extension?: FhirExtension[];
    };
};

type AidMetaPayload = {
    id: string;
    catalogId?: string;
    name: string;
    category: AidCategory;
    status: AidStatus;
    createdAt: string;
    updatedAt: string;
    source?: 'user' | 'supplier';
    supplierIntegrationId?: string;
    supplierProposalId?: string;
    supplierReason?: string;
    transitions?: AidTransitionRecord[];
};

function parseJson<T>(value?: string): T | null {
    if (!value) return null;
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}

function getExtension(resource: { meta?: { extension?: FhirExtension[] } }, url: string): FhirExtension | null {
    return resource.meta?.extension?.find((x) => x.url === url) ?? null;
}

function aidStatusToFhirStatus(status: AidStatus): FhirDeviceRequest['status'] {
    switch (status) {
        case 'approved': return 'active';
        case 'rejected': return 'completed';
        case 'requested': return 'draft';
        default: return 'draft';
    }
}

export function aidToFhir(item: AidItem): FhirDeviceRequest {
    const metaPayload: AidMetaPayload = {
        id: item.id,
        catalogId: item.catalogId,
        name: item.name,
        category: item.category,
        status: item.status,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        source: item.source,
        supplierIntegrationId: item.supplierIntegrationId,
        supplierProposalId: item.supplierProposalId,
        supplierReason: item.supplierReason,
        transitions: item.transitions,
    };

    return {
        resourceType: 'DeviceRequest',
        id: item.id,
        status: aidStatusToFhirStatus(item.status),
        intent: 'plan',
        codeCodeableConcept: {
            text: item.name,
        },
        note: item.notes ? [{ text: item.notes }] : undefined,
        meta: {
            lastUpdated: item.updatedAt,
            extension: [
                {
                    url: AID_META_URL,
                    valueString: JSON.stringify(metaPayload),
                },
            ],
        },
    };
}

export function fhirToAid(resource: unknown): AidItem | null {
    const r = resource as FhirDeviceRequest;
    if (!r || r.resourceType !== 'DeviceRequest' || !r.id) return null;

    const metaExt = getExtension(r, AID_META_URL);
    const meta = parseJson<AidMetaPayload>(metaExt?.valueString);

    // Only parse resources that have our meta extension (not other DeviceRequests)
    if (!meta) return null;

    const fallbackDate = r.meta?.lastUpdated ?? new Date().toISOString();

    return {
        id: r.id,
        catalogId: meta.catalogId,
        name: meta.name ?? r.codeCodeableConcept?.text ?? '',
        category: meta.category ?? 'daily_living',
        status: meta.status ?? 'none',
        notes: r.note?.[0]?.text,
        createdAt: meta.createdAt ?? fallbackDate,
        updatedAt: meta.updatedAt ?? fallbackDate,
        source: meta.source,
        supplierIntegrationId: meta.supplierIntegrationId,
        supplierProposalId: meta.supplierProposalId,
        supplierReason: meta.supplierReason,
        transitions: meta.transitions,
    };
}

export function createAidDraft(input: Partial<AidItem>): AidItem {
    const now = new Date().toISOString();
    return {
        id: Crypto.randomUUID(),
        catalogId: input.catalogId,
        name: input.name ?? '',
        category: input.category ?? 'daily_living',
        status: input.status ?? 'none',
        notes: input.notes,
        createdAt: now,
        updatedAt: now,
        source: input.source,
        supplierIntegrationId: input.supplierIntegrationId,
        supplierProposalId: input.supplierProposalId,
        supplierReason: input.supplierReason,
        transitions: input.transitions,
    };
}
