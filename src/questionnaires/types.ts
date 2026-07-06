/**
 * Questionnaire Types
 *
 * Defines the structure for configurable health questionnaires like ALSFRS-R, PHQ-9, etc.
 * Each questionnaire definition describes questions, scoring, and FHIR storage strategy.
 */

import type { FhirCoding, ObservationCategory } from '../metrics/types';
import type { TodoCondition } from '../types/todoRules';

/**
 * FHIR storage strategy for questionnaire answers.
 *
 * - 'questionnaireResponse': Store as single FHIR QuestionnaireResponse
 * - 'observations': Store each question as individual FHIR Observation
 * - 'hybrid': Store both QuestionnaireResponse and selected questions as Observations
 */
export type FhirStorageStrategy = 'questionnaireResponse' | 'observations' | 'hybrid';

/**
 * Answer option for a question.
 */
export type QuestionOption = {
    /** Numeric value (e.g., 0-4) */
    value: number;
    /** Short label for the option (fallback if labelKey not found) */
    label: string;
    /** i18n translation key for label */
    labelKey?: string;
    /** Optional detailed description (fallback if descriptionKey not found) */
    description?: string;
    /** i18n translation key for description */
    descriptionKey?: string;
};

/**
 * A single question within a questionnaire.
 */
export type QuestionDefinition = {
    /** Unique ID within the questionnaire (e.g., 'speech', 'q1') */
    id: string;

    /** FHIR linkId for QuestionnaireResponse items */
    linkId?: string;

    /** Question text shown to the user */
    text: string;

    /** i18n translation key for question text */
    textKey?: string;

    /** Short label for PDF export column headers (falls back to text if not set) */
    exportLabel?: string;

    /** Available answer options */
    options: QuestionOption[];

    /**
     * FHIR code for this question.
     * Required when storageStrategy is 'observations' or when storeAsObservation is true.
     */
    fhirCode?: FhirCoding;

    /**
     * For 'hybrid' strategy: Also store this question as an individual Observation?
     * Default: false
     */
    storeAsObservation?: boolean;

    /**
     * Unit for the observation value (e.g., '/10', 'kg', 'cm').
     * When set, the value is stored as valueQuantity instead of valueInteger.
     * This ensures compatibility with the metrics system for trend charts.
     */
    fhirUnit?: string;

    /** Optional help text shown below the question */
    helpText?: string;

    /**
     * Introductory text shown above this question in paged mode.
     * Overrides the questionnaire-level introText for this specific question.
     */
    introText?: string;

    /**
     * Input type for this question.
     * - 'list': Checkbox list with descriptions (default for ≤5 options)
     * - 'slider': Slider input with value display (default for >5 options)
     * - 'chips': Horizontal chip buttons (compact, no descriptions)
     * If not specified, automatically chosen based on number of options.
     */
    inputType?: 'list' | 'slider' | 'chips';

    /**
     * Default value for this question.
     * If set, the question starts with this value pre-selected.
     * If not set, user must actively choose a value.
     */
    defaultValue?: number;

    /**
     * Pre-fill this question's value from the most recent previous response.
     * Useful for questions whose answer rarely changes (e.g., "duration of symptoms").
     * The user can still override the pre-filled value.
     */
    prefillFromPreviousResponse?: boolean;
};

/**
 * A domain/section grouping related questions.
 */
export type QuestionnaireDomain = {
    /** Unique ID (e.g., 'bulbar', 'motor') */
    id: string;

    /** Display name (e.g., 'Bulbäre Funktion') */
    name: string;

    /** i18n translation key for domain name */
    nameKey?: string;

    /** Questions in this domain */
    questions: QuestionDefinition[];

    /** Maximum possible score for this domain (calculated from questions if not set) */
    maxScore?: number;
};

/**
 * Intro page configuration shown before questions.
 */
