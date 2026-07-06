export type Keybag = {
    SUBJECT_ID: string;
    DEVICE_ID: string;
    ACCESS_TOKEN: string;

    CURSOR_SINCE_TS: string;
    CURSOR_SINCE_ID: string;

    PUBKEY_B64: string;
    SECKEY_B64: string;

    SUBJECT_REGISTERED: string;
};

export function createKeybag(): Keybag {
    // names only (storage adapter handles prefixing)
    return {
        SUBJECT_ID: "subject_id",
        DEVICE_ID: "device_id",
        ACCESS_TOKEN: "access_token",

        CURSOR_SINCE_TS: "cursor_since_ts",
        CURSOR_SINCE_ID: "cursor_since_id",

        PUBKEY_B64: "ed25519_public_key_b64",
        SECKEY_B64: "ed25519_secret_key_b64",

        SUBJECT_REGISTERED: "subject_registered",
    };
}
