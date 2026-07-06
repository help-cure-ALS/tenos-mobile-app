/**
 * Anonymization functions for FHIR resources before donation.
 *
 * Rules:
 * - KEEP: status, category, code (LOINC), effectiveDateTime, valueQuantity/component
 * - REMOVE: subject.reference (vault ID), device.display, meta.extension (addedAt, recordedByRole),
 *           all urn:medical-sync-vault extensions
 * - REPLACE: id → deterministic hash, subject → Patient/<anonymous_research_id>
 * - ADD: meta.tag = [{ system: 'urn:hca:research', code: 'research-donation' }]
 */
import { deriveResourceId } from './anonymousId';
import { DOMAIN_SYSTEM, APP_DOMAIN } from '@/src/definitions/domainConfig';
import { ALS_GENETIC_BACKGROUND_PAYLOAD_EXTENSION_URL } from '@/src/questionnaires/structured/alsGeneticBackground/types';
import { ALS_KINGS_STAGE_QUESTIONNAIRE_ID } from '@/src/questionnaires/structured/alsKingsStage/types';
import { ALS_SUBTYPE_PAYLOAD_EXTENSION_URL } from '@/src/questionnaires/structured/alsSubtype/types';
import { ALS_NEUROLOGICAL_EXAM_PAYLOAD_EXTENSION_URL } from '@/src/questionnaires/structured/neurologicalExam/types';
import {
    STRUCTURED_QUESTIONNAIRE_ID_EXTENSION_URL,
    STRUCTURED_QUESTIONNAIRE_PAYLOAD_LINK_ID,
} from '@/src/questionnaires/fhir/structuredQuestionnaireToFhir';

const RESEARCH_TAG = { system: 'urn:hca:research', code: 'research-donation' };
const DOMAIN_TAG = { system: DOMAIN_SYSTEM, code: APP_DOMAIN };

/**
 * Anonymize a FHIR Observation for research donation.
 */
export async function anonymizeObservation(
    observation: any,
    anonymousResearchId: string
): Promise<any> {
    // Derive deterministic ID from anonymous_id + LOINC code + effectiveDateTime
    const loincCode = observation.code?.coding?.[0]?.code ?? 'unknown';
    const effectiveDateTime = observation.effectiveDateTime ?? '';
    const deterministicId = await deriveResourceId(
        anonymousResearchId,
        `${loincCode}:${effectiveDateTime}`
    );

    const anonymized: any = {
        resourceType: 'Observation',
        id: deterministicId,
        meta: {
            tag: [RESEARCH_TAG, DOMAIN_TAG],
        },
        status: observation.status,
        category: observation.category,
        code: observation.code,
        subject: { reference: `Patient/${anonymousResearchId}` },
        effectiveDateTime: observation.effectiveDateTime,
    };

    // Keep valueQuantity if present
    if (observation.valueQuantity) {
        anonymized.valueQuantity = observation.valueQuantity;
    }

    // Keep integer values for questionnaire-derived observations and scores
    if (observation.valueInteger !== undefined) {
        anonymized.valueInteger = observation.valueInteger;
    }

    // Keep coded clinical values such as ALS-OPM subtype.
    if (observation.valueCodeableConcept) {
        anonymized.valueCodeableConcept = observation.valueCodeableConcept;
    }

    // Keep components if present (multi-value observations like blood pressure)
    if (observation.component) {
        anonymized.component = observation.component;
    }

    const structuredExtension = sanitizeClinicalPayloadExtension(observation.extension);
    if (structuredExtension) {
        anonymized.extension = [structuredExtension];
    }

    return anonymized;
}

/**
 * Anonymize a FHIR QuestionnaireResponse for research donation.
 */
export async function anonymizeQuestionnaireResponse(
    qr: any,
    anonymousResearchId: string
): Promise<any> {
    // Derive deterministic ID from anonymous_id + questionnaire URL + authored
    const questionnaireUrl = qr.questionnaire ?? 'unknown';
    const authored = qr.authored ?? '';
    const deterministicId = await deriveResourceId(
        anonymousResearchId,
        `${questionnaireUrl}:${authored}`
    );

    const anonymized: any = {
        resourceType: 'QuestionnaireResponse',
        id: deterministicId,
        meta: {
            tag: [RESEARCH_TAG, DOMAIN_TAG],
        },
        status: qr.status,
        questionnaire: qr.questionnaire,
        subject: { reference: `Patient/${anonymousResearchId}` },
        authored: qr.authored,
    };

    if (qr.item) {
        anonymized.item =
            sanitizeStructuredQuestionnaireItems(qr.item, getStructuredQuestionnaireId(qr)) ??
            stripVaultExtensions(qr.item);
    }

    return anonymized;
}

/**
 * Recursively strip vault-internal extensions from FHIR items.
 */