export type QuestionnaireIntro = {
    /** SF Symbol icon name */
    icon: string;
    /** Icon color (hex, falls back to questionnaire iconColor) */
    iconColor?: string;
    /** Title on intro page */
    title: string;
    /** i18n translation key for title */
    titleKey?: string;
    /** Description text */
    description: string;
    /** i18n translation key for description */
    descriptionKey?: string;
    /** Button text (default: "Starten") */
    buttonText?: string;
    /** i18n translation key for button text */
    buttonTextKey?: string;
    /** Research note shown below description (e.g. thanking user for participation) */
    researchNote?: string;
};

/**
 * Schedule configuration for questionnaire frequency and availability.
 */
export type QuestionnaireSchedule = {
    /**
     * Frequency in days (7 = weekly, 30 = monthly, 0 = one-time).
     */
    frequencyDays: number;

    /**
     * Whether the schedule is enforced (locked until next due date)
     * or just a recommendation.
     */
    enforced: boolean;

    /**
     * Grace period in days - questionnaire becomes available this many days
     * before the next due date. Default: 0 (available exactly on due date).
     */
    gracePeriodDays?: number;

    /**
     * How many days a due item stays visible before hiding until next cycle.
     * If not set, the item stays visible indefinitely while due.
     */
    showForDays?: number;

    /**
     * Start date - questionnaire not available before this date.
     * ISO 8601 date string (e.g., '2025-01-01').
     */
    availableFrom?: string;

    /**
     * End date - questionnaire not available after this date.
     * ISO 8601 date string (e.g., '2025-12-31').
     */
    availableUntil?: string;

    /**
     * Delay in days before this questionnaire first appears in the todo list.
     * Relative to account creation (PatientPreferences.createdAt).
     * Prevents overwhelming new users with all questionnaires on day one.
     * Example: startAfterDays: 14 → questionnaire hidden for first 2 weeks.
     */
    startAfterDays?: number;
};

/**
 * Score interpretation range.
 */
export type ScoreInterpretation = {
    /** Minimum score for this range (inclusive) */
    minScore: number;
    /** Maximum score for this range (inclusive) */
    maxScore: number;
    /** Label (e.g., 'Minimale Depression') */
    label: string;
    /** Description text */
    description: string;
    /** Color for display (hex) */
    color: string;
};

/**
 * Scoring configuration for the questionnaire.
 */
export type QuestionnaireScoringConfig = {
    /** Maximum total score */
    maxScore: number;

    /** Whether higher scores are better (true) or worse (false) */
    higherIsBetter?: boolean;

    /** Score interpretations for result display */
    interpretations?: ScoreInterpretation[];

    /** Custom scoring function (if not simple sum) */
    calculateScore?: (answers: Record<string, number>) => number;

    /** Calculate domain subscores? */
    calculateDomainScores?: boolean;

    /** Show the numeric score and interpretation label on the result screen (default: true) */
    showScore?: boolean;
};

/**
 * FHIR configuration for the questionnaire.
 */
export type QuestionnaireFhirConfig = {
    /** How to store answers in FHIR */
    storageStrategy: FhirStorageStrategy;

    /**
     * Canonical URL for the questionnaire.
     * Required for 'questionnaireResponse' and 'hybrid' strategies.
     */
    questionnaireUrl?: string;

    /**
     * Observation category for individual observations.
     * Required for 'observations' and 'hybrid' strategies.
     * Default: 'survey'
     */
    observationCategory?: ObservationCategory;

    /**
     * FHIR code for the total score observation.
     * If set, total score is also saved as an Observation.
     */
    totalScoreCode?: FhirCoding;
};

/**
 * Complete questionnaire definition.
 */
