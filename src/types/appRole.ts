/**
 * App Role Types
 *
 * Defines the different user roles and their scopes within the app.
 */

export type AppRole = "patient" | "caregiver" | "doctor" | "demo";

/**
 * ActiveScope defines the current user context based on their role.
 * This is persisted in SecureStore.
 */
export type ActiveScope =
    | { role: "patient"; subjectId: string }
    | { role: "caregiver"; caregiverId: string; patientIds: string[]; activePatientId: string }
    | { role: "doctor"; doctorId: string; grantedPatientIds: string[]; activePatientId: string }
    | { role: "demo" };

/**
 * PatientAlias stores local-only labels for patients.
 * This is NEVER synchronized - only stored locally on the device.
 * Allows caregivers to distinguish between patients while maintaining anonymity.
 */
export type PatientAlias = {
    patientId: string;
    localName: string;
    color?: string;
    icon?: string;
    notes?: string;
    addedAt: string;
};

/**
 * Store for all patient aliases (local only)
 */
export type PatientAliasStore = {
    aliases: PatientAlias[];
};

/**
 * Helper type to extract role from scope
 */
export function getRoleFromScope(scope: ActiveScope | null): AppRole | null {
    return scope?.role ?? null;
}

/**
 * Helper type to get active patient ID from any scope
 */
export function getActivePatientIdFromScope(scope: ActiveScope | null): string | null {
    if (!scope) return null;

    switch (scope.role) {
        case "patient":
            return scope.subjectId;
        case "caregiver":
        case "doctor":
            return scope.activePatientId;
        case "demo":
            return "demo-patient";
        default:
            return null;
    }
}

/**
 * Helper to check if scope has multiple patients
 */
export function hasMultiplePatients(scope: ActiveScope | null): boolean {
    if (!scope) return false;

    switch (scope.role) {
        case "caregiver":
            return scope.patientIds.length > 1;
        case "doctor":
            return scope.grantedPatientIds.length > 1;
        default:
            return false;
    }
}

/**
 * Helper to get all patient IDs from scope
 */
export function getAllPatientIds(scope: ActiveScope | null): string[] {
    if (!scope) return [];

    switch (scope.role) {
        case "patient":
            return [scope.subjectId];
        case "caregiver":
            return scope.patientIds;
        case "doctor":
            return scope.grantedPatientIds;
        case "demo":
            return ["demo-patient"];
        default:
            return [];
    }
}
