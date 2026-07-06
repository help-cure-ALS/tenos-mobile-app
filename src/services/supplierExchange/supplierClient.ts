// API client for the Supplier Proxy
// Uses mocks in development, real proxy in production

import nacl from 'tweetnacl';
import { decodeBase64, encodeBase64 } from 'tweetnacl-util';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { getToken } from './credentialStore';
import { mockClient } from './mock';
import { getCareClient } from '@/src/studies/careClient';
import type { Organization } from '@medplum/fhirtypes';
import type {
    SupplierOrganization,
    SupplierProposal,
    WorkflowPolicy,
    LinkRequestDetails,
    SupplierSelectionPolicy,
} from './types';

const PROXY_URL = process.env.EXPO_PUBLIC_SUPPLIER_PROXY_URL;

const APP_DEVICE_ID_KEY = 'supplier_proxy_app_auth_device_id_v1';
const APP_PUBKEY_KEY = 'supplier_proxy_app_auth_pubkey_b64_v1';
const APP_SECKEY_KEY = 'supplier_proxy_app_auth_seckey_b64_v1';
const APP_ACCESS_TOKEN_KEY = 'supplier_proxy_app_auth_access_token_v1';
const APP_ACCESS_TOKEN_EXP_KEY = 'supplier_proxy_app_auth_access_token_exp_v1';

let demoMode = false;
function useMocks(): boolean {
    return demoMode || !PROXY_URL;
}

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

async function registerIdentity(baseUrl: string, identity: DeviceIdentity): Promise<void> {
    const msg = `register|${identity.deviceId}|${identity.publicKeyB64}`;
    const signatureB64 = signDetachedB64(msg, identity.secretKeyB64);

    const res = await fetch(`${baseUrl}/app-auth/register`, {
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
        throw new Error(`Supplier register failed (${res.status}): ${body}`);
    }
}

async function fetchChallenge(baseUrl: string, deviceId: string): Promise<ChallengeResponse | null> {
    const res = await fetch(`${baseUrl}/app-auth/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId }),
    });
    if (res.status === 404) {
        return null;
    }
    if (!res.ok) {
        const body = await safeText(res);
        throw new Error(`Supplier challenge failed (${res.status}): ${body}`);
    }
    return res.json();
}

async function issueAppToken(baseUrl: string, identity: DeviceIdentity, challenge: ChallengeResponse): Promise<IssueResponse> {
    const msg = `issue|${identity.deviceId}|${challenge.challenge_id}|${challenge.challenge_b64}`;
    const signatureB64 = signDetachedB64(msg, identity.secretKeyB64);

    const res = await fetch(`${baseUrl}/app-auth/issue`, {
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
        throw new Error(`Supplier issue failed (${res.status}): ${body}`);
    }
    return res.json();
}

async function ensureAppAccessToken(forceRefresh = false): Promise<string> {
    if (!PROXY_URL) throw new Error('EXPO_PUBLIC_SUPPLIER_PROXY_URL not configured');

    if (!forceRefresh) {
        const token = await SecureStore.getItemAsync(APP_ACCESS_TOKEN_KEY);
        const expRaw = await SecureStore.getItemAsync(APP_ACCESS_TOKEN_EXP_KEY);
        const exp = expRaw ? Number(expRaw) : 0;
        if (token && Number.isFinite(exp) && Date.now() < exp - 10_000) {
            return token;
        }
    }

    const identity = await getOrCreateIdentity();
    let challenge = await fetchChallenge(PROXY_URL, identity.deviceId);
    if (!challenge) {
        await registerIdentity(PROXY_URL, identity);
        challenge = await fetchChallenge(PROXY_URL, identity.deviceId);
        if (!challenge) {
            throw new Error('Supplier challenge failed: unknown_device after register');
        }
    }

    const issued = await issueAppToken(PROXY_URL, identity, challenge);
    if (!issued.access_token) {
        throw new Error('Supplier issue returned no access_token');
    }

    await SecureStore.setItemAsync(APP_ACCESS_TOKEN_KEY, issued.access_token);
    const expiresAt = Date.now() + Math.max(1, Number(issued.expires_in || 0)) * 1000;
    await SecureStore.setItemAsync(APP_ACCESS_TOKEN_EXP_KEY, String(expiresAt));

    return issued.access_token;
}

async function appAuthHeaders(): Promise<Record<string, string>> {
    const token = await ensureAppAccessToken(false);
    return { Authorization: `Bearer ${token}` };
}

async function authHeaders(integrationId: string): Promise<Record<string, string>> {
    const token = await getToken(integrationId);
    if (!token) throw new Error(`No token for integration ${integrationId}`);
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    };
}

async function proxyFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    if (!PROXY_URL) throw new Error('EXPO_PUBLIC_SUPPLIER_PROXY_URL not configured');
    const url = `${PROXY_URL}${path}`;
    const appHeaders = await appAuthHeaders();
    const mergedHeaders = {
        'Content-Type': 'application/json',
        ...appHeaders,
        ...options.headers,
    };
    let response = await fetch(url, {
        ...options,
        headers: mergedHeaders,
    });
    if (response.status === 401) {
        await clearAppAccessToken();
        const refreshedHeaders = {
            'Content-Type': 'application/json',
            ...(await appAuthHeaders()),
            ...options.headers,
        };
        response = await fetch(url, {
            ...options,
            headers: refreshedHeaders,
        });
    }
    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Supplier proxy ${response.status}: ${body}`);
    }
    return response.json() as Promise<T>;
}

