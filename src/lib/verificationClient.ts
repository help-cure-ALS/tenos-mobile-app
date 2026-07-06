/**
 * Verification Service Client
 *
 * Communicates with the verification-service (Fastify)
 * for ALS diagnosis verification via 6-digit codes.
 * Token status is checked directly via Medplum SDK (no REST API needed).
 */

import nacl from 'tweetnacl';
import { decodeBase64, encodeBase64 } from 'tweetnacl-util';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { getCareClient } from '@/src/studies/careClient';
import type { Basic } from '@medplum/fhirtypes';

const VERIFICATION_URL = process.env.EXPO_PUBLIC_VERIFICATION_URL;

const DEVICE_ID_KEY = 'verification_app_auth_device_id_v1';
const PUBKEY_KEY = 'verification_app_auth_pubkey_b64_v1';
const SECKEY_KEY = 'verification_app_auth_seckey_b64_v1';
const ACCESS_TOKEN_KEY = 'verification_app_auth_access_token_v1';
const ACCESS_TOKEN_EXP_KEY = 'verification_app_auth_access_token_exp_v1';

function getConfig() {
    if (!VERIFICATION_URL) {
        throw new Error(
            'Missing verification config. Set EXPO_PUBLIC_VERIFICATION_URL in .env'
        );
    }
    return { url: VERIFICATION_URL };
}

export type VerificationRequestResult = {
    request_id: string;
    code: string;
    expires_at: string;
};

export type VerificationStatusResult = {
    status: 'pending' | 'confirmed' | 'rejected' | 'expired';
    token_id?: string;
    clinic_pseudonym?: string;
};

type DeviceIdentity = {
    deviceId: string;
    publicKeyB64: string;
    secretKeyB64: string;
};

type ChallengeResponse = {
    challenge_id: string;
    challenge_b64: string;
};

type IssueResponse = {
    access_token: string;
    expires_in: number;
};

async function safeText(res: Response): Promise<string> {
    try {
        return await res.text();
    } catch {
        return '';
    }
}

async function clearAccessToken(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_EXP_KEY);
}

async function getOrCreateIdentity(): Promise<DeviceIdentity> {
    const existingDeviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    const existingPub = await SecureStore.getItemAsync(PUBKEY_KEY);
    const existingSec = await SecureStore.getItemAsync(SECKEY_KEY);

    if (existingDeviceId && existingPub && existingSec) {
        return {
            deviceId: existingDeviceId,
            publicKeyB64: existingPub,
            secretKeyB64: existingSec,
        };
    }

    const kp = nacl.sign.keyPair();
    const deviceId = existingDeviceId ?? Crypto.randomUUID();
    const publicKeyB64 = encodeBase64(kp.publicKey);
    const secretKeyB64 = encodeBase64(kp.secretKey);

    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
    await SecureStore.setItemAsync(PUBKEY_KEY, publicKeyB64);
    await SecureStore.setItemAsync(SECKEY_KEY, secretKeyB64);

    return { deviceId, publicKeyB64, secretKeyB64 };
}

function signDetachedB64(message: string, secretKeyB64: string): string {
    const msgBytes = new TextEncoder().encode(message);
    const sec = decodeBase64(secretKeyB64);
    const sig = nacl.sign.detached(msgBytes, sec);
    return encodeBase64(sig);
}

async function registerIdentity(url: string, identity: DeviceIdentity): Promise<void> {
    const msg = `register|${identity.deviceId}|${identity.publicKeyB64}`;
    const signatureB64 = signDetachedB64(msg, identity.secretKeyB64);

    const res = await fetch(`${url}/app-auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            device_id: identity.deviceId,
            public_key_b64: identity.publicKeyB64,
            signature_b64: signatureB64,
        }),
    });
    if (!res.ok) {
        const body = await safeText(res);
        throw new Error(`Verification register failed (${res.status}): ${body}`);
    }
}

async function fetchChallenge(url: string, deviceId: string): Promise<ChallengeResponse | null> {
    const res = await fetch(`${url}/app-auth/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId }),
    });
    if (res.status === 404) {
        return null;
    }
    if (!res.ok) {
        const body = await safeText(res);
        throw new Error(`Verification challenge failed (${res.status}): ${body}`);
    }
    return res.json();
}

