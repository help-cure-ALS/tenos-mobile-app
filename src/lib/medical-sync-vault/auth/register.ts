import type { VaultConfig } from "../types";
import type { Storage } from "../storage/types";
import type { Keybag } from "../storage/keybag";
import { baseUrlNoSlash, safeText } from "../util";
import { VaultError } from "../errors";
import { getOrCreateEd25519Keypair, signDetachedB64 } from "../crypto/ed25519";
import { parseKeyMismatchDiag } from "./keyMismatchDiag";

const REGISTER_TIMEOUT_MS = 15000; // 15 seconds

export async function registerSubjectIfNeeded(cfg: VaultConfig, store: Storage, K: Keybag): Promise<void> {
    const registered = await store.get(K.SUBJECT_REGISTERED);

    if (registered === "1") {
        return;
    }

    const subject_id = await store.get(K.SUBJECT_ID);

    if (!subject_id) {
        throw new VaultError("no_subject_id", "no_subject_id");
    }

    const { publicKeyB64, secretKeyB64 } = await getOrCreateEd25519Keypair(store, K);

    const msg = `register|${ subject_id }|${ publicKeyB64 }`;
    const signature_b64 = signDetachedB64(msg, secretKeyB64);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REGISTER_TIMEOUT_MS);

    let res: Response;
    try {
        res = await fetch(`${ baseUrlNoSlash(cfg.baseUrl) }/subjects/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-App-Token": cfg.appIssueToken },
            body: JSON.stringify({ subject_id, public_key_b64: publicKeyB64, signature_b64 }),
            signal: controller.signal
        });
    } catch (e: any) {
        clearTimeout(timeoutId);
        if (e?.name === "AbortError") {
            throw new VaultError("network_error", "Register request timeout");
        }
        throw new VaultError("network_error", e?.message ?? "network_error");
    } finally {
        clearTimeout(timeoutId);
    }

    if (!res.ok) {
        const text = await safeText(res);

        if (res.status === 409) {
            const diag = parseKeyMismatchDiag(text);
            throw new VaultError("key_mismatch", "subjects/register: key mismatch", {
                status: res.status,
                bodyText: text,
                diag
            });
        }

        throw new VaultError("server_error", `subjects/register failed: ${ res.status }`, {
            status: res.status,
            bodyText: text
        });
    }

    await store.set(K.SUBJECT_REGISTERED, "1");
}
