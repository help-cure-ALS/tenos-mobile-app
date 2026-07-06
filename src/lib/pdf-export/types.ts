import type { FhirBundle } from '../fhir-export/types';
import type { MetricDefinition } from '@/src/metrics/types';
import type { QuestionnaireDefinition } from '@/src/questionnaires/types';

export type PdfExportOptions = {
    bundle: FhirBundle;
    metricDefinitions: MetricDefinition[];
    questionnaireDefinitions: QuestionnaireDefinition[];
    language: 'de' | 'en';
};

export type MetricFieldFormat = {
    inputType: 'integer' | 'decimal';
    decimalPlaces?: number;
};

export type MetricSummary = {
    name: string;
    unit: string;
    isMultiField: boolean;
    entries: Array<{ date: Date; values: Record<string, number> }>;
    latest: { date: Date; values: Record<string, number> } | null;
    count: number;
    /** Formatting info from the primary field definition */
    fieldFormat?: MetricFieldFormat;
    /** Description text from the metric definition */
    description?: string;
    /** Value labels for discrete-scale metrics (e.g., 0=Keine, 1=Leicht, 2=Mäßig, 3=Stark) */
    valueLabels?: Array<{ value: number; label: string }>;
    /** Whether this metric can receive data from Apple Health / Health Connect */
    hasExternalHealth?: boolean;
    // Single-value metrics:
    min?: number;
    max?: number;
    avg?: number;
    // Multi-field metrics (BP):
    components?: Record<string, { label: string; min: number; max: number; avg: number; fieldFormat?: MetricFieldFormat }>;
};

export type AlsfrsSession = {
    sessionId: string;
    date: Date;
    domainScores: Record<string, number>;
    totalScore: number;
};

export type QuestionnaireSession = {
    sessionId: string;
    date: Date;
    totalScore: number;
    domainScores: Record<string, number>;
    /** Individual question answers (questionId → numeric value) */
    answers: Record<string, number>;
};

export type ALSSubtypeSummary = {
    date: Date;
    code: string;
    summary: string;
    certainty: string;
};

export type NeurologicalExamSummary = {
    date: Date;
    motorNeuronCode: string;
    summary: string;
    umnBurden: string;
    lmnBurden: string;
    regions: string;
};

export type ALSGeneticBackgroundSummary = {
    date: Date;
    headline: string;
    diseaseForm: string;
    familyHistory: string;
    testingStatus: string;
    gene: string;
    variantText: string;
    testDate: string;
    source: string;
    counselingStatus: string;
    summary: string;
    note: string;
};

export type ALSKingsStageSummary = {
    date: Date;
    stage: string;
    description: string;
    regions: string;
    stage4Reason: string;
    source: string;
    summary: string;
};

export type MedicationSummary = {
    name: string;
    dosageText: string;
    timing: string;
    strength: string;
    status: string;
    notes: string;
    startDate: string;
};

export type AidSummary = {
    name: string;
    category: string;
    status: string;
};
