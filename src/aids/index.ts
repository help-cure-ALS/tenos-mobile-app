// Barrel export for aids module

// Types and constants
export type { AidCategory, AidCatalogEntry, AidItem, AidStatus, AidTransitionRecord } from './types';
export {
    AID_CATEGORY_ICONS,
    AID_CATEGORY_COLORS,
    AID_STATUS_COLORS,
    ALL_AID_CATEGORIES,
} from './types';

// Catalog
export {
    AID_CATALOG,
    getCatalogEntry,
    getCatalogByCategory,
    getCatalogName,
    getCatalogDescription,
    getReimbursementInfo,
} from './catalog';

// FHIR conversion
export { aidToFhir, fhirToAid, createAidDraft } from './fhir/aidToFhir';

// Hook
export { useAids } from './hooks/useAids';
export type { UseAidsResult } from './hooks/useAids';
