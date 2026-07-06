export type VaultErrorCode =
    | "no_subject_id"
    | "unknown_subject"
    | "token_revoked"
    | "subject_disabled"
    | "device_disabled"
    | "bad_signature"
    | "device_limit_reached"
    | "rate_limited"
    | "server_error"
    | "network_error"
    | "invalid_response"
    | "not_found"
    | "key_mismatch"
    | "identity_inconsistent"
    | "missing_patient_identity";

export type KeyMismatchDiag = {
    code: "key_mismatch";
    incoming_pubkey_fpr: string;
    existing_pubkey_fpr: string;
    fpr_length: number;
};

export class VaultError extends Error {
    code: VaultErrorCode;
    status?: number;
    bodyText?: string;
    diag?: KeyMismatchDiag;

    constructor(code: VaultErrorCode, message: string, opts?: { status?: number; bodyText?: string; diag?: KeyMismatchDiag }) {
        super(message);
        this.code = code;
        this.status = opts?.status;
        this.bodyText = opts?.bodyText;
        this.diag = opts?.diag;
    }
}
