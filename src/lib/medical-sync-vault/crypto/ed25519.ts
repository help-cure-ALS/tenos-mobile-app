import nacl from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";
import type { Storage } from "../storage/types";
import type { Keybag } from "../storage/keybag";
import { ensureNaclPrng } from "./naclPrng";

export type KeypairB64 = { publicKeyB64: string; secretKeyB64: string };

export async function getOrCreateEd25519Keypair(store: Storage, K: Keybag): Promise<KeypairB64> {
    ensureNaclPrng();

    const pub = await store.get(K.PUBKEY_B64);
    const sec = await store.get(K.SECKEY_B64);

    if (pub && sec) {
        return { publicKeyB64: pub, secretKeyB64: sec };
    }

    const kp = nacl.sign.keyPair();
    const publicKeyB64 = encodeBase64(kp.publicKey);
    const secretKeyB64 = encodeBase64(kp.secretKey);

    await store.set(K.PUBKEY_B64, publicKeyB64);
    await store.set(K.SECKEY_B64, secretKeyB64);

    return { publicKeyB64, secretKeyB64 };
}

export function signDetachedB64(message: string, secretKeyB64: string): string {
    const msgBytes = new TextEncoder().encode(message);
    const sk = decodeBase64(secretKeyB64);
    const sig = nacl.sign.detached(msgBytes, sk);
    return encodeBase64(sig);
}
