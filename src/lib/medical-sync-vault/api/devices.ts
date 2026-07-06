import type { VaultConfig } from "../types";
import type { Storage } from "../storage/types";
import type { Keybag } from "../storage/keybag";
import { VaultError } from "../errors";
import { baseUrlNoSlash, safeText } from "../util";
import { vaultFetch } from "./fetch";
import { signDetachedB64 } from "../crypto/ed25519";

export type DeviceCapability = "read_write";

export type DeactivateResponse = {
    ok: boolean;
    device_id: string;
    status: "disabled";
};

/**
 * Deactivates the current device on the server.
 * Call this before clearing local data to properly unregister the device.
 */
export async function deactivateDevice(
    cfg: VaultConfig,
    store: Storage,
    K: Keybag
): Promise<DeactivateResponse> {
    const sid = await store.get(K.SUBJECT_ID);
    const did = await store.get(K.DEVICE_ID);

    if (!sid || !did) {
        throw new VaultError("no_subject_id", "no_subject_id or device_id");
    }

    const res = await vaultFetch(cfg, store, K, "/devices/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
    });

    if (!res.ok) {
        const text = await safeText(res);
        throw new VaultError("server_error", `devices/deactivate failed: ${res.status}`, {
            status: res.status,
            bodyText: text
        });
    }

    return res.json();
}

/**
 * T-002: disable ANOTHER device of the same subject (owner-only, via JWT).
 * Used when a patient removes a caregiver/doctor or one of their own devices.
 */
export async function disableDevice(
    cfg: VaultConfig,
    store: Storage,
    K: Keybag,
    targetDeviceId: string
): Promise<DeactivateResponse> {
    const res = await vaultFetch(cfg, store, K, "/devices/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_device_id: targetDeviceId })
    });

    if (!res.ok) {
        const text = await safeText(res);
        if (res.status === 404 && text.includes("device_not_found_or_already_disabled")) {
            return { ok: true, device_id: targetDeviceId, status: "disabled" };
        }
        throw new VaultError("server_error", `devices/disable failed: ${res.status}`, {
            status: res.status,
            bodyText: text
        });
    }

    return res.json();
}

/**
 * T-002: authorize a recipient device onto a subject (pre-auth: App-Token +
 * a signature by the subject ROOT key). The patient (owner) calls this.
 * `rootSeckeyB64` is the subject's Ed25519 secret key (held by the patient).
 */
export async function authorizeDevice(
    cfg: VaultConfig,
    args: {
        subjectId: string;
        targetDeviceId: string;
        targetPublicKeyB64: string;
        capability: DeviceCapability;
        rootSeckeyB64: string;
    }
): Promise<{ ok: boolean; device_id: string; capability: string }> {
    const { subjectId, targetDeviceId, targetPublicKeyB64, capability, rootSeckeyB64 } = args;

    const msg = `authorize|${ subjectId }|${ targetDeviceId }|${ targetPublicKeyB64 }|${ capability }`;
    const signature_b64 = signDetachedB64(msg, rootSeckeyB64);

    const res = await fetch(`${ baseUrlNoSlash(cfg.baseUrl) }/devices/authorize`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-App-Token": cfg.appIssueToken,
        },
        body: JSON.stringify({
            subject_id: subjectId,
            target_device_id: targetDeviceId,
            target_public_key_b64: targetPublicKeyB64,
            capability,
            signature_b64,
        }),
    });

    if (!res.ok) {
        const text = await safeText(res);
        throw new VaultError("server_error", `devices/authorize failed: ${ res.status }`, {
            status: res.status,
            bodyText: text,
        });
    }

    return res.json();
}
