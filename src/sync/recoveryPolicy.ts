import { VaultError } from "../lib/medical-sync-vault/errors";
import type { PatientIdentity } from "../stores/managedPatientsStore";

export type RecoveryBlockedReason =
    | "disabled"
    | "missing_active_patient"
    | "invalid_role"
    | "switch_in_progress"
    | "pending_outbox"
    | "already_attempted";

export type RecoveryEligibilityInput = {
    enabled: boolean;
    activePatientId: string | null;
    role: string | null | undefined;
    isSwitching: boolean;
    pendingOutbox: number;
    attemptedPatientIds: ReadonlySet<string>;
};

export type RecoveryEligibilityResult =
    | { ok: true }
    | { ok: false; reason: RecoveryBlockedReason };

const MANAGED_ROLES = new Set(["caregiver", "doctor"]);

export function checkRecoveryEligibility(input: RecoveryEligibilityInput): RecoveryEligibilityResult {
    if (!input.enabled) {
        return { ok: false, reason: "disabled" };
    }
    if (!input.activePatientId) {
        return { ok: false, reason: "missing_active_patient" };
    }
    if (!MANAGED_ROLES.has(String(input.role ?? ""))) {
        return { ok: false, reason: "invalid_role" };
    }
    if (input.isSwitching) {
        return { ok: false, reason: "switch_in_progress" };
    }
    if (input.pendingOutbox > 0) {
        return { ok: false, reason: "pending_outbox" };
    }
    if (input.attemptedPatientIds.has(input.activePatientId)) {
        return { ok: false, reason: "already_attempted" };
    }
    return { ok: true };
}

export function markRecoveryAttempt(attemptedPatientIds: Set<string>, patientId: string): boolean {
    if (attemptedPatientIds.has(patientId)) {
        return false;
    }
    attemptedPatientIds.add(patientId);
    return true;
}

export function requirePatientIdentity(
    patientId: string,
    identity: PatientIdentity | null
): PatientIdentity {
    if (!identity) {
        throw new VaultError("missing_patient_identity", `missing_patient_identity:${patientId}`);
    }
    return identity;
}
