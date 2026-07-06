import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { ensureNaclPrng } from '@/src/lib/medical-sync-vault/crypto/naclPrng';
import { generateBoxKeypair, wrapKeyToRecipient, unwrapKey } from '@/src/lib/medical-sync-vault/crypto/grantWrap';
import { postRendezvous, getRendezvous } from '@/src/lib/medical-sync-vault/api/rendezvous';
import { authorizeDevice, type DeviceCapability } from '@/src/lib/medical-sync-vault/api/devices';
import { getOrCreateStableDeviceId } from '@/src/lib/medical-sync-vault/deviceId';
import type { VaultConfig } from '@/src/lib/medical-sync-vault/types';
import type { Storage } from '@/src/lib/medical-sync-vault/storage/types';
import type { Keybag } from '@/src/lib/medical-sync-vault/storage/keybag';

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export type RecipientPairResult = {
    deviceId: string;
    ownPubkeyB64: string;
    ownSeckeyB64: string;
    transportKeyB64: string;
};

/**
 * RECIPIENT side of the T-002 pairing handshake.
 * Generates the recipient's OWN ed25519 identity + an ephemeral X25519 box key,
 * posts the offer, and waits for the patient's wrapped transport_key.
 */
export async function recipientPair(
    cfg: VaultConfig,
    store: Storage,
    K: Keybag,
    rendezvousToken: string,
): Promise<RecipientPairResult> {
    ensureNaclPrng();

    const deviceId = await getOrCreateStableDeviceId(store, K);
    const ed = nacl.sign.keyPair();
    const ownPubkeyB64 = encodeBase64(ed.publicKey);
    const ownSeckeyB64 = encodeBase64(ed.secretKey);
    const box = generateBoxKeypair();

    await postRendezvous(cfg, rendezvousToken, 'offer', {
        ed25519_pub_b64: ownPubkeyB64,
        x25519_pub_b64: box.publicKeyB64,
        device_id: deviceId,
    });

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
        const state = await getRendezvous(cfg, rendezvousToken);
        if (state.reply) {
            const transport = unwrapKey(
                {
                    wrapped_b64: state.reply.wrapped_transport_key_b64,
                    wrap_nonce_b64: state.reply.wrap_nonce_b64,
                    sender_pub_b64: state.reply.sender_pub_b64,
                },
                box.secretKeyB64,
            );
            if (!transport) {
                throw new Error('pairing_unwrap_failed');
            }
            return {
                deviceId,
                ownPubkeyB64,
                ownSeckeyB64,
                transportKeyB64: encodeBase64(transport),
            };
        }
        await sleep(POLL_INTERVAL_MS);
    }
    throw new Error('pairing_timeout');
}

/**
 * PATIENT side: one poll attempt. If the recipient's offer is present, authorize
 * the recipient device (root-signed) and post the wrapped transport_key.
 * Returns the granted device_id once handled, otherwise null (caller loops).
 */
export async function patientRespondOnce(
    cfg: VaultConfig,
    rendezvousToken: string,
    args: {
        subjectId: string;
        rootSeckeyB64: string;
        transportKeyB64: string;
        capability: DeviceCapability;
    },
): Promise<{ deviceId: string; ed25519PubB64: string } | null> {
    const state = await getRendezvous(cfg, rendezvousToken);
    if (!state.offer) return null;

    await authorizeDevice(cfg, {
        subjectId: args.subjectId,
        targetDeviceId: state.offer.device_id,
        targetPublicKeyB64: state.offer.ed25519_pub_b64,
        capability: args.capability,
        rootSeckeyB64: args.rootSeckeyB64,
    });

    const wrapped = wrapKeyToRecipient(decodeBase64(args.transportKeyB64), state.offer.x25519_pub_b64);
    await postRendezvous(cfg, rendezvousToken, 'reply', {
        wrapped_transport_key_b64: wrapped.wrapped_b64,
        wrap_nonce_b64: wrapped.wrap_nonce_b64,
        sender_pub_b64: wrapped.sender_pub_b64,
    });

    return { deviceId: state.offer.device_id, ed25519PubB64: state.offer.ed25519_pub_b64 };
}
