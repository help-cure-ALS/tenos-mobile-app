import type { VaultConfig } from "../types";
import { baseUrlNoSlash, safeText } from "../util";
import { VaultError } from "../errors";

/**
 * T-002 pre-auth rendezvous mailbox client.
 *
 * Used during pairing, BEFORE the recipient is an authorized device — therefore
 * it authenticates with the App-Token only (no JWT). Carries only public
 * material / ciphertext.
 */

const RENDEZVOUS_TIMEOUT_MS = 15000;

export type RendezvousSlot = "offer" | "reply";

export type RendezvousOffer = {
    ed25519_pub_b64: string;
    x25519_pub_b64: string;
    device_id: string;
};

export type RendezvousReply = {
    wrapped_transport_key_b64: string;
    wrap_nonce_b64: string;
    sender_pub_b64: string;
};

export type RendezvousState = {
    offer: RendezvousOffer | null;
    reply: RendezvousReply | null;
};

async function rzFetch(cfg: VaultConfig, path: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RENDEZVOUS_TIMEOUT_MS);
    try {
        return await fetch(`${ baseUrlNoSlash(cfg.baseUrl) }${ path }`, {
            ...init,
            headers: {
                "Content-Type": "application/json",
                "X-App-Token": cfg.appIssueToken,
                ...(init?.headers ?? {}),
            },
            signal: controller.signal,
        });
    } catch (e: any) {
        if (e?.name === "AbortError") {
            throw new VaultError("network_error", "rendezvous timeout");
        }
        throw new VaultError("network_error", e?.message ?? "network_error");
    } finally {
        clearTimeout(timeoutId);
    }
}

function encodeToken(token: string): string {
    return encodeURIComponent(token);
}

/** Post a message into a rendezvous slot (offer = recipient→patient, reply = patient→recipient). */
export async function postRendezvous(
    cfg: VaultConfig,
    token: string,
    slot: RendezvousSlot,
    payload: RendezvousOffer | RendezvousReply,
): Promise<void> {
    const res = await rzFetch(cfg, `/rendezvous/${ encodeToken(token) }`, {
        method: "POST",
        body: JSON.stringify({ slot, payload }),
    });
    if (!res.ok) {
        const text = await safeText(res);
        throw new VaultError("server_error", `rendezvous post failed: ${ res.status }`, {
            status: res.status,
            bodyText: text,
        });
    }
}

/** Poll the current rendezvous state for a token. */
export async function getRendezvous(cfg: VaultConfig, token: string): Promise<RendezvousState> {
    const res = await rzFetch(cfg, `/rendezvous/${ encodeToken(token) }`, { method: "GET" });
    if (!res.ok) {
        const text = await safeText(res);
        throw new VaultError("server_error", `rendezvous get failed: ${ res.status }`, {
            status: res.status,
            bodyText: text,
        });
    }
    const data = (await res.json()) as RendezvousState;
    return {
        offer: data?.offer ?? null,
        reply: data?.reply ?? null,
    };
}

/** Generate a random, URL-safe rendezvous token. */
export function generateRendezvousToken(randomBytes: (n: number) => Uint8Array): string {
    const bytes = randomBytes(24);
    let s = "";
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    for (let i = 0; i < bytes.length; i++) {
        s += alphabet[bytes[i] % alphabet.length];
    }
    return s;
}
