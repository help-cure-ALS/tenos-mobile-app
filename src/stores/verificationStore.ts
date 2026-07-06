/**
 * VerificationStore - Thin convenience API for ALS diagnosis verification.
 *
 * The actual data lives inside PatientPreferences (field `verification`),
 * so it syncs automatically via the existing FHIR Basic resource.
 */
import type { PatientPreferencesStore, VerificationState } from './patientPreferencesStore';

export type { VerificationState };
export type VerificationStatus = VerificationState['status'];

/** Read current verification state (null if never started) */
export async function getVerification(store: PatientPreferencesStore): Promise<VerificationState | null> {
    const prefs = await store.getAll();
    return prefs.verification ?? null;
}

/** Write verification state (triggers sync via patientPreferencesStore) */
export async function setVerification(store: PatientPreferencesStore, state: VerificationState): Promise<void> {
    await store.setVerification(state);
}

/** Clear verification state */
export async function clearVerification(store: PatientPreferencesStore): Promise<void> {
    await store.setVerification(undefined);
}
