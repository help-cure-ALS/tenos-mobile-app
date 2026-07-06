import nacl from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";
import { ensureNaclPrng } from "./naclPrng";
import {
    BundleCipherError as BundleCipherErrorClass,
    getBundleCipherKeyByKid,
    getCurrentBundleCipherKey
} from "./bundleCipherKey";

const ENVELOPE_VERSION = "nacl-sb-v1";

function decryptWithKey(obj: any, key: Uint8Array): string {
    if (typeof obj.n !== "string" || typeof obj.c !== "string") {
        throw new BundleCipherErrorClass("invalid_bundle_format", "Invalid encrypted bundle payload");
    }

    const nonce = decodeBase64(obj.n);
    const ciphertext = decodeBase64(obj.c);
    const plain = nacl.secretbox.open(ciphertext, nonce, key);
    if (!plain) {
        throw new BundleCipherErrorClass("bundle_decryption_failed", "Bundle decryption failed");
    }

    return new TextDecoder().decode(plain);
}

/** Encrypt a JSON string into a compact envelope string */
export async function encryptBundle(plainJson: string): Promise<string> {
    ensureNaclPrng();
    const { kid, key } = await getCurrentBundleCipherKey();
    const msg = new TextEncoder().encode(plainJson);
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    const ciphertext = nacl.secretbox(msg, nonce, key);
    return JSON.stringify({
        enc: ENVELOPE_VERSION,
        kid,
        n: encodeBase64(nonce),
        c: encodeBase64(ciphertext),
    });
}

/** Decrypt an encrypted bundle envelope back to the original JSON. */
export async function decryptBundle(envelopeOrPlain: string): Promise<string> {
    let obj: any;
    try {
        obj = JSON.parse(envelopeOrPlain);
    } catch {
        throw new BundleCipherErrorClass("invalid_bundle_format", "Invalid bundle format");
    }

    if (!obj || typeof obj !== "object") {
        throw new BundleCipherErrorClass("invalid_bundle_format", "Invalid bundle payload");
    }

    if (obj.enc === ENVELOPE_VERSION) {
        if (typeof obj.kid === "string" && obj.kid.length > 0) {
            const { key } = await getBundleCipherKeyByKid(obj.kid);
            return decryptWithKey(obj, key);
        }

        const current = await getCurrentBundleCipherKey();
        try {
            return decryptWithKey(obj, current.key);
        } catch (error) {
            if (!(error instanceof BundleCipherErrorClass) || error.code !== "bundle_decryption_failed") {
                throw error;
            }

            if (current.previousKid) {
                const previous = await getBundleCipherKeyByKid(current.previousKid);
                return decryptWithKey(obj, previous.key);
            }

            throw error;
        }
    }

    throw new BundleCipherErrorClass(
        "invalid_bundle_format",
        `Bundle must be encrypted with ${ENVELOPE_VERSION}`
    );
}

export { BundleCipherError } from "./bundleCipherKey";
