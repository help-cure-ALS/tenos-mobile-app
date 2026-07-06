/**
 * PatientProvider — Tenant boundary for patient-scoped UI.
 *
 * Use with key={activePatientId} in the layout to force unmount/remount
 * of all children when the active patient changes. This ensures:
 * - Fresh React state in all screens (no stale closures)
 * - Cache invalidation by natural remount (no manual emit needed)
 * - Clean DefinitionsProvider / MedicationsProvider / StudiesProvider state
 *
 * Stores remain in AppSyncProvider (above this boundary) because
 * applyPulledEvents needs direct access to them. The stores are
 * re-created via useMemo when activePatientId changes as a prop.
 */
import React from 'react';

type PatientProviderProps = {
    children: React.ReactNode;
};

export function PatientProvider({ children }: PatientProviderProps) {
    return <>{children}</>;
}
