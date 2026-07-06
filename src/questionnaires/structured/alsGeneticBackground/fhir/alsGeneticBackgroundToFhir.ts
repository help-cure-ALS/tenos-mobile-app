import type { ALSGeneticBackgroundEntry } from '../types';
import {
    ALS_GENETIC_BACKGROUND_OBSERVATION_CODE,
    ALS_GENETIC_BACKGROUND_OBSERVATION_SYSTEM,
    ALS_GENETIC_BACKGROUND_PAYLOAD_EXTENSION_URL,
} from '../types';
import { fhirToStructuredQuestionnairePayload } from '@/src/questionnaires/fhir/structuredQuestionnaireToFhir';

function getPayload(resource: any): ALSGeneticBackgroundEntry | null {
    const extensions = resource?.extension;
    if (!Array.isArray(extensions)) return null;
    const payload = extensions.find((e: any) => e?.url === ALS_GENETIC_BACKGROUND_PAYLOAD_EXTENSION_URL)?.valueString;
    if (!payload) return null;
    try {
        return JSON.parse(payload) as ALSGeneticBackgroundEntry;
    } catch {
        return null;
    }
}

export function alsGeneticBackgroundToFhir(entry: ALSGeneticBackgroundEntry, subjectReference: string): any {
    const now = new Date().toISOString();
    return {
        resourceType: 'Observation',
        id: entry.id,
        status: 'final',
        category: [{
            coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'survey',
                display: 'Survey',
            }],
        }],
        code: {
            coding: [{
                system: ALS_GENETIC_BACKGROUND_OBSERVATION_SYSTEM,
                code: ALS_GENETIC_BACKGROUND_OBSERVATION_CODE,
                display: 'ALS genetic background',
            }],
            text: 'ALS-Form und Genetik',
        },
        subject: { reference: subjectReference },
        effectiveDateTime: entry.assessedAt,
        issued: now,
        valueCodeableConcept: {
            coding: [{
                system: ALS_GENETIC_BACKGROUND_OBSERVATION_SYSTEM,
                code: entry.diseaseForm,
                display: entry.diseaseForm,
            }],
            text: entry.diseaseForm,
        },
        extension: [{
            url: ALS_GENETIC_BACKGROUND_PAYLOAD_EXTENSION_URL,
            valueString: JSON.stringify(entry),
        }],
        meta: {
            lastUpdated: now,
        },
    };
}

export function fhirToALSGeneticBackground(resource: any): ALSGeneticBackgroundEntry | null {
    const structured = fhirToStructuredQuestionnairePayload<ALSGeneticBackgroundEntry>(resource, 'als_genetic_background');
    if (structured) return structured;

    if (resource?.resourceType !== 'Observation') return null;
    const coding = resource?.code?.coding?.[0];
    if (coding?.system !== ALS_GENETIC_BACKGROUND_OBSERVATION_SYSTEM || coding?.code !== ALS_GENETIC_BACKGROUND_OBSERVATION_CODE) {
        return null;
    }
    return getPayload(resource);
}
