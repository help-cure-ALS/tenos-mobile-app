/**
 * useQuestionnaire Hook
 *
 * Provides access to questionnaire data and actions.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFhirRepo } from '@/src/hooks/useFhirRepo';
import { on } from '@/src/lib/bus';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { getQuestionnaireDefinition } from '../definitions';
import {
    saveQuestionnaireAnswers,
    loadQuestionnaireEntries,
} from '../fhir/questionnaireToFhir';
import type {
    QuestionnaireDefinition,
    QuestionnaireEntry,
} from '../types';
import {
    calculateTotalScore,
    calculateDomainScores,
    isQuestionnaireComplete,
    getScoreInterpretation,
} from '../types';

export type UseQuestionnaireOptions = {
    /** Questionnaire ID to load */
    questionnaireId: string;
};

export type UseQuestionnaireReturn = {
    /** The questionnaire definition */
    definition: QuestionnaireDefinition | undefined;

    /** Historical entries */
    entries: QuestionnaireEntry[];

    /** Latest completed entry */
    latestEntry: QuestionnaireEntry | null;

    /** Whether data is loading */
    isLoading: boolean;

    /** Reload entries from FHIR store */
    reload: () => Promise<void>;

    /** Save new questionnaire answers */
    save: (
        answers: Record<string, number>,
        effectiveDate?: Date
    ) => Promise<{ success: boolean; error?: string }>;
};

/**
 * Hook for loading and saving questionnaire data.
 */
export function useQuestionnaire({
    questionnaireId,
}: UseQuestionnaireOptions): UseQuestionnaireReturn {
    const { upsert, list } = useFhirRepo();
    const { syncEnabled, fullSync } = useAppSync();
    const [entries, setEntries] = useState<QuestionnaireEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const definition = useMemo(
        () => getQuestionnaireDefinition(questionnaireId),
        [questionnaireId]
    );

    const loadEntries = useCallback(async () => {
        if (!definition) {
            setEntries([]);
            setIsLoading(false);
            return;
        }

        try {
            const listFn = async (resourceType: string, opts?: { tag?: string }) => {
                const results = await list(resourceType, { limit: 1000, ...opts });
                return results;
            };

            const loaded = await loadQuestionnaireEntries(definition, listFn);
            setEntries(loaded);
        } catch (error) {
            console.warn('Failed to load questionnaire entries:', error);
            setEntries([]);
        } finally {
            setIsLoading(false);
        }
    }, [definition, list]);

    // Debounced reload for fhir:changed events (multiple upserts fire many events)
    const debouncedLoad = useMemo(() => {
        let timer: ReturnType<typeof setTimeout>;
        return () => {
            clearTimeout(timer);
            timer = setTimeout(() => loadEntries(), 300);
        };
    }, [loadEntries]);

    useEffect(() => {
        loadEntries();
        const off = on('fhir:changed', debouncedLoad);
        return () => off();
    }, [loadEntries, debouncedLoad]);

    const save = useCallback(
        async (
            answers: Record<string, number>,
            effectiveDate?: Date
        ): Promise<{ success: boolean; error?: string }> => {
            if (!definition) {
                return { success: false, error: 'Questionnaire not found' };
            }

            try {
                // Wrap upsert to map (resourceType, id, resource, tag?) to the hook's signature
                const upsertWithTag = async (resourceType: string, id: string, resource: any, tag?: string) => {
                    await upsert(resourceType, id, resource, undefined, tag);
                };

                await saveQuestionnaireAnswers(
                    definition,
                    answers,
                    effectiveDate ?? new Date(),
                    upsertWithTag
                );

                // No explicit reload needed — debounced fhir:changed listener handles it

                // Sync in background (don't block UI)
                if (syncEnabled) {
                    fullSync('questionnaire save').catch(console.error);
                }

                return { success: true };
            } catch (error) {
                console.error('Failed to save questionnaire:', error);
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                };
            }
        },
        [definition, upsert, syncEnabled, fullSync]
    );

    const latestEntry = entries[0] ?? null;

    return {
        definition,
        entries,
        latestEntry,
        isLoading,
        reload: loadEntries,
        save,
    };
}

// =============================================================================
// Additional Hooks
// =============================================================================

export type UseQuestionnaireFormOptions = {
    /** Questionnaire definition */
    definition: QuestionnaireDefinition;
    /** Initial answers (for editing) */
    initialAnswers?: Record<string, number>;
};

export type UseQuestionnaireFormReturn = {
    /** Current answers */
    answers: Record<string, number>;

    /** Set answer for a question */
    setAnswer: (questionId: string, value: number) => void;

    /** Clear all answers */
    clearAnswers: () => void;

    /** Number of answered questions */
    answeredCount: number;

    /** Total number of questions */
    totalQuestions: number;

    /** Whether all questions are answered */
    isComplete: boolean;

    /** Current total score */
    totalScore: number;

    /** Current domain scores */
    domainScores: Record<string, number>;

    /** Score interpretation for current score */
    interpretation: ReturnType<typeof getScoreInterpretation>;
};

/**
 * Hook for managing questionnaire form state.
 */
export function useQuestionnaireForm({
    definition,
    initialAnswers = {},
}: UseQuestionnaireFormOptions): UseQuestionnaireFormReturn {
    const [answers, setAnswers] = useState<Record<string, number>>(initialAnswers);

    const setAnswer = useCallback((questionId: string, value: number) => {
        setAnswers((prev) => ({ ...prev, [questionId]: value }));
    }, []);

    const clearAnswers = useCallback(() => {
        setAnswers({});
    }, []);

    const totalQuestions = useMemo(
        () => definition.domains.reduce((sum, d) => sum + d.questions.length, 0),
        [definition]
    );

    const answeredCount = useMemo(
        () => Object.keys(answers).filter((k) => answers[k] !== undefined).length,
        [answers]
    );

    const isComplete = useMemo(
        () => isQuestionnaireComplete(definition, answers),
        [definition, answers]
    );

    const totalScore = useMemo(
        () => calculateTotalScore(definition, answers),
        [definition, answers]
    );

    const domainScores = useMemo(
        () => calculateDomainScores(definition, answers),
        [definition, answers]
    );

    const interpretation = useMemo(
        () => getScoreInterpretation(definition, totalScore),
        [definition, totalScore]
    );

    return {
        answers,
        setAnswer,
        clearAnswers,
        answeredCount,
        totalQuestions,
        isComplete,
        totalScore,
        domainScores,
        interpretation,
    };
}