export type QuestionnaireDefinition = {
    /** Unique identifier (e.g., 'alsfrs-r', 'phq9') */
    id: string;

    /**
     * Whether this questionnaire is available in the app.
     * Defaults to true. Set to false to keep the definition in code or on the
     * definitions server without exposing it in UI, todos, export, or lookup APIs.
     */
    enabled?: boolean;

    /** Official/technical name (e.g., 'ALSFRS-R', 'PHQ-9', 'MOS Pain Effects Scale') */
    name: string;

    /** i18n translation key for name */
    nameKey?: string;

    /**
     * User-friendly display name (e.g., 'Funktionsstatus', 'Depressionsscreening').
     * Shown in UI instead of name. Falls back to name if not set.
     */
    displayName?: string;

    /** i18n translation key for displayName */
    displayNameKey?: string;

    /** Short name for compact display */
    shortName?: string;

    /** i18n translation key for shortName */
    shortNameKey?: string;

    /** Title used in PDF export (falls back to displayName – shortName or name) */
    exportTitle?: string;

    /** SF Symbol icon name */
    icon: string;

    /** Icon color (hex) */
    iconColor: string;

    /** Description of the questionnaire */
    description: string;

    /** i18n translation key for description */
    descriptionKey?: string;

    /**
     * Allow this questionnaire route to be accessed via metric sharing permission.
     * Useful for questionnaires that are also exposed as metric-like views.
     */
    allowAsMetric?: boolean;

    /**
     * Metric ID to check when allowAsMetric is enabled.
     * Defaults to questionnaire id when omitted.
     */
    metricAccessId?: string;

    /**
     * Native renderer key for structured questionnaires that use a custom app UI
     * instead of the generic numeric questionnaire screen.
     */
    customRenderer?: string;

    /**
     * Structured field metadata for native custom renderers.
     * This keeps option values and translated labels in the questionnaire
     * definition so a server-provided definition can drive the same UI.
     */
    structuredFields?: Record<string, StructuredFieldDefinition>;

    /** Introductory text shown before questions (deprecated, use intro instead) */
    introText?: string;

    /** i18n translation key for introText */
    introTextKey?: string;

    /** Intro page configuration (shown before questions start) */
    intro?: QuestionnaireIntro;

    /** FHIR configuration */
    fhir: QuestionnaireFhirConfig;

    /** Questions grouped by domain */
    domains: QuestionnaireDomain[];

    /** Scoring configuration */
    scoring: QuestionnaireScoringConfig;

    /** Estimated time to complete (in minutes) */
    estimatedMinutes?: number;

    /**
     * Schedule configuration for frequency and availability.
     * Replaces recommendedFrequencyDays with more options.
     */
    schedule?: QuestionnaireSchedule;

    /**
     * @deprecated Use schedule.frequencyDays instead.
     * How often this questionnaire should be completed (in days).
     */
    recommendedFrequencyDays?: number;

    /** Period for trend calculation (in days). Default: 30 */
    trendPeriodDays?: number;

    /**
     * Show this questionnaire in the overview carousel.
     * If false/undefined, only visible on "Alle Fragebögen" page.
     */
    highlighted?: boolean;

    /** Sort order for display (lower = first). Questionnaires without sortOrder appear last. */
    sortOrder?: number;

    /**
     * Display mode for the questionnaire.
     * - 'scroll': All questions in a scrollable list (default)
     * - 'paged': One question per page with back/next navigation
     */
    displayMode?: 'scroll' | 'paged';

    /**
     * Whether this questionnaire appears in the todo list by default.
     * Only relevant for questionnaires with a schedule.
     * Default: true (all scheduled questionnaires appear in todo list).
     * Set to false to hide from todo list unless the user explicitly enables it.
     */
    todoByDefault?: boolean;

    /**
     * Conditional rules for showing this questionnaire in the todo list.
     * Only evaluated when todoByDefault is false and user hasn't explicitly configured.
     * AND-logic: all conditions must match for the item to appear.
     */
    todoRules?: TodoCondition[];
};

/**
 * A completed questionnaire entry (loaded from FHIR).
 */
export type QuestionnaireEntry = {
    /** Unique ID (FHIR resource ID) */
    id: string;

    /** Questionnaire definition ID */
    questionnaireId: string;

    /** Answers keyed by question ID */
    answers: Record<string, number>;

    /** Total score */
    totalScore: number;

    /** Domain scores keyed by domain ID */
    domainScores?: Record<string, number>;

    /** When the questionnaire was completed */
    completedAt: Date;

    /** Who completed it (patient, caregiver, doctor) */
    recordedByRole?: string;
};

