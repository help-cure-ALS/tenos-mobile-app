import type { PatientIdentity } from "../../src/stores/managedPatientsStore";
import {
    checkRecoveryEligibility,
    markRecoveryAttempt,
    requirePatientIdentity,
} from "../../src/sync/recoveryPolicy";

type TestCase = {
    name: string;
    fn: () => void;
};

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

const FULL_IDENTITY: PatientIdentity = {
    patientId: "patient-1",
    pubkeyB64: "pub",
    seckeyB64: "sec",
    transportKeyB64: "transport",
};

export function runRecoveryPolicyUnitTests(): void {
    const tests: TestCase[] = [
        {
            name: "eligible recovery for managed role",
            fn: () => {
                const result = checkRecoveryEligibility({
                    enabled: true,
                    activePatientId: "patient-1",
                    role: "doctor",
                    isSwitching: false,
                    pendingOutbox: 0,
                    attemptedPatientIds: new Set<string>(),
                });
                assert(result.ok, "expected eligible recovery");
            },
        },
        {
            name: "blocks recovery when already attempted",
            fn: () => {
                const result = checkRecoveryEligibility({
                    enabled: true,
                    activePatientId: "patient-1",
                    role: "doctor",
                    isSwitching: false,
                    pendingOutbox: 0,
                    attemptedPatientIds: new Set<string>(["patient-1"]),
                });
                if (result.ok) {
                    throw new Error("expected blocked recovery");
                }
                assert("reason" in result && result.reason === "already_attempted", "expected already_attempted");
            },
        },
        {
            name: "blocks recovery with pending outbox",
            fn: () => {
                const result = checkRecoveryEligibility({
                    enabled: true,
                    activePatientId: "patient-1",
                    role: "caregiver",
                    isSwitching: false,
                    pendingOutbox: 2,
                    attemptedPatientIds: new Set<string>(),
                });
                if (result.ok) {
                    throw new Error("expected blocked recovery");
                }
                assert("reason" in result && result.reason === "pending_outbox", "expected pending_outbox");
            },
        },
        {
            name: "marks recovery attempt only once",
            fn: () => {
                const attempts = new Set<string>();
                const first = markRecoveryAttempt(attempts, "patient-1");
                const second = markRecoveryAttempt(attempts, "patient-1");
                assert(first, "first attempt should be accepted");
                assert(!second, "second attempt should be rejected");
            },
        },
        {
            name: "throws missing_patient_identity on null identity",
            fn: () => {
                let thrown: any = null;
                try {
                    requirePatientIdentity("patient-1", null);
                } catch (e: any) {
                    thrown = e;
                }
                assert(!!thrown, "expected error to be thrown");
                assert(thrown.code === "missing_patient_identity", "expected missing_patient_identity code");
            },
        },
        {
            name: "returns identity when present",
            fn: () => {
                const identity = requirePatientIdentity("patient-1", FULL_IDENTITY);
                assert(identity.patientId === "patient-1", "unexpected identity payload");
            },
        },
    ];

    for (const t of tests) {
        t.fn();
    }
}
