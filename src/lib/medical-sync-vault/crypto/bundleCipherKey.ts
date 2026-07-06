import nacl from "tweetnacl";
import { decodeBase64 } from "tweetnacl-util";
import { baseUrlNoSlash, safeText } from "../util";

const KEY_FETCH_TIMEOUT_MS = 10000;
const BUNDLE_CIPHER_KID_RE = /^[A-Za-z0-9._:-]{1,128}$/;

export type BundleCipherMaterial = {
    kid: string;
    key: Uint8Array;
    previousKid?: string | null;
};

export class BundleCipherError extends Error {
    code: string;

    constructor(code: string, message: string) {
        super(message);
        this.name = "BundleCipherError";
        this.code = code;
    }
}

const keyCache = new Map<string, Promise<BundleCipherMaterial>>();
let currentKeyPromise: Promise<BundleCipherMaterial> | null = null;

function getBundleCipherBootstrapConfig() {
    const baseUrl = process.env.EXPO_PUBLIC_VAULT_BASE_URL?.trim();
    const appIssueToken = process.env.EXPO_PUBLIC_VAULT_APP_ISSUE_TOKEN?.trim();

    if (!baseUrl || !appIssueToken) {
        throw new BundleCipherError(
            "bundle_key_unavailable",
            "Bundle protection is currently unavailable. Please try again with a working connection."
        );
    }

    return {
        baseUrl: baseUrlNoSlash(baseUrl),
        appIssueToken,
    };
}

function parseBundleCipherMaterial(payload: any): BundleCipherMaterial {
    if (!payload || typeof payload !== "object") {
        throw new BundleCipherError("bundle_key_invalid", "Invalid bundle key response");
    }

    const kid = typeof payload.kid === "string" ? payload.kid : "";
    if (!BUNDLE_CIPHER_KID_RE.test(kid)) {
        throw new BundleCipherError("bundle_key_invalid", "Invalid bundle key identifier");
    }

    const keyB64 = typeof payload.key_b64 === "string" ? payload.key_b64 : "";
    let key: Uint8Array;
    try {
        key = decodeBase64(keyB64);
    } catch {
        throw new BundleCipherError("bundle_key_invalid", "Invalid bundle key payload");
    }

    if (key.length !== nacl.secretbox.keyLength) {
        throw new BundleCipherError("bundle_key_invalid", "Invalid bundle key length");
    }

    const previousKid = typeof payload.previous_kid === "string" ? payload.previous_kid : null;
    return { kid, key, previousKid };
}

async function fetchBundleCipherMaterial(path: string): Promise<BundleCipherMaterial> {
    const { baseUrl, appIssueToken } = getBundleCipherBootstrapConfig();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), KEY_FETCH_TIMEOUT_MS);

    try {
        const res = await fetch(`${baseUrl}${path}`, {
            method: "GET",
            headers: {
                "X-App-Token": appIssueToken,
            },
            signal: controller.signal,
        });

        if (res.status === 404) {
            throw new BundleCipherError(
                "bundle_key_not_found",
                "This bundle can no longer be opened. Please create a new QR code."
            );
        }

        if (!res.ok) {
            const text = await safeText(res);
            throw new BundleCipherError(
                "bundle_key_unavailable",
                `Bundle protection request failed (${res.status}): ${text || "unknown error"}`
            );
        }

        return parseBundleCipherMaterial(await res.json());
    } catch (error: any) {
        if (error instanceof BundleCipherError) {
            throw error;
        }
        if (error?.name === "AbortError") {
            throw new BundleCipherError(
                "bundle_key_unavailable",
                "Bundle protection request timed out. Please try again."
            );
        }
        throw new BundleCipherError(
            "bundle_key_unavailable",
            error?.message ?? "Bundle protection is currently unavailable."
        );
    } finally {
        clearTimeout(timeoutId);
    }
}

export async function getCurrentBundleCipherKey(forceRefresh = false): Promise<BundleCipherMaterial> {
    if (forceRefresh || !currentKeyPromise) {
        currentKeyPromise = fetchBundleCipherMaterial("/bundle-cipher/current")
            .then((material) => {
                keyCache.set(material.kid, Promise.resolve(material));
                return material;
            })
            .catch((error) => {
                currentKeyPromise = null;
                throw error;
            });
    }

    return currentKeyPromise;
}

export async function getBundleCipherKeyByKid(kid: string): Promise<BundleCipherMaterial> {
    if (!BUNDLE_CIPHER_KID_RE.test(kid)) {
        throw new BundleCipherError("bundle_key_invalid", "Invalid bundle key identifier");
    }

    const cached = keyCache.get(kid);
    if (cached) {
        return cached;
    }

    const request = fetchBundleCipherMaterial(`/bundle-cipher/${encodeURIComponent(kid)}`)
        .catch((error) => {
            keyCache.delete(kid);
            throw error;
        });

    keyCache.set(kid, request);
    return request;
}
