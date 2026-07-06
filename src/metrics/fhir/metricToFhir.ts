/**
 * FHIR Conversion Layer
 *
 * Converts between MetricEntry data and FHIR Observation resources.
 */

import type { FhirCoding, MetricDefinition, MetricEntry } from '../types';
import { convertMetricValues } from '../units';

/** Extension URL for addedAt timestamp */
const ADDED_AT_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/added-at';

/** Extension URL for recorded-by-role */
const RECORDED_BY_ROLE_URL = 'urn:medical-sync-vault:recorded-by-role';

/** Extension URL for external Apple Health / Health Connect source metadata */
export const EXTERNAL_HEALTH_SOURCE_URL = 'urn:tenos:external-health-source';

/** FHIR Observation resource structure (simplified) */
export type FhirObservation = {
    resourceType: 'Observation';
    id: string;
    meta?: {
        lastUpdated?: string;
        extension?: Array<{
            url: string;
            valueDateTime?: string;
            valueString?: string;
            valueCode?: string;
        }>;
    };
    status: 'final' | 'preliminary' | 'amended' | 'corrected';
    category: Array<{
        coding: Array<{
            system: string;
            code: string;
            display?: string;
        }>;
    }>;
    code: {
        coding: FhirCoding[];
        text?: string;
    };
    subject?: {
        reference: string;
    };
    effectiveDateTime: string;
    valueQuantity?: {
        value: number;
        unit: string;
        system?: string;
        code?: string;
    };
    valueInteger?: number;
    component?: Array<{
        code: {
            coding: FhirCoding[];
        };
        valueQuantity: {
            value: number;
            unit: string;
            system?: string;
            code?: string;
        };
    }>;
    device?: {
        display: string;
    };
};

function appendMetaExtension(
    observation: FhirObservation,
    extension: NonNullable<NonNullable<FhirObservation['meta']>['extension']>[number]
) {
    observation.meta = observation.meta ?? {};
    observation.meta.extension = [...(observation.meta.extension ?? []), extension];
}

/** Category code mapping */
const CATEGORY_CODES: Record<
    MetricDefinition['fhir']['category'],
    { code: string; display: string }
> = {
    'vital-signs': { code: 'vital-signs', display: 'Vital Signs' },
    laboratory: { code: 'laboratory', display: 'Laboratory' },
    survey: { code: 'survey', display: 'Survey' },
    activity: { code: 'activity', display: 'Activity' },
};

/**
 * Convert a MetricEntry to a FHIR Observation resource
 */
export function metricEntryToFhir(
    entry: MetricEntry,
    definition: MetricDefinition,
    patientReference?: string
): FhirObservation {
    const categoryInfo = CATEGORY_CODES[definition.fhir.category];

    const observation: FhirObservation = {
        resourceType: 'Observation',
        id: entry.id,
        meta: {
            lastUpdated: new Date().toISOString(),
        },
        status: 'final',
        category: [
            {
                coding: [
                    {
                        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                        code: categoryInfo.code,
                        display: categoryInfo.display,
                    },
                ],
            },
        ],
        code: {
            coding: [definition.fhir.code],
            text: definition.name,
        },
        effectiveDateTime: entry.date.toISOString(),
    };

    // Add addedAt as extension if provided
    if (entry.addedAt) {
        appendMetaExtension(observation, {
            url: ADDED_AT_EXTENSION_URL,
            valueDateTime: entry.addedAt.toISOString(),
        });
    }

    // Add structured external health source metadata if provided.
    if (entry.externalHealth) {
        appendMetaExtension(observation, {
            url: EXTERNAL_HEALTH_SOURCE_URL,
            valueString: JSON.stringify(entry.externalHealth),
        });
    }

    // Add patient reference if provided
    if (patientReference) {
        observation.subject = { reference: patientReference };
    }

    // Add source as device if provided
    if (entry.source) {
        observation.device = { display: entry.source };
    }

    // Check if this is a multi-value metric (has component codes)
    const hasComponents = definition.fields.some(
        (field) => field.fhirComponentCode
    );

    if (hasComponents) {
        // Multi-value observation (e.g., blood pressure)
        observation.component = definition.fields
            .filter((field) => field.fhirComponentCode)
            .map((field) => ({
                code: {
                    coding: [field.fhirComponentCode!],
                },
                valueQuantity: {
                    value: entry.values[field.key],
                    unit: field.unit ?? entry.unit,
                    system: 'http://unitsofmeasure.org',
                    code: field.unit ?? entry.unit,
                },
            }));
    } else {
        // Single-value observation
        const primaryField = definition.fields[0];
        observation.valueQuantity = {
            value: entry.values[primaryField.key],
            unit: entry.unit,
            system: 'http://unitsofmeasure.org',
            code: entry.unit,
        };
    }

    return observation;
}

