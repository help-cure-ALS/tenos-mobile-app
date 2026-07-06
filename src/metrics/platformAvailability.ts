import type { MetricDefinition } from './types';

/**
 * Whether a metric is available on the given OS.
 *
 * Metrics without a `platforms` restriction are available everywhere. Metrics that
 * declare `platforms` (e.g. iOS-only Apple "Mobility" gait metrics) are hidden
 * entirely on any OS not listed.
 *
 * Pure (no react-native import) so it is unit-testable in the node harness; the
 * caller supplies the current OS.
 */
export function isMetricAvailableOnPlatform(
    def: Pick<MetricDefinition, 'platforms'>,
    os: 'ios' | 'android'
): boolean {
    return !def.platforms || def.platforms.includes(os);
}
