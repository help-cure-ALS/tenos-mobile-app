import type { VaultConfig, ChallengeResponse, IssueTokenResponse } from "../types";
import type { Storage } from "../storage/types";
import type { Keybag } from "../storage/keybag";
import { VaultError } from "../errors";
import { decodeBase64, encodeUTF8 } from "tweetnacl-util";
import {
    baseUrlNoSlash,
    safeText,
    isUnknownSubjectResponse,
    isDeviceLimitReached,
    isRateLimited
} from "../util";
import { registerSubjectIfNeeded } from "./register";
import { getOrCreateEd25519Keypair, signDetachedB64 } from "../crypto/ed25519";
import { clearCursorV2 } from "../cursor/cursor";

const AUTH_TIMEOUT_MS = 15000; // 15 seconds

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } catch (e: any) {
        if (e?.name === "AbortError") {
            throw new VaultError("network_error", "Auth request timeout");
        }
        throw new VaultError("network_error", e?.message ?? "network_error");
    } finally {
        clearTimeout(timeoutId);
    }
}

async function resetAuthState(store: Storage, K: Keybag): Promise<void> {
    await store.del(K.ACCESS_TOKEN);
    await store.del(K.SUBJECT_REGISTERED);

    await store.del(K.SUBJECT_ID);
    await store.del(K.PUBKEY_B64);
    await store.del(K.SECKEY_B64);

    await clearCursorV2(store, K);
}

function decodeJwtPayload(token: string): Record<string, any> | null {
    try {
        const parts = String(token ?? "").split(".");
        if (parts.length < 2) return null;

        let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const mod = b64.length % 4;
        if (mod === 2) b64 += "==";
        else if (mod === 3) b64 += "=";
        else if (mod !== 0) return null;

        const json = encodeUTF8(decodeBase64(b64));
        const parsed = JSON.parse(json);
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
        return null;
    }
}

export async function issueToken(cfg: VaultConfig, store: Storage, K: Keybag): Promise<string> {
    const baseUrl = baseUrlNoSlash(cfg.baseUrl);
    const subject_id = await store.get(K.SUBJECT_ID);
    const device_id = await store.get(K.DEVICE_ID);

    if (!subject_id || !device_id) {
        throw new VaultError("no_subject_id", "no_subject_id");
    }

    const { secretKeyB64 } = await getOrCreateEd25519Keypair(store, K);

    try {
        await registerSubjectIfNeeded(cfg, store, K);
    }
    catch (e: any) {
        if (e?.code !== "key_mismatch") {
            await store.del(K.SUBJECT_REGISTERED);
        }
        throw e;
    }

    // challenge
    const chRes = await fetchWithTimeout(`${ baseUrl }/auth/challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-App-Token": cfg.appIssueToken },
        body: JSON.stringify({ subject_id, device_id })
    });

    if (!chRes.ok) {
        const text = await safeText(chRes);

        if (isUnknownSubjectResponse(chRes.status, text)) {
            await resetAuthState(store, K);
            throw new VaultError("unknown_subject", "unknown_subject", { status: chRes.status, bodyText: text });
        }
        if (chRes.status === 403 && text.includes("subject_disabled")) {
            await resetAuthState(store, K);
            throw new VaultError("subject_disabled", "subject_disabled", { status: chRes.status, bodyText: text });
        }
        if (isRateLimited(chRes.status)) {
            throw new VaultError("rate_limited", "rate_limited", { status: chRes.status, bodyText: text });
        }

        throw new VaultError("server_error", `auth/challenge failed: ${ chRes.status }`, {
            status: chRes.status,
            bodyText: text
        });
    }

    const ch = (await chRes.json()) as ChallengeResponse;

    if (!ch?.challenge_id || !ch?.challenge_b64) {
        throw new VaultError("invalid_response", "auth/challenge invalid response");
    }

    const msg = `issue|${ subject_id }|${ device_id }|${ ch.challenge_id }|${ ch.challenge_b64 }`;
    const signature_b64 = signDetachedB64(msg, secretKeyB64);

    // issue
    const issRes = await fetchWithTimeout(`${ baseUrl }/auth/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-App-Token": cfg.appIssueToken },
        body: JSON.stringify({ subject_id, device_id, challenge_id: ch.challenge_id, signature_b64 })
    });

    if (!issRes.ok) {
        const text = await safeText(issRes);

        if (isUnknownSubjectResponse(issRes.status, text)) {
            await resetAuthState(store, K);
            throw new VaultError("unknown_subject", "unknown_subject", { status: issRes.status, bodyText: text });
        }

        if (issRes.status === 403 && text.includes("subject_disabled")) {
            await resetAuthState(store, K);
            throw new VaultError("subject_disabled", "subject_disabled", { status: issRes.status, bodyText: text });
        }

        if (isDeviceLimitReached(issRes.status, text)) {
            throw new VaultError("device_limit_reached", "device_limit_reached", {
                status: issRes.status,
                bodyText: text
            });
        }

        if (isRateLimited(issRes.status)) {
            throw new VaultError("rate_limited", "rate_limited", { status: issRes.status, bodyText: text });
        }

        if (issRes.status === 401 && text.includes("bad_signature")) {
            throw new VaultError("bad_signature", "bad_signature", { status: 401, bodyText: text });
        }

        // T-002: this device's access was revoked — surface a dedicated code so the
        // sync layer triggers a local wipe even when a fresh token has to be issued.
        if (issRes.status === 403 && text.includes("device_disabled")) {
            throw new VaultError("device_disabled", "device_disabled", { status: 403, bodyText: text });
        }

        throw new VaultError("server_error", `auth/issue failed: ${ issRes.status }`, {
            status: issRes.status,
            bodyText: text
        });
    }

    const data = (await issRes.json()) as IssueTokenResponse;

    if (!data?.access_token) {
        throw new VaultError("invalid_response", "auth/issue returned no access_token");
    }

    await store.set(K.ACCESS_TOKEN, data.access_token);
    return data.access_token;
}

export async function ensureToken(cfg: VaultConfig, store: Storage, K: Keybag): Promise<string> {
    const t = await store.get(K.ACCESS_TOKEN);

    if (t) {
        const sid = await store.get(K.SUBJECT_ID);
        const did = await store.get(K.DEVICE_ID);
        const payload = decodeJwtPayload(t);

        // Re-use token only when it matches current identity.
        if (payload?.sub === sid && payload?.device_id === did) {
            return t;
        }

        await store.del(K.ACCESS_TOKEN);
    }

    return issueToken(cfg, store, K);
}