function stripVaultExtensions(items: any[]): any[] {
    return items.map((item: any) => {
        const cleaned = { ...item };

        // Remove extensions with vault URIs
        if (cleaned.extension) {
            cleaned.extension = cleaned.extension.filter(
                (ext: any) => !ext.url?.includes('medical-sync-vault')
            );
            if (cleaned.extension.length === 0) {
                delete cleaned.extension;
            }
        }

        // Recurse into nested items
        if (cleaned.item) {
            cleaned.item = stripVaultExtensions(cleaned.item);
        }

        return cleaned;
    });
}

function getStructuredQuestionnaireId(resource: any): string | undefined {
    const extensions = resource?.meta?.extension;
    if (!Array.isArray(extensions)) return undefined;
    return extensions.find((ext: any) => ext?.url === STRUCTURED_QUESTIONNAIRE_ID_EXTENSION_URL)?.valueString;
}

function sanitizeStructuredQuestionnaireItems(items: any[], questionnaireId: string | undefined): any[] | undefined {
    if (!questionnaireId) return undefined;
    const payloadItem = items.find((item: any) => item?.linkId === STRUCTURED_QUESTIONNAIRE_PAYLOAD_LINK_ID);
    const raw = payloadItem?.answer?.[0]?.valueString;
    if (!raw) return undefined;

    try {
        const payload = JSON.parse(raw);
        const safePayload = sanitizeStructuredClinicalPayload(questionnaireId, payload);
        if (!safePayload) return undefined;
        return [{
            linkId: STRUCTURED_QUESTIONNAIRE_PAYLOAD_LINK_ID,
            answer: [{
                valueString: JSON.stringify(safePayload),
            }],
        }];
    } catch {
        return undefined;
    }
}

function sanitizeStructuredClinicalPayload(questionnaireId: string, payload: any): any | undefined {
    if (questionnaireId === 'als_subtype') {
        const {
            id: _id,
            note: _note,
            recordedByDeviceId: _recordedByDeviceId,
            linkedNeurologicalExamId: _linkedNeurologicalExamId,
            ...safePayload
        } = payload;
        return safePayload;
    }

    if (questionnaireId === 'als_neurological_exam') {
        const { id: _id, examinerName: _examinerName, summary: _summary, note: _note, ...safePayload } = payload;
        return {
            ...safePayload,
            regions: Array.isArray(safePayload.regions)
                ? safePayload.regions.map((region: any) => {
                    const { note: _regionNote, ...safeRegion } = region;
                    return safeRegion;
                })
                : [],
        };
    }

    if (questionnaireId === 'als_genetic_background') {
        const {
            id: _id,
            variantText: _variantText,
            note: _note,
            ...safePayload
        } = payload;
        return safePayload;
    }

    if (questionnaireId === ALS_KINGS_STAGE_QUESTIONNAIRE_ID) {
        const { id: _id, note: _note, ...safePayload } = payload;
        return safePayload;
    }

    return undefined;
}

function sanitizeClinicalPayloadExtension(extensions: any[] | undefined): any | undefined {
    if (!Array.isArray(extensions)) return undefined;

    const alsSubtypePayload = parsePayloadExtension(extensions, ALS_SUBTYPE_PAYLOAD_EXTENSION_URL);
    if (alsSubtypePayload) {
        const {
            id: _id,
            note: _note,
            recordedByDeviceId: _recordedByDeviceId,
            linkedNeurologicalExamId: _linkedNeurologicalExamId,
            ...safePayload
        } = alsSubtypePayload;
        return {
            url: ALS_SUBTYPE_PAYLOAD_EXTENSION_URL,
            valueString: JSON.stringify(safePayload),
        };
    }

    const neurologicalExamPayload = parsePayloadExtension(extensions, ALS_NEUROLOGICAL_EXAM_PAYLOAD_EXTENSION_URL);
    if (neurologicalExamPayload) {
        const { id: _id, examinerName: _examinerName, summary: _summary, note: _note, ...safePayload } = neurologicalExamPayload;
        return {
            url: ALS_NEUROLOGICAL_EXAM_PAYLOAD_EXTENSION_URL,
            valueString: JSON.stringify({
                ...safePayload,
                regions: Array.isArray(safePayload.regions)
                    ? safePayload.regions.map((region: any) => {
                        const { note: _regionNote, ...safeRegion } = region;
                        return safeRegion;
                    })
                    : [],
            }),
        };
    }

    const geneticBackgroundPayload = parsePayloadExtension(extensions, ALS_GENETIC_BACKGROUND_PAYLOAD_EXTENSION_URL);
    if (geneticBackgroundPayload) {
        const {
            id: _id,
            variantText: _variantText,
            note: _note,
            ...safePayload
        } = geneticBackgroundPayload;
        return {
            url: ALS_GENETIC_BACKGROUND_PAYLOAD_EXTENSION_URL,
            valueString: JSON.stringify(safePayload),
        };
    }

    return undefined;
}

function parsePayloadExtension(extensions: any[], url: string): any | undefined {
    const raw = extensions.find((ext: any) => ext?.url === url)?.valueString;
    if (!raw) return undefined;
    try {
        return JSON.parse(raw);
    } catch {
        return undefined;
    }
}
