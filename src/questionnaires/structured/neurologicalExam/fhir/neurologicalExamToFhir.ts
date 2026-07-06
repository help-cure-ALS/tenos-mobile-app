import type { NeurologicalExamEntry } from '../types';
import {
    ALS_NEUROLOGICAL_EXAM_OBSERVATION_CODE,
    ALS_NEUROLOGICAL_EXAM_OBSERVATION_SYSTEM,
    ALS_NEUROLOGICAL_EXAM_PAYLOAD_EXTENSION_URL,
} from '../types';
import { fhirToStructuredQuestionnairePayload } from '@/src/questionnaires/fhir/structuredQuestionnaireToFhir';

function getPayload(resource: any): NeurologicalExamEntry | null {
    const extensions = resource?.extension;
    if (!Array.isArray(extensions)) return null;
    const payload = extensions.find((e: any) => e?.url === ALS_NEUROLOGICAL_EXAM_PAYLOAD_EXTENSION_URL)?.valueString;
    if (!payload) return null;
    try {
        return JSON.parse(payload) as NeurologicalExamEntry;
    } catch {
        return null;
    }
}

export function neurologicalExamToFhir(entry: NeurologicalExamEntry, subjectReference: string): any {
    const now = new Date().toISOString();
    return {
        resourceType: 'Observation',
        id: entry.id,
        status: 'final',
        category: [{
            coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'exam',
                display: 'Exam',
            }],
        }],
        code: {
            coding: [{
                system: ALS_NEUROLOGICAL_EXAM_OBSERVATION_SYSTEM,
                code: ALS_NEUROLOGICAL_EXAM_OBSERVATION_CODE,
                display: 'ALS neurological motor exam',
            }],
            text: 'Neurologische Untersuchung bei ALS',
        },
        subject: { reference: subjectReference },
        effectiveDateTime: entry.assessedAt,
        issued: now,
        valueString: entry.summary ?? entry.suggestedMotorNeuronCode ?? 'ALS neurological motor exam',
        extension: [{
            url: ALS_NEUROLOGICAL_EXAM_PAYLOAD_EXTENSION_URL,
            valueString: JSON.stringify(entry),
        }],
        meta: {
            lastUpdated: now,
        },
    };
}

export function fhirToNeurologicalExam(resource: any): NeurologicalExamEntry | null {
    const structured = fhirToStructuredQuestionnairePayload<NeurologicalExamEntry>(resource, 'als_neurological_exam');
    if (structured) return structured;

    if (resource?.resourceType !== 'Observation') return null;
    const coding = resource?.code?.coding?.[0];
    if (coding?.system !== ALS_NEUROLOGICAL_EXAM_OBSERVATION_SYSTEM || coding?.code !== ALS_NEUROLOGICAL_EXAM_OBSERVATION_CODE) {
        return null;
    }
    return getPayload(resource);
}
