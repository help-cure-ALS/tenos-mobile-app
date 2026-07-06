import type { VaultConfig, VaultEvent, BatchResponse, PullResponseV2, CursorV2 } from "../types";
import type { Storage } from "../storage/types";
import type { Keybag } from "../storage/keybag";
import { VaultError } from "../errors";
import { safeText } from "../util";
import { vaultFetch } from "./fetch";

/**
 * T-002: a 403 `device_disabled` means this device's access was revoked. Surface a
 * dedicated error code so the sync layer can trigger a local wipe of the subject.
 */
function eventsError(res: Response, text: string, label: string): VaultError {
    if ((res.status === 401 || res.status === 404) && text.includes("unknown_subject")) {
        return new VaultError("unknown_subject", "unknown_subject", { status: res.status, bodyText: text });
    }
    if (res.status === 403 && text.includes("subject_disabled")) {
        return new VaultError("subject_disabled", "subject_disabled", { status: 403, bodyText: text });
    }
    if (res.status === 403 && text.includes("device_disabled")) {
        return new VaultError("device_disabled", "device_disabled", { status: 403, bodyText: text });
    }
    return new VaultError("server_error", `${ label }: ${ res.status }`, { status: res.status, bodyText: text });
}

export async function pushEvents(cfg: VaultConfig, store: Storage, K: Keybag, events: VaultEvent[]): Promise<BatchResponse> {
    const sid = await store.get(K.SUBJECT_ID);

    if (!sid) {
        throw new VaultError("no_subject_id", "no_subject_id");
    }

    const res = await vaultFetch(cfg, store, K, "/events/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events })
    });

    if (!res.ok) {
        const text = await safeText(res);
        throw eventsError(res, text, "events/batch failed");
    }

    return res.json();
}

export async function pullEvents(
    cfg: VaultConfig,
    store: Storage,
    K: Keybag,
    opts?: { cursor?: CursorV2 | null; limit?: number }
): Promise<PullResponseV2> {
    const sid = await store.get(K.SUBJECT_ID);

    if (!sid) {
        return { events: [], next: null };
    }

    const qs = new URLSearchParams();
    qs.set("limit", String(opts?.limit ?? 500));

    const c = opts?.cursor;

    if (c?.since_ts && c?.since_id) {
        qs.set("since_ts", c.since_ts);
        qs.set("since_id", c.since_id);
    }

    const res = await vaultFetch(cfg, store, K, `/events?${ qs.toString() }`, { method: "GET" });

    if (!res.ok) {
        const text = await safeText(res);
        throw eventsError(res, text, "events pull failed");
    }

    return res.json();
}

export async function head(cfg: VaultConfig, store: Storage, K: Keybag): Promise<{ head: CursorV2 | null }> {
    const sid = await store.get(K.SUBJECT_ID);

    if (!sid) {
        return { head: null };
    }

    const res = await vaultFetch(cfg, store, K, "/events/head", { method: "GET" });

    if (!res.ok) {
        const text = await safeText(res);
        throw eventsError(res, text, "events/head failed");
    }

    return res.json();
}
