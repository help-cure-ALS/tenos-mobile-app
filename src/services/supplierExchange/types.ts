// Supplier Exchange types

import type { AidCategory, AidStatus } from '@/src/aids/types';

// Integration metadata and selection policy are defined in patientPreferencesStore
// (canonical location for synced data). Re-export for convenience:
export type { SupplierIntegrationMeta as SupplierIntegration } from '@/src/stores/patientPreferencesStore';
export type { SupplierSelectionPolicy } from '@/src/stores/patientPreferencesStore';

// Exchange tracking (local store - NOT synced)
export type SupplierExchangeState = {
    integrationId: string;
    cursor?: string;
    lastBundleHash?: string;
    lastRunAt?: string;
};

// Proxy proposal (NOT in FHIR - fetched from proxy, locally cached)
export type SupplierProposal = {
    proposal_id: string;
    organization_id: string;
    organization_name: string;
    catalog_id?: string;
    name: string;
    category: AidCategory;
    reason?: string;
    created_at: string;
};

// Country-specific workflow policy (from proxy, cached)
export type WorkflowPolicy = {
    country: string;
    transitions: WorkflowTransition[];
    notify_provider_on: AidStatus[];
};

export type WorkflowTransition = {
    from: AidStatus;
    to: AidStatus;
    allowed_roles: ('patient' | 'caregiver' | 'doctor')[];
};

// Audit record per transition (stored in AidItem)
export type AidTransitionRecord = {
    from: AidStatus;
    to: AidStatus;
    role: string;
    deviceId: string;
    timestamp: string;
};

// Organization from proxy listing
export type SupplierOrganization = {
    id: string;
    name: string;
    country: string;
    specialty: string;
    address?: string;
    phone?: string;
    email?: string;
};

// Link request details from proxy
export type LinkRequestDetails = {
    organization_id: string;
    organization_name: string;
    specialty: string;
    expires_at: string;
};

// Local exchange store data
export type SupplierExchangeStoreData = {
    exchangeStates: Record<string, SupplierExchangeState>;
    declinedProposals: string[];
    // Proposals cached by background service, keyed by integrationId
    cachedProposals?: Record<string, SupplierProposal[]>;
};
