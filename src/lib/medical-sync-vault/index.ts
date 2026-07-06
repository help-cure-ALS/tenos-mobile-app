export { createVaultClient } from "./client";

export * from "./types";
export * from "./errors";

export * from "./api/events";
export * from "./api/devices";
export * from "./api/subjects";
export * from "./cursor/cursor";
export * from "./storage/expoSecureStore";

export * from "./storage/keybag";
export * from "./crypto/ed25519";

export type { OutboxStore, OutboxRecord, OutboxStats, OutboxPointer, OutboxOpKind } from "./outbox/types";
export { createExpoSQLiteOutbox } from "./outbox/expoSqliteOutbox";
export { flushOutbox, type EncryptedEnvelope, type FlushOptions, type FlushResult } from "./outbox/flush";