/**
 * Questionnaire with its historical entries.
 */
export type QuestionnaireWithData = {
    definition: QuestionnaireDefinition;
    entries: QuestionnaireEntry[];
    latestEntry: QuestionnaireEntry | null;
};

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Get all questions from a questionnaire definition.
 */
export function getAllQuestions(definition: QuestionnaireDefinition): QuestionDefinition[] {
    return definition.domains.flatMap(domain => domain.questions);
}

/**
 * Calculate total score from answers.
 */
export function calculateTotalScore(
    definition: QuestionnaireDefinition,
    answers: Record<string, number>
): number {
    if (definition.scoring.calculateScore) {
        return definition.scoring.calculateScore(answers);
    }

    // Default: simple sum
    return Object.values(answers).reduce((sum, value) => sum + (value ?? 0), 0);
}

/**
 * Calculate domain scores from answers.
 */
export function calculateDomainScores(
    definition: QuestionnaireDefinition,
    answers: Record<string, number>
): Record<string, number> {
    const scores: Record<string, number> = {};

    for (const domain of definition.domains) {
        scores[domain.id] = domain.questions.reduce(
            (sum, q) => sum + (answers[q.id] ?? 0),
            0
        );
    }

    return scores;
}

/**
 * Get score interpretation for a given score.
 */
export function getScoreInterpretation(
    definition: QuestionnaireDefinition,
    score: number
): ScoreInterpretation | undefined {
    return definition.scoring.interpretations?.find(
        i => score >= i.minScore && score <= i.maxScore
    );
}

/**
 * Check if all questions have been answered.
 */
export function isQuestionnaireComplete(
    definition: QuestionnaireDefinition,
    answers: Record<string, number>
): boolean {
    const questions = getAllQuestions(definition);
    return questions.every(q => answers[q.id] !== undefined && answers[q.id] !== null);
}

/**
 * Get the maximum score for a domain.
 */
export function getDomainMaxScore(domain: QuestionnaireDomain): number {
    if (domain.maxScore !== undefined) {
        return domain.maxScore;
    }
    // Calculate from questions: sum of max option values
    return domain.questions.reduce((sum, q) => {
        const maxOption = Math.max(...q.options.map(o => o.value));
        return sum + maxOption;
    }, 0);
}

// =============================================================================
// Schedule Helper Functions
// =============================================================================

/**
 * Result of checking questionnaire availability.
 */
export type QuestionnaireAvailability = {
    /** Whether the questionnaire can be started now */
    available: boolean;
    /** Reason why it's not available (if unavailable) */
    reason?: 'not_started' | 'ended' | 'locked_until_due';
    /** Next available date (if locked) */
    nextAvailableDate?: Date;
    /** Days until available (if locked) */
    daysUntilAvailable?: number;
    /**
     * Days until due (for non-enforced schedules).
     * Positive = due in X days, 0 = due today, negative = overdue by X days.
     * Only set when available is true and there's a schedule.
     */
    dueInDays?: number;
    /** Days until availableUntil (end of availability window). Only set when available and availableUntil exists. */
    daysUntilEnd?: number;
};

/**
 * Check if a questionnaire is available to start.
 *
 * @param definition - The questionnaire definition
 * @param lastCompletedAt - Date when the questionnaire was last completed (or null if never)
 * @param now - Current date (defaults to now)
 */
