import { parseKeyMismatchDiag } from "../../src/lib/medical-sync-vault/auth/keyMismatchDiag";

type TestCase = {
    name: string;
    fn: () => void;
};

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

export function runKeyMismatchDiagUnitTests(): void {
    const tests: TestCase[] = [
        {
            name: "parses structured key mismatch diag from 409 body",
            fn: () => {
                const parsed = parseKeyMismatchDiag(JSON.stringify({
                    error: "subject_exists_with_different_key",
                    diag: {
                        code: "key_mismatch",
                        incoming_pubkey_fpr: "incomingfpr1234",
                        existing_pubkey_fpr: "existingfpr9876",
                        fpr_length: 16,
                    }
                }));

                assert(parsed, "expected diag to be parsed");
                assert(parsed.code === "key_mismatch", "expected key_mismatch code");
                assert(parsed.incoming_pubkey_fpr === "incomingfpr1234", "unexpected incoming fingerprint");
                assert(parsed.existing_pubkey_fpr === "existingfpr9876", "unexpected existing fingerprint");
                assert(parsed.fpr_length === 16, "unexpected fpr_length");
            },
        },
        {
            name: "returns undefined for 409 body without diag",
            fn: () => {
                const parsed = parseKeyMismatchDiag(JSON.stringify({
                    error: "subject_exists_with_different_key",
                }));
                assert(!parsed, "expected undefined diag");
            },
        },
        {
            name: "returns undefined for malformed diag payload",
            fn: () => {
                const parsed = parseKeyMismatchDiag(JSON.stringify({
                    error: "subject_exists_with_different_key",
                    diag: {
                        code: "key_mismatch",
                        incoming_pubkey_fpr: 123,
                        existing_pubkey_fpr: "existingfpr9876",
                        fpr_length: "16",
                    }
                }));
                assert(!parsed, "expected undefined for malformed diag");
            },
        },
        {
            name: "returns undefined for non-JSON body",
            fn: () => {
                const parsed = parseKeyMismatchDiag("plain text body");
                assert(!parsed, "expected undefined for non-JSON body");
            },
        },
    ];

    for (const t of tests) {
        t.fn();
    }
}
