import type { KeyMismatchDiag } from "../errors";

function isNonEmptyString(v: unknown): v is string {
    return typeof v === "string" && v.length > 0;
}

export function parseKeyMismatchDiag(bodyText: string): KeyMismatchDiag | undefined {
    if (!bodyText) {
        return undefined;
    }

    try {
        const json = JSON.parse(bodyText) as { error?: unknown; diag?: unknown };
        const diag = json?.diag as Partial<KeyMismatchDiag> | undefined;
        if (!diag) {
            return undefined;
        }
        const fprLength = diag.fpr_length;

        if (
            diag.code !== "key_mismatch" ||
            !isNonEmptyString(diag.incoming_pubkey_fpr) ||
            !isNonEmptyString(diag.existing_pubkey_fpr) ||
            typeof fprLength !== "number" ||
            !Number.isInteger(fprLength) ||
            fprLength <= 0
        ) {
            return undefined;
        }

        return {
            code: "key_mismatch",
            incoming_pubkey_fpr: diag.incoming_pubkey_fpr,
            existing_pubkey_fpr: diag.existing_pubkey_fpr,
            fpr_length: fprLength,
        };
    } catch {
        return undefined;
    }
}