export function getQuestionnaireAvailability(
    definition: QuestionnaireDefinition,
    lastCompletedAt: Date | null,
    now: Date = new Date()
): QuestionnaireAvailability {
    const schedule = definition.schedule;

    // No schedule = always available
    if (!schedule) {
        return { available: true };
    }

    // Validate: startDate > endDate is an invalid definition
    if (schedule.availableFrom && schedule.availableUntil) {
        if (new Date(schedule.availableFrom) > new Date(schedule.availableUntil)) {
            console.warn(`Invalid questionnaire definition "${definition.id}": availableFrom > availableUntil`);
            return { available: false };
        }
    }

    // Check availableFrom
    if (schedule.availableFrom) {
        const fromDate = new Date(schedule.availableFrom);
        if (now < fromDate) {
            return {
                available: false,
                reason: 'not_started',
                nextAvailableDate: fromDate,
                daysUntilAvailable: Math.ceil((fromDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
            };
        }
    }

    // Check availableUntil
    if (schedule.availableUntil) {
        const untilDate = new Date(schedule.availableUntil);
        // Set to end of day
        untilDate.setHours(23, 59, 59, 999);
        if (now > untilDate) {
            return {
                available: false,
                reason: 'ended',
            };
        }
    }

    // Calculate days until end of availability window
    const daysUntilEnd = schedule.availableUntil
        ? (() => {
            const untilDate = new Date(schedule.availableUntil);
            untilDate.setHours(23, 59, 59, 999);
            const nowStart = new Date(now);
            nowStart.setHours(0, 0, 0, 0);
            return Math.max(0, Math.ceil((untilDate.getTime() - nowStart.getTime()) / (1000 * 60 * 60 * 24)));
        })()
        : undefined;

    // Check frequency lock (only if enforced and previously completed)
    if (schedule.enforced && lastCompletedAt && schedule.frequencyDays > 0) {
        const gracePeriod = schedule.gracePeriodDays ?? 0;
        const nextDueDate = new Date(lastCompletedAt);
        nextDueDate.setDate(nextDueDate.getDate() + schedule.frequencyDays - gracePeriod);
        nextDueDate.setHours(0, 0, 0, 0);

        if (now < nextDueDate) {
            const daysUntil = Math.ceil((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return {
                available: false,
                reason: 'locked_until_due',
                nextAvailableDate: nextDueDate,
                daysUntilAvailable: daysUntil,
            };
        }
    }

    // Calculate dueInDays for non-enforced schedules (or enforced that are now available)
    if (lastCompletedAt && schedule.frequencyDays > 0) {
        const nextDueDate = new Date(lastCompletedAt);
        nextDueDate.setDate(nextDueDate.getDate() + schedule.frequencyDays);
        nextDueDate.setHours(0, 0, 0, 0);

        const nowStart = new Date(now);
        nowStart.setHours(0, 0, 0, 0);

        const diffMs = nextDueDate.getTime() - nowStart.getTime();
        const dueInDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        return { available: true, dueInDays, daysUntilEnd };
    }

    // Never completed or no frequency = available, due now
    return { available: true, dueInDays: 0, daysUntilEnd };
}

/**
 * Get the next due date for a questionnaire.
 *
 * @param definition - The questionnaire definition
 * @param lastCompletedAt - Date when the questionnaire was last completed (or null if never)
 */
export function getNextDueDate(
    definition: QuestionnaireDefinition,
    lastCompletedAt: Date | null
): Date | null {
    const schedule = definition.schedule;
    const frequencyDays = schedule?.frequencyDays ?? definition.recommendedFrequencyDays;

    if (!frequencyDays || frequencyDays <= 0) {
        return null;
    }

    if (!lastCompletedAt) {
        // Never completed - due now (or from availableFrom)
        if (schedule?.availableFrom) {
            return new Date(schedule.availableFrom);
        }
        return new Date();
    }

    const nextDue = new Date(lastCompletedAt);
    nextDue.setDate(nextDue.getDate() + frequencyDays);
    return nextDue;
}

// =============================================================================
// Base Definition Types (language-neutral)
// =============================================================================

/**
 * Base interpretation (without text labels).
 */
export type BaseScoreInterpretation = {
    minScore: number;
    maxScore: number;
    color: string;
};

/**
 * Base question definition (without text).
 */
export type BaseQuestionDefinition = {
    id: string;
    linkId?: string;
    optionValues: number[];
    fhirCode?: FhirCoding;
    storeAsObservation?: boolean;
    fhirUnit?: string;
    inputType?: 'list' | 'slider' | 'chips';
    defaultValue?: number;
    prefillFromPreviousResponse?: boolean;
};

/**
 * Base domain definition (without text).
 */
export type BaseDomainDefinition = {
    id: string;
    questions: BaseQuestionDefinition[];
    maxScore?: number;
};

/**
 * Base scoring configuration (without text labels).
 */
export type BaseScoringConfig = {
    maxScore: number;
    higherIsBetter?: boolean;
    interpretations?: BaseScoreInterpretation[];
    calculateScore?: (answers: Record<string, number>) => number;
    calculateDomainScores?: boolean;
    /** Show the numeric score and interpretation label on the result screen (default: true) */
    showScore?: boolean;
};

/**
 * Language-neutral questionnaire base definition.
 * Contains only technical fields: id, fhir, scoring, structure.
 */
export type QuestionnaireBaseDefinition = {
    id: string;
    enabled?: boolean;
    icon: string;
    iconColor: string;
    allowAsMetric?: boolean;
    metricAccessId?: string;
    customRenderer?: string;
    structuredFields?: Record<string, StructuredBaseFieldDefinition>;
    fhir: QuestionnaireFhirConfig;
    scoring: BaseScoringConfig;
    domains: BaseDomainDefinition[];
    estimatedMinutes?: number;
    schedule?: QuestionnaireSchedule;
    trendPeriodDays?: number;
    highlighted?: boolean;
    sortOrder?: number;
    displayMode?: 'scroll' | 'paged';
    todoByDefault?: boolean;

    /**
     * Conditional rules for showing this questionnaire in the todo list.
     * Only evaluated when todoByDefault is false and user hasn't explicitly configured.
     * AND-logic: all conditions must match for the item to appear.
     */
    todoRules?: TodoCondition[];
};

// =============================================================================
// Locale Types (text content only)
// =============================================================================

/**
 * Option text content.
 */
export type OptionLocale = {
    label: string;
    description?: string;
};

/**
 * Question text content.
 */
export type QuestionLocale = {
    text: string;
    /** Short label for PDF export column headers */
    exportLabel?: string;
    helpText?: string;
    introText?: string;
    options: Record<string, OptionLocale>;
};

/**
 * Intro text content.
 */
export type IntroLocale = {
    title: string;
    description: string;
    buttonText?: string;
};

/**
 * Interpretation text content.
 */
export type InterpretationLocale = {
    label: string;
    description: string;
};

/**
 * Scoring text content.
 */
export type ScoringLocale = {
    interpretations: InterpretationLocale[];
};

/**
 * Locale content for a questionnaire.
 */
export type QuestionnaireLocale = {
    name: string;
    displayName?: string;
    shortName?: string;
    /** Title used in PDF export */
    exportTitle?: string;
    description: string;
    introText?: string;
    intro?: IntroLocale;
    domains: Record<string, string>;
    questions: Record<string, QuestionLocale>;
    structuredFields?: Record<string, StructuredFieldLocale>;
    scoring?: ScoringLocale;
};

/**
 * Language-neutral structured field metadata for custom renderers.
 */
export type StructuredBaseFieldDefinition = {
    id: string;
    optionValues?: string[];
    required?: boolean;
    multiple?: boolean;
};

/**
 * Localized structured option text.
 */
export type StructuredOptionLocale = {
    label: string;
    description?: string;
};

/**
 * Localized structured field text.
 */
export type StructuredFieldLocale = {
    label?: string;
    info?: string;
    placeholder?: string;
    options?: Record<string, StructuredOptionLocale>;
};

/**
 * Merged structured option.
 */
export type StructuredFieldOption = {
    value: string;
    label: string;
    description?: string;
};

/**
 * Merged structured field metadata.
 */
export type StructuredFieldDefinition = {
    id: string;
    label?: string;
    info?: string;
    placeholder?: string;
    required?: boolean;
    multiple?: boolean;
    options: StructuredFieldOption[];
};

// =============================================================================
// Merge Function
// =============================================================================

/**
 * Merge a base definition with locale texts to create a full QuestionnaireDefinition.
 */
export function mergeDefinition(
    base: QuestionnaireBaseDefinition,
    locale: QuestionnaireLocale
): QuestionnaireDefinition {
    return {
        id: base.id,
        enabled: base.enabled,
        name: locale.name,
        displayName: locale.displayName,
        shortName: locale.shortName,
        exportTitle: locale.exportTitle,
        icon: base.icon,
        iconColor: base.iconColor,
        description: locale.description,
        allowAsMetric: base.allowAsMetric,
        metricAccessId: base.metricAccessId,
        customRenderer: base.customRenderer,
        structuredFields: mergeStructuredFields(base.structuredFields, locale.structuredFields),
        introText: locale.introText,
        intro: locale.intro ? {
            icon: base.icon,
            title: locale.intro.title,
            description: locale.intro.description,
            buttonText: locale.intro.buttonText,
        } : undefined,
        fhir: base.fhir,
        domains: base.domains.map(baseDomain => ({
            id: baseDomain.id,
            name: locale.domains[baseDomain.id] ?? baseDomain.id,
            maxScore: baseDomain.maxScore,
            questions: baseDomain.questions.map(baseQuestion => {
                const questionLocale = locale.questions[baseQuestion.id];
                return {
                    id: baseQuestion.id,
                    linkId: baseQuestion.linkId,
                    text: questionLocale?.text ?? baseQuestion.id,
                    exportLabel: questionLocale?.exportLabel,
                    helpText: questionLocale?.helpText,
                    introText: questionLocale?.introText,
                    options: baseQuestion.optionValues.map(value => ({
                        value,
                        label: questionLocale?.options[String(value)]?.label ?? String(value),
                        description: questionLocale?.options[String(value)]?.description,
                    })),
                    fhirCode: baseQuestion.fhirCode,
                    storeAsObservation: baseQuestion.storeAsObservation,
                    fhirUnit: baseQuestion.fhirUnit,
                    inputType: baseQuestion.inputType,
                    defaultValue: baseQuestion.defaultValue,
                    prefillFromPreviousResponse: baseQuestion.prefillFromPreviousResponse,
                };
            }),
        })),
        scoring: {
            maxScore: base.scoring.maxScore,
            higherIsBetter: base.scoring.higherIsBetter,
            calculateDomainScores: base.scoring.calculateDomainScores,
            calculateScore: base.scoring.calculateScore,
            showScore: base.scoring.showScore,
            interpretations: base.scoring.interpretations?.map((baseInterp, index) => ({
                minScore: baseInterp.minScore,
                maxScore: baseInterp.maxScore,
                color: baseInterp.color,
                label: locale.scoring?.interpretations[index]?.label ?? '',
                description: locale.scoring?.interpretations[index]?.description ?? '',
            })),
        },
        estimatedMinutes: base.estimatedMinutes,
        schedule: base.schedule,
        trendPeriodDays: base.trendPeriodDays,
        highlighted: base.highlighted,
        sortOrder: base.sortOrder,
        displayMode: base.displayMode,
        todoByDefault: base.todoByDefault,
        todoRules: base.todoRules,
    };
}

function mergeStructuredFields(
    baseFields?: Record<string, StructuredBaseFieldDefinition>,
    localeFields?: Record<string, StructuredFieldLocale>
): Record<string, StructuredFieldDefinition> | undefined {
    if (!baseFields) return undefined;

    const merged: Record<string, StructuredFieldDefinition> = {};
    for (const [fieldId, baseField] of Object.entries(baseFields)) {
        const localeField = localeFields?.[fieldId];
        merged[fieldId] = {
            id: baseField.id,
            label: localeField?.label,
            info: localeField?.info,
            placeholder: localeField?.placeholder,
            required: baseField.required,
            multiple: baseField.multiple,
            options: (baseField.optionValues ?? []).map((value) => ({
                value,
                label: localeField?.options?.[value]?.label ?? value,
                description: localeField?.options?.[value]?.description,
            })),
        };
    }
    return merged;
}
