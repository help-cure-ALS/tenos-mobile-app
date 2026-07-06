/**
 * Metrics Module
 *
 * Generic system for capturing and displaying health metrics.
 * Supports FHIR-compliant data storage and flexible metric definitions.
 */

// Types
export type {
    FhirCoding,
    MetricChartConfig,
    MetricDefinition,
    MetricEntry,
    MetricField,
    MetricInputType,
    MetricWithData,
    MeasurementSystem,
    ObservationCategory,
    UnitOption,
    ValueLabel,
} from './types';

// Helper functions
export { getValueLabel, getCategoryInfo } from './types';

// Definitions
export {
    alsGeneticBackgroundMetric,
    alsKingsStageMetric,
    alsNeurologicalExamMetric,
    alsfrsrMetric,
    alsSubtypeMetric,
    bmiMetric,
    bloodPressureMetric,
    getDefaultPinnedMetrics,
    getMetricDefinition,
    getMetricsByAppCategory,
    getMetricsByCategory,
    getPinnableMetrics,
    getSortedMetricDefinitions,
    metricDefinitions,
    metricRegistry,
    nflMetric,
    tdeeMetric,
    weightMetric,
} from './definitions';

// FHIR conversion
export {
    convertUnit,
    fhirToMetricEntry,
    metricEntryToFhir,
    validateMetricValues,
} from './fhir/metricToFhir';
export type { FhirObservation } from './fhir/metricToFhir';

// Unit display/conversion helpers
export {
    convertMetricDelta,
    convertMetricValues,
    createDisplayDefinition,
    deriveMeasurementSystemFromCountry,
    getDisplayUnit,
    toCanonicalEntry,
    toDisplayEntry,
} from './units';

// Hooks
export { useMetric, useMetricWithData } from './hooks/useMetric';
export { useTDEE, ALSFRS6_QUESTION_IDS, ALSFRS6_MAX_SCORE } from './hooks/useTDEE';
export type { PatientData, ALSFRS6Data, TDEEBreakdown, UseTDEEReturn } from './hooks/useTDEE';

// Components
export { MetricCard, MetricInputForm, MetricValueDisplay } from './components';
