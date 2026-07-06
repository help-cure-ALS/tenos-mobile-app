// Assistive aids types and constants

export type AidCategory = 'mobility' | 'transfer' | 'communication' | 'respiratory' | 'nutrition' | 'daily_living';

export type AidStatus = 'none' | 'suggested' | 'requested' | 'approved' | 'rejected';

// Audit record for status transitions (supplier workflow)
export type AidTransitionRecord = {
    from: AidStatus;
    to: AidStatus;
    role: string;
    deviceId: string;
    timestamp: string;
};

export type AidItem = {
    id: string;
    catalogId?: string;
    name: string;
    category: AidCategory;
    status: AidStatus;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    source?: 'user' | 'supplier';
    supplierIntegrationId?: string;
    supplierProposalId?: string;
    supplierReason?: string;
    transitions?: AidTransitionRecord[];
};

export type AidCatalogEntry = {
    id: string;
    isoClass: string;
    isoSubclass: string;
    category: AidCategory;
    subcategory: string;
    nameDe: string;
    nameEn: string;
    descriptionDe: string;
    descriptionEn: string;
    alsPhase: string;
    alsfrsArea: string;
    tags: string;
    reimbursement?: {
        de?: { productGroup: string; label: string; code: string; prescriber: string; notes: string };
        at?: { area: string; approval: string; prescriber: string; notes: string };
        ch?: { group: string; position: string; prescriber: string; notes: string };
    };
};

// Category SF Symbol icons
export const AID_CATEGORY_ICONS: Record<AidCategory, string> = {
    mobility: 'figure.roll',
    transfer: 'arrow.up.arrow.down',
    communication: 'bubble.left.and.text.bubble.right',
    respiratory: 'lungs.fill',
    nutrition: 'fork.knife',
    daily_living: 'house.fill',
};

// Category colors
export const AID_CATEGORY_COLORS: Record<AidCategory, string> = {
    mobility: '#007AFF',
    transfer: '#FF9500',
    communication: '#5856D6',
    respiratory: '#34C759',
    nutrition: '#FF2D55',
    daily_living: '#8E8E93',
};

// Status colors
export const AID_STATUS_COLORS: Record<AidStatus, string> = {
    none: '#8E8E93',
    suggested: '#5856D6',
    requested: '#FF9500',
    approved: '#34C759',
    rejected: '#FF3B30',
};

// All categories in display order
export const ALL_AID_CATEGORIES: AidCategory[] = [
    'mobility', 'transfer', 'communication', 'respiratory', 'nutrition', 'daily_living',
];
