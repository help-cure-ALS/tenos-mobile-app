import type {
    MeasurementSystem,
    MetricDefinition,
    MetricEntry,
    UnitLinearConversion,
    UnitOption,
} from './types';

export function deriveMeasurementSystemFromCountry(country?: string | null): MeasurementSystem {
    return country?.toUpperCase() === 'US' ? 'us' : 'metric';
}

export function getDisplayUnit(
    definition: MetricDefinition,
    preferredUnit?: string | null,
    measurementSystem: MeasurementSystem = 'metric'
): string {
    if (preferredUnit && hasUnit(definition, preferredUnit)) {
        return preferredUnit;
    }

    const systemUnit = definition.availableUnits?.find(
        (unit) => unit.measurementSystem === measurementSystem
    );
    return systemUnit?.value ?? definition.defaultUnit;
}

export function convertMetricValues(
    values: Record<string, number>,
    fromUnit: string,
    toUnit: string,
    definition: MetricDefinition
): Record<string, number> {
    if (fromUnit === toUnit || !definition.availableUnits?.length) {
        return { ...values };
    }

    const converted: Record<string, number> = {};
    for (const field of definition.fields) {
        const value = values[field.key];
        if (value === undefined || value === null) continue;

        // Field-specific units are fixed by definition and should not be changed by
        // a metric-level display preference.
        if (field.unit && field.unit !== fromUnit) {
            converted[field.key] = value;
        } else {
            converted[field.key] = convertUnitValue(value, fromUnit, toUnit, definition);
        }
    }
    return converted;
}

export function convertMetricDelta(
    value: number,
    fromUnit: string,
    toUnit: string,
    definition: MetricDefinition
): number {
    if (fromUnit === toUnit || !definition.availableUnits?.length) {
        return value;
    }

    const from = findUnit(definition, fromUnit);
    const to = findUnit(definition, toUnit);
    if (!from || !to) return value;

    const canonicalDelta = fromUnit === definition.defaultUnit
        ? value
        : value * conversionToDefault(from).multiply;
    return toUnit === definition.defaultUnit
        ? canonicalDelta
        : canonicalDelta * conversionFromDefault(to).multiply;
}

export function toCanonicalEntry(entry: MetricEntry, definition: MetricDefinition): MetricEntry {
    if (entry.unit === definition.defaultUnit) return entry;
    return {
        ...entry,
        values: convertMetricValues(entry.values, entry.unit, definition.defaultUnit, definition),
        unit: definition.defaultUnit,
    };
}

export function toDisplayEntry(
    entry: MetricEntry,
    definition: MetricDefinition,
    displayUnit: string
): MetricEntry {
    if (entry.unit === displayUnit) return entry;
    return {
        ...entry,
        values: convertMetricValues(entry.values, entry.unit, displayUnit, definition),
        unit: displayUnit,
    };
}

export function createDisplayDefinition(
    definition: MetricDefinition,
    displayUnit: string
): MetricDefinition {
    if (displayUnit === definition.defaultUnit || !definition.availableUnits?.length) {
        return definition;
    }

    return {
        ...definition,
        defaultUnit: displayUnit,
        fields: definition.fields.map((field) => ({
            ...field,
            validation: field.validation
                ? {
                    ...field.validation,
                    min: convertOptional(field.validation.min, definition.defaultUnit, displayUnit, definition),
                    max: convertOptional(field.validation.max, definition.defaultUnit, displayUnit, definition),
                }
                : undefined,
        })),
        chart: {
            ...definition.chart,
            referenceLine: definition.chart.referenceLine
                ? {
                    ...definition.chart.referenceLine,
                    value: convertUnitValue(
                        definition.chart.referenceLine.value,
                        definition.defaultUnit,
                        displayUnit,
                        definition
                    ),
                }
                : undefined,
            yAxis: definition.chart.yAxis
                ? {
                    ...definition.chart.yAxis,
                    min: convertOptional(definition.chart.yAxis.min, definition.defaultUnit, displayUnit, definition),
                    max: convertOptional(definition.chart.yAxis.max, definition.defaultUnit, displayUnit, definition),
                }
                : undefined,
        },
    };
}

function hasUnit(definition: MetricDefinition, unitValue: string): boolean {
    if (unitValue === definition.defaultUnit) return true;
    return Boolean(definition.availableUnits?.some((unit) => unit.value === unitValue));
}

function convertOptional(
    value: number | undefined,
    fromUnit: string,
    toUnit: string,
    definition: MetricDefinition
): number | undefined {
    return value === undefined ? undefined : convertUnitValue(value, fromUnit, toUnit, definition);
}

function convertUnitValue(
    value: number,
    fromUnit: string,
    toUnit: string,
    definition: MetricDefinition
): number {
    if (fromUnit === toUnit) return value;

    const from = findUnit(definition, fromUnit);
    const to = findUnit(definition, toUnit);
    if (!from || !to) return value;

    const canonical = fromUnit === definition.defaultUnit
        ? value
        : applyConversion(value, conversionToDefault(from));
    return toUnit === definition.defaultUnit
        ? canonical
        : applyConversion(canonical, conversionFromDefault(to));
}

function findUnit(definition: MetricDefinition, unitValue: string): UnitOption | undefined {
    if (unitValue === definition.defaultUnit) {
        return definition.availableUnits?.find((unit) => unit.value === unitValue) ?? {
            value: definition.defaultUnit,
            label: definition.defaultUnit,
            measurementSystem: 'metric',
        };
    }
    return definition.availableUnits?.find((unit) => unit.value === unitValue);
}

function conversionFromDefault(unit: UnitOption): UnitLinearConversion {
    if (unit.fromDefault) return unit.fromDefault;
    if (unit.conversionFactor) return { multiply: unit.conversionFactor };
    return { multiply: 1 };
}

function conversionToDefault(unit: UnitOption): UnitLinearConversion {
    if (unit.toDefault) return unit.toDefault;
    if (unit.conversionFactor) return { multiply: 1 / unit.conversionFactor };
    return { multiply: 1 };
}

function applyConversion(value: number, conversion: UnitLinearConversion): number {
    return value * conversion.multiply + (conversion.add ?? 0);
}
