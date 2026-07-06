import type { ALSSubtypeEntry } from '../types';
import {
    ALS_OPM_CODE_SYSTEM,
    ALS_SUBTYPE_OBSERVATION_CODE,
    ALS_SUBTYPE_OBSERVATION_SYSTEM,
    ALS_SUBTYPE_PAYLOAD_EXTENSION_URL,
} from '../types';
import { fhirToStructuredQuestionnairePayload } from '@/src/questionnaires/fhir/structuredQuestionnaireToFhir';

function getPayload(resource: any): ALSSubtypeEntry | null {
    const extensions = resource?.extension;
    if (!Array.isArray(extensions)) return null;
    const payload = extensions.find((e: any) => e?.url === ALS_SUBTYPE_PAYLOAD_EXTENSION_URL)?.valueString;
    if (!payload) return null;
    try {
        return JSON.parse(payload) as ALSSubtypeEntry;
    } catch {
        return null;
    }
}

export function alsSubtypeToFhir(entry: ALSSubtypeEntry, subjectReference: string): any {
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
                system: ALS_SUBTYPE_OBSERVATION_SYSTEM,
                code: ALS_SUBTYPE_OBSERVATION_CODE,
                display: 'ALS OPM classification',
            }],
            text: 'ALS-OPM-Klassifikation',
        },
        subject: { reference: subjectReference },
        effectiveDateTime: entry.assessedAt,
        issued: now,
        valueCodeableConcept: {
            coding: [{
                system: ALS_OPM_CODE_SYSTEM,
                code: entry.classificationCode,
                display: entry.classificationCode,
            }],
            text: entry.classificationCode,
        },
        extension: [{
            url: ALS_SUBTYPE_PAYLOAD_EXTENSION_URL,
            valueString: JSON.stringify(entry),
        }],
        meta: {
            lastUpdated: now,
        },
    };
}

export function fhirToALSSubtype(resource: any): ALSSubtypeEntry | null {
    const structured = fhirToStructuredQuestionnairePayload<ALSSubtypeEntry>(resource, 'als_subtype');
    if (structured) return structured;

    if (resource?.resourceType !== 'Observation') return null;
    const coding = resource?.code?.coding?.[0];
    if (coding?.system !== ALS_SUBTYPE_OBSERVATION_SYSTEM || coding?.code !== ALS_SUBTYPE_OBSERVATION_CODE) {
        return null;
    }
    return getPayload(resource);
}
