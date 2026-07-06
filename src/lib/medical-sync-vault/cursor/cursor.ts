import type { Storage } from "../storage/types";
import type { Keybag } from "../storage/keybag";
import type { CursorV2 } from "../types";

export async function getCursorV2(store: Storage, K: Keybag): Promise<CursorV2 | null> {
    const since_ts = await store.get(K.CURSOR_SINCE_TS);
    const since_id = await store.get(K.CURSOR_SINCE_ID);

    if (!since_ts || !since_id) {
        return null;
    }

    return { since_ts, since_id };
}

export async function setCursorV2(store: Storage, K: Keybag, c: CursorV2): Promise<void> {
    await store.set(K.CURSOR_SINCE_TS, c.since_ts);
    await store.set(K.CURSOR_SINCE_ID, c.since_id);
}

export async function clearCursorV2(store: Storage, K: Keybag): Promise<void> {
    await store.del(K.CURSOR_SINCE_TS);
    await store.del(K.CURSOR_SINCE_ID);
}
