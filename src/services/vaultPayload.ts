// src/services/vaultPayload.ts
import nacl from "tweetnacl";
import { decodeBase64 } from "tweetnacl-util";
import * as SecureStore from "expo-secure-store";
import type { VaultEvent } from "@/src/lib/medical-sync-vault";

const TRANSPORT_KEY_SS = "medical_sync_vault_transport_key_b64_v1";

function normalizeB64(b64: string): string {
    let s = String(b64 ?? "").trim().replace(/\s+/g, "");
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    const pad = s.length % 4;
    if (pad === 2) s += "==";
    else if (pad === 3) s += "=";
    return s;
}

async function getTransportKey(): Promise<Uint8Array> {
    const b64 = await SecureStore.getItemAsync(TRANSPORT_KEY_SS);
    if (!b64) throw new Error("transport_key_missing");
    return decodeBase64(b64);
}

export type VaultDecryptFailureReason =
    | "unsupported_alg"
    | "invalid_payload"
    | "invalid_base64"
    | "invalid_nonce"
    | "transport_key_missing"
    | "decrypt_failed"
    | "invalid_json";

export type VaultDecryptResult =
    | { ok: true; payload: any }
    | { ok: false; reason: VaultDecryptFailureReason };

export async function decryptPayloadFromVault(
    ev: VaultEvent
): Promise<VaultDecryptResult> {
    if (ev.alg !== "nacl-secretbox-v1") {
        return { ok: false, reason: "unsupported_alg" };
    }

    const nonceB64 = normalizeB64((ev as any).nonce_b64);
    const cipherB64 = normalizeB64((ev as any).ciphertext_b64);
    if (!nonceB64 || !cipherB64) {
        return { ok: false, reason: "invalid_payload" };
    }

    let nonce: Uint8Array;
    let box: Uint8Array;

    try {
        nonce = decodeBase64(nonceB64);
        box = decodeBase64(cipherB64);
    } catch {
        return { ok: false, reason: "invalid_base64" };
    }

    if (nonce.length !== nacl.secretbox.nonceLength) {
        return { ok: false, reason: "invalid_nonce" };
    }

    let key: Uint8Array;
    try {
        key = await getTransportKey();
    } catch {
        return { ok: false, reason: "transport_key_missing" };
    }

    const msg = nacl.secretbox.open(box, nonce, key);
    if (!msg) {
        return { ok: false, reason: "decrypt_failed" };
    }

    try {
        return { ok: true, payload: JSON.parse(new TextDecoder().decode(msg)) };
    } catch {
        return { ok: false, reason: "invalid_json" };
    }
}
