/**
 * FHIR Conversion Layer for Questionnaires
 *
 * Handles saving and loading questionnaire answers using the configured storage strategy:
 * - 'questionnaireResponse': Single FHIR QuestionnaireResponse
 * - 'observations': Individual FHIR Observations per question
 * - 'hybrid': Both QuestionnaireResponse and Observations for marked questions
 */

import * as Crypto from 'expo-crypto';
import type { FhirCoding } from '../../metrics/types';
import type {
    QuestionnaireDefinition,
    QuestionnaireEntry,
    QuestionDefinition,
} from '../types';
import {
    getAllQuestions,
    calculateTotalScore,
    calculateDomainScores,
} from '../types';

// =============================================================================
// FHIR Resource Types
// =============================================================================

export type FhirQuestionnaireResponse = {
    resourceType: 'QuestionnaireResponse';
    id: string;
    meta?: {
        lastUpdated?: string;
        extension?: Array<{
            url: string;
            valueCode?: string;
            valueDateTime?: string;
            valueString?: string;
        }>;
    };
    questionnaire?: string;
    status: 'in-progress' | 'completed' | 'amended' | 'entered-in-error' | 'stopped';
    authored?: string;
    item: Array<{
        linkId: string;
        answer?: Array<{
            valueInteger?: number;
            valueString?: string;
        }>;
    }>;
};

