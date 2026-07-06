import nacl from "tweetnacl";
import { encodeBase64, decodeBase64 } from "tweetnacl-util";

/**
 * T-002 grant wrapping.
 *
 * Wraps a symmetric key (the subject's `transport_key`) to a recipient's
 * X25519 public key using `nacl.box` with a FRESH EPHEMERAL sender keypair per
 * call. The recipient opens it with their X25519 secret key, the included
 * ephemeral sender public key, and the nonce.
 *
 * Pure tweetnacl (no expo dependency) so it is unit-testable under Node.
 * The caller must ensure a nacl PRNG is configured (the app sets one globally;
 * see crypto/naclPrng.ts → ensureNaclPrng()).
 */

export type BoxKeypairB64 = { publicKeyB64: string; secretKeyB64: string };

/** Generate an X25519 (Curve25519) keypair for nacl.box wrapping. */
export function generateBoxKeypair(): BoxKeypairB64 {
    const kp = nacl.box.keyPair();
    return {
        publicKeyB64: encodeBase64(kp.publicKey),
        secretKeyB64: encodeBase64(kp.secretKey),
    };
}

export type WrappedKey = {
    /** nacl.box ciphertext (base64) */
    wrapped_b64: string;
    /** 24-byte nonce (base64) */
    wrap_nonce_b64: string;
    /** ephemeral sender X25519 public key (base64) */
    sender_pub_b64: string;
};

/** Wrap `keyBytes` to a recipient X25519 public key. */
export function wrapKeyToRecipient(keyBytes: Uint8Array, recipientPubB64: string): WrappedKey {
    const recipientPub = decodeBase64(recipientPubB64);
    if (recipientPub.length !== nacl.box.publicKeyLength) {
        throw new Error("invalid_recipient_pubkey");
    }
    const ephemeral = nacl.box.keyPair();
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const boxed = nacl.box(keyBytes, nonce, recipientPub, ephemeral.secretKey);
    return {
        wrapped_b64: encodeBase64(boxed),
        wrap_nonce_b64: encodeBase64(nonce),
        sender_pub_b64: encodeBase64(ephemeral.publicKey),
    };
}

/** Open a wrapped key with the recipient's X25519 secret key. Returns null on failure. */
export function unwrapKey(wrapped: WrappedKey, recipientSecB64: string): Uint8Array | null {
    try {
        const recipientSec = decodeBase64(recipientSecB64);
        const senderPub = decodeBase64(wrapped.sender_pub_b64);
        const nonce = decodeBase64(wrapped.wrap_nonce_b64);
        const boxed = decodeBase64(wrapped.wrapped_b64);
        const opened = nacl.box.open(boxed, nonce, senderPub, recipientSec);
        return opened ? opened : null;
    } catch {
        return null;
    }
}
