import type { MetricDefinition } from '../../metrics/types';

import type { ExternalHealthPlatform, ExternalHealthRegistryEntry } from './types';
import { hasExternalHealthMapping } from './types';

export const HEALTH_CONNECT_ANDROID_READ_PERMISSIONS = [
    'android.permission.health.READ_WEIGHT',
    'android.permission.health.READ_BODY_FAT',
    'android.permission.health.READ_RESTING_HEART_RATE',
    'android.permission.health.READ_OXYGEN_SATURATION',
    'android.permission.health.READ_BODY_TEMPERATURE',
    'android.permission.health.READ_BLOOD_PRESSURE',
    'android.permission.health.READ_NUTRITION',
    'android.permission.health.READ_HYDRATION',
    'android.permission.health.READ_STEPS',
    'android.permission.health.READ_RESPIRATORY_RATE',
    'android.permission.health.READ_FLOORS_CLIMBED',
    'android.permission.health.READ_SPEED',
    'android.permission.health.READ_HEART_RATE_VARIABILITY',
    'android.permission.health.READ_ACTIVE_CALORIES_BURNED',
] as const;

export function buildExternalHealthRegistry(definitions: MetricDefinition[]): ExternalHealthRegistryEntry[] {
    return definitions
        .filter(hasExternalHealthMapping)
        .map((definition) => {
            const appleRead = definition.externalHealth.appleHealthKit?.read ?? [];
            const healthConnectRead = definition.externalHealth.healthConnect?.read ?? [];
            const appleQuantityTypes = Array.from(new Set(
                appleRead
                    .filter((mapping) => !mapping.correlationType && !mapping.categoryType)
                    .map((mapping) => mapping.quantityType)
                    .filter((quantityType): quantityType is string => typeof quantityType === 'string')
            ));
            const appleCorrelationTypes = Array.from(new Set(
                appleRead
                    .map((mapping) => mapping.correlationType)
                    .filter((correlationType): correlationType is string => typeof correlationType === 'string')
            ));
            const appleCorrelationQuantityTypes = Array.from(new Set(
                appleRead
                    .filter((mapping) => mapping.correlationType)
                    .map((mapping) => mapping.quantityType)
                    .filter((quantityType): quantityType is string => typeof quantityType === 'string')
            ));
            const appleCategoryTypes = Array.from(new Set(
                appleRead
                    .map((mapping) => mapping.categoryType)
                    .filter((categoryType): categoryType is string => typeof categoryType === 'string')
            ));

            return {
                metricId: definition.id,
                definition,
                aggregation: definition.externalHealth.aggregation ?? 'sample',
                importPolicy: definition.externalHealth.importPolicy ?? {
                    mode: definition.externalHealth.aggregation === 'latest' ? 'latest' : 'all',
                },
                appleHealthKit: appleRead.length > 0
                    ? {
                        quantityTypes: appleQuantityTypes,
                        correlationTypes: appleCorrelationTypes,
                        categoryTypes: appleCategoryTypes,
                        readTypes: Array.from(new Set([...appleQuantityTypes, ...appleCorrelationQuantityTypes, ...appleCategoryTypes])),
                        fields: appleRead.map((mapping) => ({
                            metricField: mapping.field,
                            sourceField: mapping.categoryType ?? mapping.quantityType,
                            sourceUnit: mapping.unit,
                            sourceKind: mapping.correlationType ? 'correlation' : mapping.categoryType ? 'category' : 'quantity',
                            sourceGroup: mapping.correlationType,
                        })),
                    }
                    : undefined,
                healthConnect: healthConnectRead.length > 0
                    ? {
                        recordTypes: Array.from(new Set(healthConnectRead.map((mapping) => mapping.recordType))),
                        fields: healthConnectRead.map((mapping) => ({
                            metricField: mapping.field,
                            sourceField: `${mapping.recordType}.${mapping.fieldPath}`,
                            sourceUnit: mapping.unit,
                        })),
                    }
                    : undefined,
            };
        });
}

export function getRegistryForPlatform(
    entries: ExternalHealthRegistryEntry[],
    platform: ExternalHealthPlatform
): ExternalHealthRegistryEntry[] {
    return entries.filter((entry) =>
        platform === 'apple_health'
            ? Boolean(entry.appleHealthKit?.readTypes.length)
            : Boolean(entry.healthConnect?.recordTypes.length)
    );
}

export function getDefaultExternalHealthMetricIds(entries: ExternalHealthRegistryEntry[]): string[] {
    return entries
        .filter((entry) => entry.definition.externalHealth?.enabledByDefault !== false)
        .map((entry) => entry.metricId);
}
