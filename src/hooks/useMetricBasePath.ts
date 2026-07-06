import { useSegments } from 'expo-router';

/**
 * Returns the base path for metric navigation depending on which stack
 * the screen is rendered in (search tab, metric tab, or standalone).
 */
export function useMetricBasePath(metricId: string): string {
    const segments: string[] = useSegments();
    if (segments.includes('search')) return `/(tabs)/search/${metricId}`;
    if (segments.includes('(metric)')) return `/(tabs)/(metric)/${metricId}`;
    return `/metric/${metricId}`;
}
