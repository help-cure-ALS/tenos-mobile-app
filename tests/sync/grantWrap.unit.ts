import nacl from "tweetnacl";
import {
    generateBoxKeypair,
    wrapKeyToRecipient,
    unwrapKey,
} from "../../src/lib/medical-sync-vault/crypto/grantWrap";

// Provide a deterministic PRNG for tweetnacl under Node tests (the app uses expo-crypto at runtime).
let prngState = 0x12345678;
nacl.setPRNG((x, n) => {
    for (let i = 0; i < n; i++) {
        prngState = (1664525 * prngState + 1013904223) >>> 0;
        x[i] = prngState & 0xff;
    }
});

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

function eq(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

export function runGrantWrapUnitTests(): void {
    // Round-trip: recipient can unwrap the transport_key wrapped to its pubkey.
    {
        const recipient = generateBoxKeypair();
        const transportKey = nacl.randomBytes(32);
        const wrapped = wrapKeyToRecipient(transportKey, recipient.publicKeyB64);

        assert(wrapped.wrapped_b64.length > 0, "wrapped present");
        assert(wrapped.wrap_nonce_b64.length > 0, "nonce present");
        assert(wrapped.sender_pub_b64.length > 0, "sender pubkey present");

        const opened = unwrapKey(wrapped, recipient.secretKeyB64);
        assert(opened !== null, "unwrap should succeed for the right recipient");
        assert(eq(opened as Uint8Array, transportKey), "unwrapped key must equal original");
    }

    // Wrong recipient cannot open.
    {
        const recipient = generateBoxKeypair();
        const attacker = generateBoxKeypair();
        const transportKey = nacl.randomBytes(32);
        const wrapped = wrapKeyToRecipient(transportKey, recipient.publicKeyB64);

        const opened = unwrapKey(wrapped, attacker.secretKeyB64);
        assert(opened === null, "unwrap must fail for the wrong secret key");
    }

    // Tampered ciphertext cannot open.
    {
        const recipient = generateBoxKeypair();
        const transportKey = nacl.randomBytes(32);
        const wrapped = wrapKeyToRecipient(transportKey, recipient.publicKeyB64);
        const tampered = { ...wrapped, wrapped_b64: wrapped.wrapped_b64.slice(0, -2) + "AA" };

        const opened = unwrapKey(tampered, recipient.secretKeyB64);
        assert(opened === null, "unwrap must fail for tampered ciphertext");
    }

    // Missing nacl.box metadata (nonce/sender) → no open.
    {
        const recipient = generateBoxKeypair();
        const transportKey = nacl.randomBytes(32);
        const wrapped = wrapKeyToRecipient(transportKey, recipient.publicKeyB64);
        const broken = { ...wrapped, sender_pub_b64: generateBoxKeypair().publicKeyB64 };

        const opened = unwrapKey(broken, recipient.secretKeyB64);
        assert(opened === null, "unwrap must fail when sender pubkey is wrong");
    }

    // Invalid recipient pubkey is rejected at wrap time.
    {
        let threw = false;
        try {
            wrapKeyToRecipient(nacl.randomBytes(32), "AAAA");
        } catch {
            threw = true;
        }
        assert(threw, "wrap must reject an invalid recipient pubkey");
    }
}
