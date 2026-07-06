/**
 * Client for communicating with the Research Proxy.
 *
 * Uses app-device auth (register/challenge/issue) and bearer JWT for /donate.
 */
import nacl from 'tweetnacl';
import { decodeBase64, encodeBase64 } from 'tweetnacl-util';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { APP_DOMAIN } from '@/src/definitions/domainConfig';

const PROXY_URL = process.env.EXPO_PUBLIC_RESEARCH_PROXY_URL;

const APP_DEVICE_ID_KEY = 'research_proxy_app_auth_device_id_v1';
const APP_PUBKEY_KEY = 'research_proxy_app_auth_pubkey_b64_v1';
const APP_SECKEY_KEY = 'research_proxy_app_auth_seckey_b64_v1';
const APP_ACCESS_TOKEN_KEY = 'research_proxy_app_auth_access_token_v1';
const APP_ACCESS_TOKEN_EXP_KEY = 'research_proxy_app_auth_access_token_exp_v1';

export type DonationResult = {
    ok: true;
    accepted: number;
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

function getConfig() {
    if (!PROXY_URL) {
        throw new Error('EXPO_PUBLIC_RESEARCH_PROXY_URL not configured');
    }
    return { donateUrl: PROXY_URL };
}

function getAuthUrl(path: string): string {
    if (!PROXY_URL) {
        throw new Error('EXPO_PUBLIC_RESEARCH_PROXY_URL not configured');
    }
    const base = new URL(PROXY_URL);
    return new URL(path, `${base.protocol}//${base.host}`).toString();
}

async function safeText(res: Response): Promise<string> {
    try {
        return await res.text();
    } catch {
        return '';
    }
}

async function clearAppAccessToken(): Promise<void> {
    await SecureStore.deleteItemAsync(APP_ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(APP_ACCESS_TOKEN_EXP_KEY);
}

async function getOrCreateIdentity(): Promise<DeviceIdentity> {
    const existingDeviceId = await SecureStore.getItemAsync(APP_DEVICE_ID_KEY);
    const existingPub = await SecureStore.getItemAsync(APP_PUBKEY_KEY);
    const existingSec = await SecureStore.getItemAsync(APP_SECKEY_KEY);

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

    await SecureStore.setItemAsync(APP_DEVICE_ID_KEY, deviceId);
    await SecureStore.setItemAsync(APP_PUBKEY_KEY, publicKeyB64);
    await SecureStore.setItemAsync(APP_SECKEY_KEY, secretKeyB64);

    return { deviceId, publicKeyB64, secretKeyB64 };
}

function signDetachedB64(message: string, secretKeyB64: string): string {
    const msgBytes = new TextEncoder().encode(message);
    const sec = decodeBase64(secretKeyB64);
    const sig = nacl.sign.detached(msgBytes, sec);
    return encodeBase64(sig);
}

async function registerIdentity(identity: DeviceIdentity): Promise<void> {
    const msg = `register|${identity.deviceId}|${identity.publicKeyB64}`;
    const signatureB64 = signDetachedB64(msg, identity.secretKeyB64);

    const res = await fetch(getAuthUrl('/app-auth/register'), {
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
        throw new Error(`Research register failed (${res.status}): ${body}`);
    }
}

async function fetchChallenge(deviceId: string): Promise<ChallengeResponse | null> {
    const res = await fetch(getAuthUrl('/app-auth/challenge'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId }),
    });
    if (res.status === 404) {
        return null;
    }
    if (!res.ok) {
        const body = await safeText(res);
        throw new Error(`Research challenge failed (${res.status}): ${body}`);
    }
    return res.json();
}

async function issueAppToken(identity: DeviceIdentity, challenge: ChallengeResponse): Promise<IssueResponse> {
    const msg = `issue|${identity.deviceId}|${challenge.challenge_id}|${challenge.challenge_b64}`;
    const signatureB64 = signDetachedB64(msg, identity.secretKeyB64);

    const res = await fetch(getAuthUrl('/app-auth/issue'), {
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
        throw new Error(`Research issue failed (${res.status}): ${body}`);
    }
    return res.json();
}

async function ensureAppAccessToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh) {
        const token = await SecureStore.getItemAsync(APP_ACCESS_TOKEN_KEY);
        const expRaw = await SecureStore.getItemAsync(APP_ACCESS_TOKEN_EXP_KEY);
        const exp = expRaw ? Number(expRaw) : 0;
        if (token && Number.isFinite(exp) && Date.now() < exp - 10_000) {
            return token;
        }
    }

    const identity = await getOrCreateIdentity();
    let challenge = await fetchChallenge(identity.deviceId);
    if (!challenge) {
        await registerIdentity(identity);
        challenge = await fetchChallenge(identity.deviceId);
        if (!challenge) {
            throw new Error('Research challenge failed: unknown_device after register');
        }
    }

    const issued = await issueAppToken(identity, challenge);
    if (!issued.access_token) {
        throw new Error('Research issue returned no access_token');
    }

    await SecureStore.setItemAsync(APP_ACCESS_TOKEN_KEY, issued.access_token);
    const expiresAt = Date.now() + Math.max(1, Number(issued.expires_in || 0)) * 1000;
    await SecureStore.setItemAsync(APP_ACCESS_TOKEN_EXP_KEY, String(expiresAt));

    return issued.access_token;
}

/**
 * Create an attestation payload with verification metadata.
 */
export async function createAttestation(
    anonymousResearchId: string,
    verificationTokenId?: string,
): Promise<{
    anonymous_research_id: string;
    verification_status: 'verified';
    verification_token_id?: string;
    timestamp: string;
}> {
    return {
        anonymous_research_id: anonymousResearchId,
        verification_status: 'verified',
        ...(verificationTokenId ? { verification_token_id: verificationTokenId } : {}),
        timestamp: new Date().toISOString(),
    };
}

/**
 * Send an anonymized FHIR bundle to the research proxy.
 */
export async function sendToProxy(
    anonymousResearchId: string,
    bundle: any,
    verificationTokenId?: string,
): Promise<DonationResult> {
    const { donateUrl } = getConfig();
    let token = await ensureAppAccessToken(false);

    const attestation = await createAttestation(anonymousResearchId, verificationTokenId);

    let response = await fetch(donateUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            domain: APP_DOMAIN,
            attestation,
            bundle,
        }),
    });

    if (response.status === 401) {
        await clearAppAccessToken();
        token = await ensureAppAccessToken(true);
        response = await fetch(donateUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                domain: APP_DOMAIN,
                attestation,
                bundle,
            }),
        });
    }

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Donation proxy returned ${response.status}: ${body}`);
    }

    return (await response.json()) as DonationResult;
}