/**
 * Parse a FHIR Observation into a MetricEntry
 */
export function fhirToMetricEntry(
    observation: FhirObservation,
    definition: MetricDefinition
): MetricEntry | null {
    // ID is required
    if (!observation.id) {
        console.warn('fhirToMetricEntry: observation has no id, skipping');
        return null;
    }

    const values: Record<string, number> = {};

    // Check if this is a multi-value observation
    if (observation.component && observation.component.length > 0) {
        // Multi-value: extract from components
        for (const component of observation.component) {
            const componentCode = component.code.coding[0]?.code;

            // Find matching field by FHIR component code
            const field = definition.fields.find(
                (f) => f.fhirComponentCode?.code === componentCode
            );

            if (field && component.valueQuantity?.value !== undefined) {
                values[field.key] = component.valueQuantity.value;
            }
        }
    } else if (observation.valueQuantity?.value !== undefined) {
        // Single-value: use primary field
        const primaryField = definition.fields[0];
        values[primaryField.key] = observation.valueQuantity.value;
    } else if (observation.valueInteger !== undefined) {
        // Integer-valued observation (e.g. from demo data or external FHIR sources)
        const primaryField = definition.fields[0];
        values[primaryField.key] = observation.valueInteger;
    }

    // Parse addedAt from extension
    const addedAtExt = observation.meta?.extension?.find(
        (e) => e.url === ADDED_AT_EXTENSION_URL
    );
    const addedAt = addedAtExt?.valueDateTime
        ? new Date(addedAtExt.valueDateTime)
        : undefined;

    // Parse recordedByRole from extension (stored as valueCode)
    const recordedByRoleExt = observation.meta?.extension?.find(
        (e) => e.url === RECORDED_BY_ROLE_URL
    );
    const recordedByRole = recordedByRoleExt?.valueCode;

    const externalHealthExt = observation.meta?.extension?.find(
        (e) => e.url === EXTERNAL_HEALTH_SOURCE_URL
    );
    let externalHealth: MetricEntry['externalHealth'] | undefined;
    if (externalHealthExt?.valueString) {
        try {
            const parsed = JSON.parse(externalHealthExt.valueString);
            if (parsed?.platform === 'apple_health' || parsed?.platform === 'health_connect') {
                externalHealth = parsed;
            }
        } catch {
            externalHealth = undefined;
        }
    }

    const observedUnit =
        observation.valueQuantity?.unit ??
        observation.component?.[0]?.valueQuantity?.unit ??
        definition.defaultUnit;

    const canonicalValues = convertMetricValues(
        values,
        observedUnit,
        definition.defaultUnit,
        definition
    );

    return {
        id: observation.id,
        values: canonicalValues,
        date: new Date(observation.effectiveDateTime),
        unit: definition.defaultUnit,
        source: observation.device?.display,
        externalHealth,
        addedAt,
        recordedByRole,
    };
}

/**
 * Validate metric values against field definitions
 */
export function validateMetricValues(
    values: Record<string, number>,
    definition: MetricDefinition
): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};

    for (const field of definition.fields) {
        const value = values[field.key];
        const validation = field.validation;

        if (validation?.required && (value === undefined || value === null)) {
            errors[field.key] = `${field.label} ist erforderlich`;
            continue;
        }

        if (value !== undefined && value !== null) {
            if (validation?.min !== undefined && value < validation.min) {
                errors[field.key] =
                    `${field.label} muss mindestens ${validation.min} sein`;
            }
            if (validation?.max !== undefined && value > validation.max) {
                errors[field.key] =
                    `${field.label} darf maximal ${validation.max} sein`;
            }
        }
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors,
    };
}

/**
 * Convert a value between units
 */
export function convertUnit(
    value: number,
    fromUnit: string,
    toUnit: string,
    definition: MetricDefinition
): number {
    return convertMetricValues({ value }, fromUnit, toUnit, definition).value;
}
