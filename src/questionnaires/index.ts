/**
 * Questionnaires Module
 *
 * Generic system for health questionnaires like ALSFRS-R, PHQ-9, etc.
 * Supports flexible FHIR storage strategies.
 */

// Types
export type {
    FhirStorageStrategy,
    QuestionOption,
    QuestionDefinition,
    QuestionnaireDomain,
    QuestionnaireIntro,
    QuestionnaireSchedule,
    QuestionnaireAvailability,
    ScoreInterpretation,
    QuestionnaireScoringConfig,
    QuestionnaireFhirConfig,
    QuestionnaireDefinition,
    StructuredFieldDefinition,
    StructuredFieldOption,
    StructuredFieldLocale,
    StructuredBaseFieldDefinition,
    QuestionnaireEntry,
    QuestionnaireWithData,
} from './types';

export {
    getAllQuestions,
    calculateTotalScore,
    calculateDomainScores,
    getScoreInterpretation,
    isQuestionnaireComplete,
    getDomainMaxScore,
    getQuestionnaireAvailability,
    getNextDueDate,
} from './types';

// Definitions
export {
    // Dynamic API (language-aware)
    getQuestionnaireDefinition,
    getAllQuestionnaireDefinitions,
    getLocalizedQuestionnaireDefinition,
    getAllLocalizedQuestionnaireDefinitions,
    // Legacy API (deprecated)
    questionnaireDefinitions,
    questionnaireRegistry,
    alsfrsr,
    bdifs,
    dailyCheck,
    pdq5,
    pes,
    phq9,
    who5,
} from './definitions';

// FHIR
export {
    saveQuestionnaireAnswers,
    loadQuestionnaireEntries,
    getLatestQuestionValue,
    getQuestionHistory,
} from './fhir/questionnaireToFhir';
export {
    fhirToStructuredQuestionnairePayload,
    structuredQuestionnaireEntryToFhir,
} from './fhir/structuredQuestionnaireToFhir';

// Hooks
export {
    useQuestionnaire,
    useQuestionnaireForm,
} from './hooks/useQuestionnaire';
export { useStructuredQuestionnaire } from './hooks/useStructuredQuestionnaire';

// Components
export { QuestionnaireScreen, QuestionnaireCard, QuestionnaireCarousel } from './components';
