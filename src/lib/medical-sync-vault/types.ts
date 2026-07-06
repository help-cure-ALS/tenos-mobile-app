export type VaultConfig = {
    baseUrl: string;
    appIssueToken: string;
    storePrefix?: string; // default "medical_sync_vault"
};

export type CursorV2 = { since_ts: string; since_id: string };

export type VaultEvent = {
    event_id: string;
    device_id: string;
    lamport: number | string;
    device_seq?: number;

    entity_type?: string;
    entity_id?: string;
    op_kind?: "create" | "update" | "delete";

    client_created_at?: string;

    alg: string;
    nonce_b64: string;
    ciphertext_b64: string;
    ciphertext_hash_b64: string;
};

export type PullResponseV2 = { events: any[]; next: CursorV2 | null };
export type BatchResponse = { acked: string[] };

export type IssueTokenResponse = {
    access_token: string;
    token_type: "Bearer";
    expires_in: number;
};

export type ChallengeResponse = {
    challenge_id: string;
    challenge_b64: string;
    expires_in: number;
};
