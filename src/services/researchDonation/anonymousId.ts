/**
 * Derives a deterministic anonymous research ID from a subject_id.
 *
 * Uses SHA-256 with a fixed namespace to produce a stable, one-way mapping.
 * The same subject_id always produces the same research ID (cross-device stable).
 * Not reversible — even if Medplum is compromised, patient identity stays anonymous.
 *
 * Output is formatted as a UUID v4-like string (32 hex chars with dashes).
 */
import * as Crypto from 'expo-crypto';

const NAMESPACE = 'hca-research-donation-v1';

export async function deriveAnonymousResearchId(subjectId: string): Promise<string> {
    const input = `${NAMESPACE}:${subjectId}`;
    const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        input
    );

    // Format as UUID: 8-4-4-4-12
    return [
        hash.slice(0, 8),
        hash.slice(8, 12),
        hash.slice(12, 16),
        hash.slice(16, 20),
        hash.slice(20, 32),
    ].join('-');
}

/**
 * Derive a deterministic resource ID for deduplication.
 * Used for FHIR PUT (upsert) to prevent duplicates.
 */
export async function deriveResourceId(
    anonymousId: string,
    discriminator: string
): Promise<string> {
    const input = `${anonymousId}:${discriminator}`;
    const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        input
    );

    return [
        hash.slice(0, 8),
        hash.slice(8, 12),
        hash.slice(12, 16),
        hash.slice(16, 20),
        hash.slice(20, 32),
    ].join('-');
}