export type FhirObservation = {
    resourceType: 'Observation';
    id: string;
    meta?: {
        lastUpdated?: string;
        extension?: Array<{
            url: string;
            valueCode?: string;
            valueDateTime?: string;
            valueString?: string;
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
    effectiveDateTime: string;
    valueInteger?: number;
    valueQuantity?: {
        value: number;
        unit: string;
        system?: string;
        code?: string;
    };
};

// =============================================================================
// Constants
// =============================================================================

const QUESTIONNAIRE_ID_EXTENSION_URL = 'urn:medical-sync-vault:questionnaire-id';
const SESSION_ID_EXTENSION_URL = 'urn:medical-sync-vault:questionnaire-session-id';

// =============================================================================
// UUID Generation
// =============================================================================

function generateUUID(): string {
    return Crypto.randomUUID();
}

// =============================================================================
// Save Functions
// =============================================================================

export type SaveQuestionnaireResult = {
    /** IDs of created/updated resources */
    resourceIds: string[];
    /** Session ID linking all resources from this submission */
    sessionId: string;
};

/**
 * Save questionnaire answers using the configured storage strategy.
 */
export async function saveQuestionnaireAnswers(
    definition: QuestionnaireDefinition,
    answers: Record<string, number>,
    effectiveDate: Date,
    upsertFn: (resourceType: string, id: string, resource: any, tag?: string) => Promise<void>
): Promise<SaveQuestionnaireResult> {
    const { storageStrategy } = definition.fhir;
    const sessionId = generateUUID();
    const resourceIds: string[] = [];

    switch (storageStrategy) {
        case 'questionnaireResponse': {
            const id = await saveAsQuestionnaireResponse(
                definition,
                answers,
                effectiveDate,
                sessionId,
                upsertFn
            );
            resourceIds.push(id);
            break;
        }

        case 'observations': {
            const ids = await saveAsObservations(
                definition,
                answers,
                effectiveDate,
                sessionId,
                upsertFn,
                { onlyMarked: false }
            );
            resourceIds.push(...ids);
            break;
        }

        case 'hybrid': {
            // Save QuestionnaireResponse
            const responseId = await saveAsQuestionnaireResponse(
                definition,
                answers,
                effectiveDate,
                sessionId,
                upsertFn
            );
            resourceIds.push(responseId);

            // Save marked questions as Observations
            const observationIds = await saveAsObservations(
                definition,
                answers,
                effectiveDate,
                sessionId,
                upsertFn,
                { onlyMarked: true }
            );
            resourceIds.push(...observationIds);
            break;
        }
    }

    return { resourceIds, sessionId };
}

/**
 * Save as a FHIR QuestionnaireResponse.
 */
async function saveAsQuestionnaireResponse(
    definition: QuestionnaireDefinition,
    answers: Record<string, number>,
    effectiveDate: Date,
    sessionId: string,
    upsertFn: (resourceType: string, id: string, resource: any, tag?: string) => Promise<void>
): Promise<string> {
    const id = generateUUID();
    const questions = getAllQuestions(definition);

    const response: FhirQuestionnaireResponse = {
        resourceType: 'QuestionnaireResponse',
        id,
        meta: {
            lastUpdated: new Date().toISOString(),
            extension: [
                { url: QUESTIONNAIRE_ID_EXTENSION_URL, valueString: definition.id },
                { url: SESSION_ID_EXTENSION_URL, valueString: sessionId },
            ],
        },
        questionnaire: definition.fhir.questionnaireUrl,
        status: 'completed',
        authored: effectiveDate.toISOString(),
        item: questions.map((q) => ({
            linkId: q.linkId ?? q.id,
            answer: answers[q.id] !== undefined ? [{ valueInteger: answers[q.id] }] : [],
        })),
    };

    await upsertFn('QuestionnaireResponse', id, response, 'q:' + definition.id);
    return id;
}

/**
 * Save as individual FHIR Observations.
 */
async function saveAsObservations(
    definition: QuestionnaireDefinition,
    answers: Record<string, number>,
    effectiveDate: Date,
    sessionId: string,
    upsertFn: (resourceType: string, id: string, resource: any, tag?: string) => Promise<void>,
    options: { onlyMarked: boolean }
): Promise<string[]> {
    const questions = getAllQuestions(definition);
    const categoryCode = definition.fhir.observationCategory ?? 'survey';
    const tag = 'q:' + definition.id;

    // Build all observation resources first, then upsert in parallel
    const pending: Array<{ id: string; resource: FhirObservation }> = [];

    for (const question of questions) {
        if (options.onlyMarked && !question.storeAsObservation) continue;
        if (!question.fhirCode) continue;
        if (answers[question.id] === undefined) continue;

        const id = generateUUID();

        const observation: FhirObservation = {
            resourceType: 'Observation',
            id,
            meta: {
                lastUpdated: new Date().toISOString(),
                extension: [
                    { url: QUESTIONNAIRE_ID_EXTENSION_URL, valueString: definition.id },
                    { url: SESSION_ID_EXTENSION_URL, valueString: sessionId },
                ],
            },
            status: 'final',
            category: [
                {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                            code: categoryCode,
                            display: categoryCode.charAt(0).toUpperCase() + categoryCode.slice(1),
                        },
                    ],
                },
            ],
            code: {
                coding: [question.fhirCode],
                text: question.text,
            },
            effectiveDateTime: effectiveDate.toISOString(),
            ...(question.fhirUnit
                ? {
                      valueQuantity: {
                          value: answers[question.id],
                          unit: question.fhirUnit,
                          system: 'http://unitsofmeasure.org',
                          code: question.fhirUnit,
                      },
                  }
                : { valueInteger: answers[question.id] }),
        };

        pending.push({ id, resource: observation });
    }

    // Total score observation
    if (definition.fhir.totalScoreCode) {
        const totalScore = calculateTotalScore(definition, answers);
        const id = generateUUID();

        const totalObservation: FhirObservation = {
            resourceType: 'Observation',
            id,
            meta: {
                lastUpdated: new Date().toISOString(),
                extension: [
                    { url: QUESTIONNAIRE_ID_EXTENSION_URL, valueString: definition.id },
                    { url: SESSION_ID_EXTENSION_URL, valueString: sessionId },
                ],
            },
            status: 'final',
            category: [
                {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                            code: categoryCode,
                            display: categoryCode.charAt(0).toUpperCase() + categoryCode.slice(1),
                        },
                    ],
                },
            ],
            code: {
                coding: [definition.fhir.totalScoreCode],
                text: `${definition.name} Total Score`,
            },
            effectiveDateTime: effectiveDate.toISOString(),
            valueInteger: totalScore,
        };

        pending.push({ id, resource: totalObservation });
    }

    // Upsert all observations in parallel
    await Promise.all(
        pending.map(({ id, resource }) => upsertFn('Observation', id, resource, tag))
    );

    return pending.map(p => p.id);
}

// =============================================================================
// Load Functions
// =============================================================================

/**
 * Load questionnaire entries based on the storage strategy.
 */
export async function loadQuestionnaireEntries(
    definition: QuestionnaireDefinition,
    listFn: (resourceType: string, opts?: { tag?: string }) => Promise<Array<{ resource: any; updated_at: string }>>
): Promise<QuestionnaireEntry[]> {
    const { storageStrategy } = definition.fhir;

    switch (storageStrategy) {
        case 'questionnaireResponse':
        case 'hybrid':
            return loadFromQuestionnaireResponses(definition, listFn);

        case 'observations':
            return loadFromObservations(definition, listFn);

        default:
            return [];
    }
}

/**
 * Load entries from QuestionnaireResponse resources.
 */
