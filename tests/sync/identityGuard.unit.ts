import { checkIdentityInvariant, decodeJwtIdentity } from "../../src/sync/identityGuard";

type TestCase = {
    name: string;
    fn: () => void;
};

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

const VALID_TOKEN = "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJwYXRpZW50LTEiLCJkZXZpY2VfaWQiOiJkZXZpY2UtMSJ9.x";

export function runIdentityGuardUnitTests(): void {
    const tests: TestCase[] = [
        {
            name: "accepts consistent identity state",
            fn: () => {
                const result = checkIdentityInvariant({
                    activePatientId: "patient-1",
                    subjectId: "patient-1",
                    pubkeyB64: "pub",
                    seckeyB64: "sec",
                    deviceId: "device-1",
                    tokenSub: "patient-1",
                    tokenDeviceId: "device-1",
                    hasAccessToken: true,
                });
                assert(result.ok, "expected invariant to pass");
            },
        },
        {
            name: "fails on missing signing key",
            fn: () => {
                const result = checkIdentityInvariant({
                    activePatientId: "patient-1",
                    subjectId: "patient-1",
                    pubkeyB64: null,
                    seckeyB64: "sec",
                    deviceId: "device-1",
                    tokenSub: "patient-1",
                    tokenDeviceId: "device-1",
                    hasAccessToken: false,
                });
                if (result.ok) {
                    throw new Error("expected invariant failure");
                }
                assert("reason" in result && result.reason === "missing_pubkey", "expected missing_pubkey");
            },
        },
        {
            name: "fails on subject mismatch",
            fn: () => {
                const result = checkIdentityInvariant({
                    activePatientId: "patient-2",
                    subjectId: "patient-1",
                    pubkeyB64: "pub",
                    seckeyB64: "sec",
                    deviceId: "device-1",
                    tokenSub: "patient-1",
                    tokenDeviceId: "device-1",
                    hasAccessToken: false,
                });
                if (result.ok) {
                    throw new Error("expected invariant failure");
                }
                assert("reason" in result && result.reason === "subject_mismatch", "expected subject_mismatch");
            },
        },
        {
            name: "fails on JWT subject mismatch",
            fn: () => {
                const result = checkIdentityInvariant({
                    activePatientId: "patient-1",
                    subjectId: "patient-1",
                    pubkeyB64: "pub",
                    seckeyB64: "sec",
                    deviceId: "device-1",
                    tokenSub: "patient-2",
                    tokenDeviceId: "device-1",
                    hasAccessToken: true,
                });
                if (result.ok) {
                    throw new Error("expected invariant failure");
                }
                assert("reason" in result && result.reason === "token_subject_mismatch", "expected token_subject_mismatch");
            },
        },
        {
            name: "decodes token subject and device id",
            fn: () => {
                const parsed = decodeJwtIdentity(VALID_TOKEN);
                assert(parsed.valid, "expected valid token parse");
                assert(parsed.sub === "patient-1", "unexpected token subject");
                assert(parsed.deviceId === "device-1", "unexpected token device id");
            },
        },
        {
            name: "flags malformed token payload",
            fn: () => {
                const parsed = decodeJwtIdentity("invalid-token");
                assert(!parsed.valid, "expected malformed token parse to fail");
            },
        },
    ];

    for (const t of tests) {
        t.fn();
    }
}