async function issueToken(url: string, identity: DeviceIdentity, challenge: ChallengeResponse): Promise<IssueResponse> {
    const msg = `issue|${identity.deviceId}|${challenge.challenge_id}|${challenge.challenge_b64}`;
    const signatureB64 = signDetachedB64(msg, identity.secretKeyB64);

    const res = await fetch(`${url}/app-auth/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            device_id: identity.deviceId,
            challenge_id: challenge.challenge_id,
            signature_b64: signatureB64,
        }),
    });
    if (!res.ok) {
        const body = await safeText(res);
        throw new Error(`Verification issue failed (${res.status}): ${body}`);
    }
    return res.json();
}

async function ensureAccessToken(forceRefresh = false): Promise<string> {
    const { url } = getConfig();

    if (!forceRefresh) {
        const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
        const expRaw = await SecureStore.getItemAsync(ACCESS_TOKEN_EXP_KEY);
        const exp = expRaw ? Number(expRaw) : 0;
        if (token && Number.isFinite(exp) && Date.now() < exp - 10_000) {
            return token;
        }
    }

    const identity = await getOrCreateIdentity();
    let challenge = await fetchChallenge(url, identity.deviceId);
    if (!challenge) {
        await registerIdentity(url, identity);
        challenge = await fetchChallenge(url, identity.deviceId);
        if (!challenge) {
            throw new Error('Verification challenge failed: unknown_device after register');
        }
    }

    const issued = await issueToken(url, identity, challenge);
    if (!issued.access_token) {
        throw new Error('Verification issue returned no access_token');
    }

    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, issued.access_token);
    const expiresAt = Date.now() + Math.max(1, Number(issued.expires_in || 0)) * 1000;
    await SecureStore.setItemAsync(ACCESS_TOKEN_EXP_KEY, String(expiresAt));

    return issued.access_token;
}

async function authedFetch(path: string, init: RequestInit): Promise<Response> {
    const { url } = getConfig();

    let token = await ensureAccessToken(false);
    let res = await fetch(`${url}${path}`, {
        ...init,
        headers: {
            ...(init.headers ?? {}),
            Authorization: `Bearer ${token}`,
        },
    });

    if (res.status === 401) {
        await clearAccessToken();
        token = await ensureAccessToken(true);
        res = await fetch(`${url}${path}`, {
            ...init,
            headers: {
                ...(init.headers ?? {}),
                Authorization: `Bearer ${token}`,
            },
        });
    }

    return res;
}

/** Request a new 6-digit verification code from the service */
export async function requestVerification(
    clinicId: string,
    _deviceId: string,
): Promise<VerificationRequestResult> {
    const res = await authedFetch('/verify/request', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clinic_id: clinicId }),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Verification request failed (${res.status}): ${body}`);
    }
    return res.json();
}

/** Poll the status of a verification request */
export async function pollVerificationStatus(
    requestId: string,
): Promise<VerificationStatusResult> {
    const res = await authedFetch(`/verify/status/${requestId}`, {
        method: 'GET',
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Status poll failed (${res.status}): ${body}`);
    }
    return res.json();
}

/** Check whether a verified token is still valid or has been revoked (via Medplum SDK) */
export async function checkTokenStatus(tokenId: string): Promise<'valid' | 'revoked'> {
    const client = await getCareClient();
    const bundle = await client.search('Basic', {
        code: 'urn:hca:resource-type|verification-token',
        identifier: `urn:hca:verification-token|${tokenId}`,
        _count: '1',
    });
    const resource = bundle.entry?.[0]?.resource as Basic | undefined;
    if (!resource) return 'revoked';
    const statusExt = resource.extension?.find(
        (e) => e.url === 'urn:hca:verification-status'
    );
    return statusExt?.valueCode === 'revoked' ? 'revoked' : 'valid';
}
