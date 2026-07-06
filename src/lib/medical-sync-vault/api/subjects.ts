import type { VaultConfig } from "../types";
import type { Storage } from "../storage/types";
import type { Keybag } from "../storage/keybag";
import { VaultError } from "../errors";
import { baseUrlNoSlash, safeText } from "../util";
import { vaultFetch } from "./fetch";

/**
 * Look up a subject_id by its Ed25519 public key (for account recovery).
 * Uses the app token (not a JWT) since the subject is not yet authenticated.
 */
export async function lookupSubjectByPubkey(
    cfg: VaultConfig,
    publicKeyB64: string,
): Promise<{ subject_id: string }> {
    const res = await fetch(`${baseUrlNoSlash(cfg.baseUrl)}/subjects/by-pubkey`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-app-token": cfg.appIssueToken,
        },
        body: JSON.stringify({ public_key_b64: publicKeyB64 }),
    });

    if (res.status === 404) {
        throw new VaultError("not_found", "Subject not found for this public key");
    }

    if (!res.ok) {
        const text = await safeText(res);
        throw new VaultError("server_error", `by-pubkey failed: ${res.status}`, {
            status: res.status,
            bodyText: text,
        });
    }

    return res.json();
}

/**
 * Delete all server-side data for the authenticated subject (GDPR hard-delete).
 * Idempotent: returns success even if the subject was already deleted.
 */
export async function deleteSubjectData(
    cfg: VaultConfig,
    store: Storage,
    K: Keybag,
): Promise<{ ok: boolean; deleted_events: number }> {
    let res: Response;
    try {
        res = await vaultFetch(cfg, store, K, "/subjects/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
        });
    } catch (e: any) {
        // vaultFetch → ensureToken → issueToken can throw unknown_subject
        // if the subject was already deleted. Treat as success (idempotent).
        if (e?.code === "unknown_subject") {
            return { ok: true, deleted_events: 0 };
        }
        throw e;
    }

    if (!res.ok) {
        const text = await safeText(res);
        throw new VaultError("server_error", `subjects/delete failed: ${res.status}`, {
            status: res.status,
            bodyText: text,
        });
    }

    return res.json();
}