async function loadFromQuestionnaireResponses(
    definition: QuestionnaireDefinition,
    listFn: (resourceType: string, opts?: { tag?: string }) => Promise<Array<{ resource: any; updated_at: string }>>
): Promise<QuestionnaireEntry[]> {
    const results = await listFn('QuestionnaireResponse', { tag: 'q:' + definition.id });
    const questions = getAllQuestions(definition);
    const entries: QuestionnaireEntry[] = [];

    for (const { resource } of results) {
        // Check if this response belongs to our questionnaire
        const questionnaireIdExt = resource.meta?.extension?.find(
            (e: any) => e.url === QUESTIONNAIRE_ID_EXTENSION_URL
        );
        if (questionnaireIdExt?.valueString !== definition.id) {
            continue;
        }

        // Parse answers from items
        const answers: Record<string, number> = {};
        for (const item of resource.item ?? []) {
            const question = questions.find(
                (q) => (q.linkId ?? q.id) === item.linkId
            );
            if (question && item.answer?.[0]?.valueInteger !== undefined) {
                answers[question.id] = item.answer[0].valueInteger;
            }
        }

        const totalScore = calculateTotalScore(definition, answers);
        const domainScores = definition.scoring.calculateDomainScores
            ? calculateDomainScores(definition, answers)
            : undefined;

        entries.push({
            id: resource.id,
            questionnaireId: definition.id,
            answers,
            totalScore,
            domainScores,
            completedAt: new Date(resource.authored ?? resource.meta?.lastUpdated),
            recordedByRole: resource.meta?.extension?.find(
                (e: any) => e.url === 'urn:medical-sync-vault:recorded-by-role'
            )?.valueCode,
        });
    }

    // Sort by date (newest first)
    entries.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());

    return entries;
}

/**
 * Load entries from Observation resources.
 * Groups observations by session ID to reconstruct complete questionnaire entries.
 */
async function loadFromObservations(
    definition: QuestionnaireDefinition,
    listFn: (resourceType: string, opts?: { tag?: string }) => Promise<Array<{ resource: any; updated_at: string }>>
): Promise<QuestionnaireEntry[]> {
    const results = await listFn('Observation', { tag: 'q:' + definition.id });
    const questions = getAllQuestions(definition);

    // Group observations by session ID
    const sessionMap = new Map<string, {
        answers: Record<string, number>;
        effectiveDate: Date;
        totalScore?: number;
        recordedByRole?: string;
    }>();

    for (const { resource } of results) {
        // Check if this observation belongs to our questionnaire
        const questionnaireIdExt = resource.meta?.extension?.find(
            (e: any) => e.url === QUESTIONNAIRE_ID_EXTENSION_URL
        );
        if (questionnaireIdExt?.valueString !== definition.id) {
            continue;
        }

        // Get session ID
        const sessionIdExt = resource.meta?.extension?.find(
            (e: any) => e.url === SESSION_ID_EXTENSION_URL
        );
        const sessionId = sessionIdExt?.valueString;
        if (!sessionId) {
            continue;
        }

        // Get or create session entry
        if (!sessionMap.has(sessionId)) {
            sessionMap.set(sessionId, {
                answers: {},
                effectiveDate: new Date(resource.effectiveDateTime),
                recordedByRole: resource.meta?.extension?.find(
                    (e: any) => e.url === 'urn:medical-sync-vault:recorded-by-role'
                )?.valueCode,
            });
        }
        const session = sessionMap.get(sessionId)!;

        // Extract value from either valueInteger or valueQuantity
        const value = resource.valueInteger ?? resource.valueQuantity?.value;

        // Check if this is the total score observation
        const code = resource.code?.coding?.[0]?.code;
        if (
            definition.fhir.totalScoreCode &&
            code === definition.fhir.totalScoreCode.code
        ) {
            session.totalScore = value;
            continue;
        }

        // Find matching question
        const question = questions.find((q) => q.fhirCode?.code === code);
        if (question && value !== undefined) {
            session.answers[question.id] = value;
        }
    }

    // Convert sessions to entries
    const entries: QuestionnaireEntry[] = [];

    for (const [sessionId, session] of sessionMap) {
        const totalScore =
            session.totalScore ?? calculateTotalScore(definition, session.answers);
        const domainScores = definition.scoring.calculateDomainScores
            ? calculateDomainScores(definition, session.answers)
            : undefined;

        entries.push({
            id: sessionId,
            questionnaireId: definition.id,
            answers: session.answers,
            totalScore,
            domainScores,
            completedAt: session.effectiveDate,
            recordedByRole: session.recordedByRole,
        });
    }

    // Sort by date (newest first)
    entries.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());

    return entries;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get the latest entry for a specific question (for trend analysis).
 */
export function getLatestQuestionValue(
    entries: QuestionnaireEntry[],
    questionId: string
): number | undefined {
    const latestEntry = entries[0]; // entries are sorted newest first
    return latestEntry?.answers[questionId];
}

/**
 * Get historical values for a specific question (for charts).
 */
export function getQuestionHistory(
    entries: QuestionnaireEntry[],
    questionId: string
): Array<{ date: Date; value: number }> {
    return entries
        .filter((e) => e.answers[questionId] !== undefined)
        .map((e) => ({
            date: e.completedAt,
            value: e.answers[questionId],
        }))
        .reverse(); // oldest first for charts
}
