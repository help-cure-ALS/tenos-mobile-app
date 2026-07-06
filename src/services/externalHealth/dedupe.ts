import type { ExternalHealthRawSample } from './types';

export function buildExternalHealthDedupeKey(sample: ExternalHealthRawSample): string {
    if (sample.externalId) {
        return `${sample.platform}:${sample.metricId}:id:${sample.externalId}`;
    }

    const values = Object.keys(sample.values)
        .sort()
        .map((key) => `${key}=${sample.values[key]}`)
        .join(',');
    return `${sample.platform}:${sample.metricId}:fallback:${sample.observedAt.toISOString()}:${sample.unit}:${values}:${sample.sourceApp ?? ''}`;
}

export function buildExternalHealthObservationId(sample: ExternalHealthRawSample): string {
    return `external-health-${sample.metricId}-${hashForFhirId(buildExternalHealthDedupeKey(sample))}`;
}

function hashForFhirId(input: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i += 1) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}