async function authedFetch<T>(integrationId: string, path: string, options: RequestInit = {}): Promise<T> {
    const headers = await authHeaders(integrationId);
    return proxyFetch<T>(path, { ...options, headers: { ...headers, ...options.headers } });
}

function fhirOrgToSupplierOrg(org: Organization): SupplierOrganization {
    const addr = org.address?.[0];
    const addressParts = [
        addr?.line?.join(', '),
        [addr?.postalCode, addr?.city].filter(Boolean).join(' '),
    ].filter(Boolean);
    return {
        id: org.id!,
        name: org.name ?? '',
        country: addr?.country ?? '',
        specialty: org.type?.[0]?.coding?.[0]?.display ?? org.type?.[0]?.text ?? '',
        address: addressParts.length > 0 ? addressParts.join(', ') : undefined,
        phone: org.telecom?.find(t => t.system === 'phone')?.value,
        email: org.telecom?.find(t => t.system === 'email')?.value,
    };
}

export const supplierClient = {
    async listOrganizations(country: string): Promise<SupplierOrganization[]> {
        if (useMocks()) return mockClient.listOrganizations(country);
        const client = await getCareClient();
        const orgs = await client.searchResources('Organization', {
            _tag: 'urn:hca:supplier|enabled',
            active: 'true',
            'address-country': country,
            _sort: 'name',
            _count: '500',
        });
        return orgs.map(fhirOrgToSupplierOrg);
    },

    async getRequestDetails(token: string): Promise<LinkRequestDetails> {
        if (useMocks()) return mockClient.getRequestDetails(token);
        return proxyFetch<LinkRequestDetails>(`/v1/provider-links/requests/${encodeURIComponent(token)}`);
    },

    async linkCareOrg(
        orgId: string,
        policy: SupplierSelectionPolicy,
        verificationTokenId: string,
    ): Promise<{ integration_id: string; token: string }> {
        if (useMocks()) return mockClient.linkCareOrg(orgId, policy, verificationTokenId);
        return proxyFetch<{ integration_id: string; token: string }>('/v1/provider-links/care-org', {
            method: 'POST',
            body: JSON.stringify({
                organization_id: orgId,
                verification_token_id: verificationTokenId,
                policy,
            }),
        });
    },

    async acceptPartnerRequest(
        token: string,
        policy: SupplierSelectionPolicy,
        verificationTokenId: string,
    ): Promise<{ integration_id: string; token: string; organization_id: string; organization_name: string }> {
        if (useMocks()) return mockClient.acceptPartnerRequest(token, policy, verificationTokenId);
        return proxyFetch<{ integration_id: string; token: string; organization_id: string; organization_name: string }>('/v1/provider-links/partner-app/accept', {
            method: 'POST',
            body: JSON.stringify({
                request_token: token,
                verification_token_id: verificationTokenId,
                policy,
            }),
        });
    },

    async pushBundle(integrationId: string, bundle: unknown): Promise<{ ok: true; accepted: number }> {
        if (useMocks()) return mockClient.pushBundle(integrationId, bundle);
        return authedFetch<{ ok: true; accepted: number }>(integrationId, `/v1/provider-exchange/${encodeURIComponent(integrationId)}/push`, {
            method: 'POST',
            body: JSON.stringify({ bundle }),
        });
    },

    async pullProposals(integrationId: string, cursor?: string): Promise<{ proposals: SupplierProposal[]; cursor?: string }> {
        if (useMocks()) return mockClient.pullProposals(integrationId, cursor);
        const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
        return authedFetch<{ proposals: SupplierProposal[]; cursor?: string }>(integrationId, `/v1/provider-exchange/${encodeURIComponent(integrationId)}/pull${qs}`);
    },

    async sendDecision(integrationId: string, proposalId: string, decision: 'accepted' | 'declined'): Promise<{ ok: true }> {
        if (useMocks()) return mockClient.sendDecision(integrationId, proposalId, decision);
        return authedFetch<{ ok: true }>(integrationId, `/v1/provider-exchange/${encodeURIComponent(integrationId)}/proposals/${encodeURIComponent(proposalId)}/decision`, {
            method: 'POST',
            body: JSON.stringify({ decision }),
        });
    },

    async sendTransition(integrationId: string, ticket: unknown): Promise<{ ok: true }> {
        if (useMocks()) return mockClient.sendTransition(integrationId, ticket);
        return authedFetch<{ ok: true }>(integrationId, `/v1/provider-exchange/${encodeURIComponent(integrationId)}/transitions`, {
            method: 'POST',
            body: JSON.stringify(ticket),
        });
    },

    async disconnectIntegration(integrationId: string): Promise<{ ok: true }> {
        if (useMocks()) return mockClient.disconnectIntegration(integrationId);
        return authedFetch<{ ok: true }>(integrationId, `/v1/provider-exchange/${encodeURIComponent(integrationId)}/disconnect`, {
            method: 'POST',
            body: JSON.stringify({}),
        });
    },

    async getWorkflowPolicy(country: string): Promise<WorkflowPolicy> {
        if (useMocks()) return mockClient.getWorkflowPolicy(country);
        return proxyFetch<WorkflowPolicy>(`/v1/workflow-policy?country=${encodeURIComponent(country)}`);
    },

    setDemoMode(enabled: boolean): void {
        demoMode = enabled;
    },
};
