import type { VaultConfig } from "../types";
import type { Storage } from "../storage/types";
import type { Keybag } from "../storage/keybag";
import { VaultError } from "../errors";
import { baseUrlNoSlash, safeText, includesTokenRevoked, isUnknownSubjectResponse } from "../util";
import { ensureToken, issueToken } from "../auth/issueToken";

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds

export async function vaultFetch(cfg: VaultConfig, store: Storage, K: Keybag, path: string, init?: RequestInit) {
    if (path !== "/healthz") {
        const sid = await store.get(K.SUBJECT_ID);

        if (!sid) {
            throw new VaultError("no_subject_id", "no_subject_id");
        }
    }

    const baseUrl = baseUrlNoSlash(cfg.baseUrl);
    const url = `${ baseUrl }${ path.startsWith("/") ? "" : "/" }${ path }`;

    let token = await ensureToken(cfg, store, K);

    const doFetch = async (t: string): Promise<Response> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                ...init,
                headers: {
                    ...(init?.headers ?? {}),
                    Authorization: `Bearer ${ t }`
                },
                signal: controller.signal
            });
            return response;
        } finally {
            clearTimeout(timeoutId);
        }
    };

    let res: Response;

    try {
        res = await doFetch(token);
    }
    catch (e: any) {
        if (e?.name === "AbortError") {
            throw new VaultError("network_error", "Request timeout");
        }
        throw new VaultError("network_error", e?.message ?? "network_error");
    }

    if (res.status === 401) {
        const text = await safeText(res.clone());

        if (includesTokenRevoked(text)) {
            await store.del(K.ACCESS_TOKEN);
            token = await issueToken(cfg, store, K);
            res = await doFetch(token);
            return res;
        }

        if (isUnknownSubjectResponse(404, text) || text.includes("unknown_subject")) {
            // let auth layer handle by re-issuing (might still fail with unknown_subject)
            await store.del(K.ACCESS_TOKEN);
            token = await issueToken(cfg, store, K);
            res = await doFetch(token);
            return res;
        }

        // generic 401 -> re-issue once
        await store.del(K.ACCESS_TOKEN);
        token = await issueToken(cfg, store, K);
        res = await doFetch(token);
    }

    return res;
}
