import { decodeBase64, encodeUTF8 } from "tweetnacl-util";

export type IdentityInvariantReason =
    | "missing_active_patient"
    | "missing_subject"
    | "subject_mismatch"
    | "missing_pubkey"
    | "missing_seckey"
    | "missing_device_id"
    | "token_subject_mismatch"
    | "token_device_mismatch"
    | "invalid_token_payload";

export type IdentityInvariantInput = {
    activePatientId: string | null;
    subjectId: string | null;
    pubkeyB64: string | null;
    seckeyB64: string | null;
    deviceId: string | null;
    tokenSub: string | null;
    tokenDeviceId: string | null;
    hasAccessToken: boolean;
    requireSigningKeys?: boolean;
};

export type IdentityInvariantResult =
    | { ok: true }
    | { ok: false; reason: IdentityInvariantReason };

export type DecodedJwtIdentity = {
    sub: string | null;
    deviceId: string | null;
    valid: boolean;
};

export function decodeJwtIdentity(token: string | null | undefined): DecodedJwtIdentity {
    if (!token) {
        return { sub: null, deviceId: null, valid: true };
    }

    try {
        const parts = String(token).split(".");
        if (parts.length < 2) {
            return { sub: null, deviceId: null, valid: false };
        }

        let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const mod = b64.length % 4;
        if (mod === 2) b64 += "==";
        else if (mod === 3) b64 += "=";
        else if (mod !== 0) return { sub: null, deviceId: null, valid: false };

        const json = encodeUTF8(decodeBase64(b64));
        const parsed = JSON.parse(json);

        return {
            sub: typeof parsed?.sub === "string" ? parsed.sub : null,
            deviceId: typeof parsed?.device_id === "string" ? parsed.device_id : null,
            valid: true,
        };
    } catch {
        return { sub: null, deviceId: null, valid: false };
    }
}

export function checkIdentityInvariant(input: IdentityInvariantInput): IdentityInvariantResult {
    if (!input.activePatientId) {
        return { ok: false, reason: "missing_active_patient" };
    }
    if (!input.subjectId) {
        return { ok: false, reason: "missing_subject" };
    }
    if (input.subjectId !== input.activePatientId) {
        return { ok: false, reason: "subject_mismatch" };
    }
    if (input.requireSigningKeys !== false) {
        if (!input.pubkeyB64) {
            return { ok: false, reason: "missing_pubkey" };
        }
        if (!input.seckeyB64) {
            return { ok: false, reason: "missing_seckey" };
        }
    }
    if (!input.deviceId) {
        return { ok: false, reason: "missing_device_id" };
    }

    if (input.hasAccessToken) {
        if (input.tokenSub === null || input.tokenDeviceId === null) {
            return { ok: false, reason: "invalid_token_payload" };
        }
        if (input.tokenSub !== input.subjectId) {
            return { ok: false, reason: "token_subject_mismatch" };
        }
        if (input.tokenDeviceId !== input.deviceId) {
            return { ok: false, reason: "token_device_mismatch" };
        }
    }

    return { ok: true };
}
