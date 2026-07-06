/**
 * Metric Definitions Registry
 *
 * Central registry for all metric definitions.
 * Supports dynamic language switching via getMetricDefinition(id, language).
 */

import { Platform } from 'react-native';

import type { MetricDefinition, MetricCategory } from '../types';
import { getCurrentLanguage } from '../../i18n';
import { isMetricAvailableOnPlatform } from '../platformAvailability';

// Import getDefinition functions from each metric
import { getDefinition as getAlsGeneticBackgroundDef, alsGeneticBackgroundMetric } from './alsGeneticBackground';
import { getDefinition as getAlsKingsStageDef, alsKingsStageMetric } from './alsKingsStage';
import { getDefinition as getAlsSubtypeDef, alsSubtypeMetric } from './alsSubtype';
import { getDefinition as getAlsNeurologicalExamDef, alsNeurologicalExamMetric } from './alsNeurologicalExam';
import { getDefinition as getAlsfrsrDef, alsfrsrMetric } from './alsfrsr';
import { getDefinition as getBmiDef, bmiMetric } from './bmi';
import { getDefinition as getBloodOxygenDef, bloodOxygenMetric } from './bloodOxygen';
import { getDefinition as getBloodPressureDef, bloodPressureMetric } from './bloodPressure';
import { getDefinition as getBodyTemperatureDef, bodyTemperatureMetric } from './bodyTemperature';
import { getDefinition as getBodyFatDef, bodyFatMetric } from './bodyFat';
import { getDefinition as getBristolStoolScaleDef, bristolStoolScaleMetric } from './bristolStoolScale';
import { getDefinition as getCaloricIntakeDef, caloricIntakeMetric } from './caloricIntake';
import { getDefinition as getColdSensitivityDef, coldSensitivityMetric } from './coldSensitivity';
import { getDefinition as getCrampsDef, crampsMetric } from './cramps';
import { getDefinition as getFallsDef, fallsMetric } from './falls';
import { getDefinition as getFasciculationsDef, fasciculationsMetric } from './fasciculations';
import { getDefinition as getFatigueDef, fatigueMetric } from './fatigue';
import { getDefinition as getFluidIntakeDef, fluidIntakeMetric } from './fluidIntake';
import { getDefinition as getFvcDef, fvcMetric } from './fvc';
import { getDefinition as getFvcPercentDef, fvcPercentMetric } from './fvcPercent';
import { getDefinition as getGripStrengthDef, gripStrengthMetric } from './gripStrength';
import { getDefinition as getHeartRateDef, heartRateMetric } from './heartRate';
import { getDefinition as getNflDef, nflMetric } from './nfl';
import { getDefinition as getNflCsfDef, nflCsfMetric } from './nflCsf';
import { getDefinition as getNocturnalSpO2Def, nocturnalSpO2Metric } from './nocturnalSpO2';
import { getDefinition as getPainLevelDef, painLevelMetric } from './painLevel';
import { getDefinition as getPainMobilityDef, painMobilityMetric } from './painMobility';
import { getDefinition as getPainMoodDef, painMoodMetric } from './painMood';
import { getDefinition as getPainSleepDef, painSleepMetric } from './painSleep';
import { getDefinition as getSuicidalityDef, suicidalityMetric } from './suicidality';
import { getDefinition as getPeakCoughFlowDef, peakCoughFlowMetric } from './peakCoughFlow';
import { getDefinition as getSialorrheaDef, sialorrheaMetric } from './sialorrhea';
import { getDefinition as getSpeechRateDef, speechRateMetric } from './speechRate';
import { getDefinition as getSwallowingTimeDef, swallowingTimeMetric } from './swallowingTime';
import { getDefinition as getTdeeDef, tdeeMetric } from './tdee';
import { getDefinition as getWalkingDistanceDef, walkingDistanceMetric } from './walkingDistance';
import { getDefinition as getStepCountDef, stepCountMetric } from './stepCount';
import { getDefinition as getWalkingSteadinessDef, walkingSteadinessMetric } from './walkingSteadiness';
import { getDefinition as getRespiratoryRateDef, respiratoryRateMetric } from './respiratoryRate';
import { getDefinition as getFlightsClimbedDef, flightsClimbedMetric } from './flightsClimbed';
import { getDefinition as getWalkingSpeedDef, walkingSpeedMetric } from './walkingSpeed';
import { getDefinition as getWalkingStepLengthDef, walkingStepLengthMetric } from './walkingStepLength';
import { getDefinition as getWalkingAsymmetryDef, walkingAsymmetryMetric } from './walkingAsymmetry';
import { getDefinition as getWalkingDoubleSupportDef, walkingDoubleSupportMetric } from './walkingDoubleSupport';
import { getDefinition as getStairDescentSpeedDef, stairDescentSpeedMetric } from './stairDescentSpeed';
import { getDefinition as getHrvSdnnDef, hrvSdnnMetric } from './hrv';
import { getDefinition as getHrvRmssdDef, hrvRmssdMetric } from './hrvRmssd';
import { getDefinition as getActiveEnergyDef, activeEnergyMetric } from './activeEnergy';
import { getDefinition as getWeightDef, weightMetric } from './weight';

/** Map of metric IDs to their getDefinition functions */
const definitionGetters: Record<string, (language: string) => MetricDefinition> = {
    'als_genetic_background': getAlsGeneticBackgroundDef,
    'als_kings_stage': getAlsKingsStageDef,
    'als_subtype': getAlsSubtypeDef,
    'als_neurological_exam': getAlsNeurologicalExamDef,
    'alsfrs-r': getAlsfrsrDef,
    'bmi': getBmiDef,
    'blood_oxygen': getBloodOxygenDef,
    'blood_pressure': getBloodPressureDef,
    'body_temperature': getBodyTemperatureDef,
    'body_fat': getBodyFatDef,
    'bristol_stool_scale': getBristolStoolScaleDef,
    'caloric_intake': getCaloricIntakeDef,
    'cold_sensitivity': getColdSensitivityDef,
    'cramps': getCrampsDef,
    'falls': getFallsDef,
    'fasciculations': getFasciculationsDef,
    'fatigue': getFatigueDef,
    'fluid_intake': getFluidIntakeDef,
    'fvc': getFvcDef,
    'fvc_percent': getFvcPercentDef,
    'grip_strength': getGripStrengthDef,
    'heart_rate': getHeartRateDef,
    'nfl': getNflDef,
    'nfl_csf': getNflCsfDef,
    'nocturnal_spo2': getNocturnalSpO2Def,
    'pain_level': getPainLevelDef,
    'pain_mobility': getPainMobilityDef,
    'pain_mood': getPainMoodDef,
    'pain_sleep': getPainSleepDef,
    'suicidality': getSuicidalityDef,
    'peak_cough_flow': getPeakCoughFlowDef,
    'sialorrhea': getSialorrheaDef,
    'speech_rate': getSpeechRateDef,
    'swallowing_time': getSwallowingTimeDef,
    'tdee': getTdeeDef,
    'walking_distance': getWalkingDistanceDef,
    'step_count': getStepCountDef,
    'walking_steadiness': getWalkingSteadinessDef,
    'respiratory_rate': getRespiratoryRateDef,
    'flights_climbed': getFlightsClimbedDef,
    'walking_speed': getWalkingSpeedDef,
    'walking_step_length': getWalkingStepLengthDef,
    'walking_asymmetry': getWalkingAsymmetryDef,
    'walking_double_support': getWalkingDoubleSupportDef,
    'stair_descent_speed': getStairDescentSpeedDef,
    'hrv_sdnn': getHrvSdnnDef,
    'hrv_rmssd': getHrvRmssdDef,
    'active_energy': getActiveEnergyDef,
    'weight': getWeightDef,
};

/** Remote metric definitions (already merged + localized). */
let remoteDefinitions = new Map<string, MetricDefinition>();

function isEnabled(definition: MetricDefinition | undefined): definition is MetricDefinition {
    return definition !== undefined && definition.enabled !== false;
}

function isLocallyDisabled(id: string, language: string): boolean {
    const getter = definitionGetters[id];
    return getter ? getter(language).enabled === false : false;
}

function isRemoteEnabled(id: string, definition: MetricDefinition, language: string): boolean {
    if (definition.enabled !== undefined) return definition.enabled;
    return !isLocallyDisabled(id, language);
}

/** List of all metric IDs (in display order) */
const metricIds = [
    // Funktionsstatus
    'alsfrs-r', 'als_subtype', 'als_neurological_exam', 'als_kings_stage', 'als_genetic_background',
    // Körper & Gewicht
    'weight', 'body_fat', 'bmi',
    // Vitalzeichen
    'heart_rate', 'hrv_sdnn', 'hrv_rmssd', 'blood_oxygen', 'nocturnal_spo2', 'blood_pressure', 'body_temperature',
    // Atemfunktion
    'fvc', 'fvc_percent', 'peak_cough_flow', 'respiratory_rate',
    // Motorik & Kraft
    'grip_strength', 'walking_distance', 'walking_speed', 'step_count', 'flights_climbed',
    'walking_steadiness', 'walking_step_length', 'walking_asymmetry', 'walking_double_support',
    'stair_descent_speed', 'falls',
    // Symptome
    'pain_level', 'pain_sleep', 'pain_mobility', 'pain_mood', 'fatigue', 'cramps',
    'fasciculations', 'cold_sensitivity', 'suicidality',
    // Bulbäre Funktion
    'speech_rate', 'swallowing_time', 'sialorrhea',
    // Ernährung
    'fluid_intake', 'caloric_intake', 'active_energy', 'tdee',
    // Verdauung
    'bristol_stool_scale',
    // Biomarker
    'nfl', 'nfl_csf',
];

// =============================================================================
// Dynamic (language-aware) API
// =============================================================================

/**
 * Get a metric definition by ID in the specified language.
 * Falls back to English if the language is not available.
 */
export function getMetricDefinition(
    id: string,
    language?: string
): MetricDefinition | undefined {
    const lang = language ?? getCurrentLanguage();
    const remote = remoteDefinitions.get(id);
    if (remote) return isRemoteEnabled(id, remote, lang) ? remote : undefined;

    const getter = definitionGetters[id];
    if (!getter) return undefined;
    const local = getter(lang);
    return isEnabled(local) ? local : undefined;
}

/**
 * Get all metric definitions in the specified language.
 * Falls back to English if the language is not available.
 */
export function getAllMetricDefinitions(
    language?: string
): MetricDefinition[] {
    const lang = language ?? getCurrentLanguage();
    const local = metricIds
        .map(id => definitionGetters[id]?.(lang))
        .filter(isEnabled);

    const byId = new Map<string, MetricDefinition>(local.map((d) => [d.id, d]));
    for (const [id, def] of remoteDefinitions.entries()) {
        if (isRemoteEnabled(id, def, lang)) {
            byId.set(id, def);
        } else {
            byId.delete(id);
        }
    }

    return Array.from(byId.values())
        .filter(isEnabled)
        .filter((def) => isMetricAvailableOnPlatform(def, Platform.OS as 'ios' | 'android'));
}

/**
 * Get all metric definitions sorted by sortOrder in the specified language.
 */
export function getSortedMetricDefinitions(language?: string): MetricDefinition[] {
    return [...getAllMetricDefinitions(language)].sort(
        (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100)
    );
}

/**
 * Get metric definitions by FHIR category in the specified language.
 */
export function getMetricsByCategory(
    category: MetricDefinition['fhir']['category'],
    language?: string
): MetricDefinition[] {
    return getAllMetricDefinitions(language).filter((def) => def.fhir.category === category);
}

/**
 * Get pinnable metrics in the specified language.
 */
export function getPinnableMetrics(language?: string): MetricDefinition[] {
    return getAllMetricDefinitions(language).filter((def) => def.canPin);
}

/**
 * Get metrics that should be pinned by default for new users.
 */
export function getDefaultPinnedMetrics(language?: string): MetricDefinition[] {
    return getAllMetricDefinitions(language)
        .filter((def) => def.defaultPinned === true)
        .sort((a, b) => (a.defaultPinnedOrder ?? 100) - (b.defaultPinnedOrder ?? 100));
}

/**
 * Get metrics by app category (for search/browse UI).
 */
export function getMetricsByAppCategory(
    category: MetricCategory,
    language?: string
): MetricDefinition[] {
    return getAllMetricDefinitions(language)
        .filter((def) => def.category === category)
        .sort((a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100));
}

// =============================================================================
// Legacy API (deprecated, for backwards compatibility)
// =============================================================================

/**
 * @deprecated Use getAllMetricDefinitions(language) instead.
 * This static array uses German locale and doesn't update with language changes.
 */
export const metricDefinitions: MetricDefinition[] = [
    alsfrsrMetric,
    alsSubtypeMetric,
    alsNeurologicalExamMetric,
    alsKingsStageMetric,
    alsGeneticBackgroundMetric,
    weightMetric,
    bodyFatMetric,
    bmiMetric,
    heartRateMetric,
    bloodOxygenMetric,
    nocturnalSpO2Metric,
    bloodPressureMetric,
    bodyTemperatureMetric,
    fvcMetric,
    fvcPercentMetric,
    peakCoughFlowMetric,
    gripStrengthMetric,
    walkingDistanceMetric,
    fallsMetric,
    painLevelMetric,
    painSleepMetric,
    painMobilityMetric,
    painMoodMetric,
    fatigueMetric,
    crampsMetric,
    fasciculationsMetric,
    coldSensitivityMetric,
    suicidalityMetric,
    speechRateMetric,
    swallowingTimeMetric,
    sialorrheaMetric,
    fluidIntakeMetric,
    caloricIntakeMetric,
    tdeeMetric,
    bristolStoolScaleMetric,
    nflMetric,
    nflCsfMetric,
].filter(isEnabled);

/**
 * @deprecated Use getMetricDefinition(id, language) instead.
 * This static map uses German locale and doesn't update with language changes.
 */
export const metricRegistry = new Map<string, MetricDefinition>(
    metricDefinitions.map((def) => [def.id, def])
);

/**
 * Set remote metric definitions.
 * Remote definitions override local defaults by ID.
 */
export function setRemoteMetricDefinitions(definitions: MetricDefinition[]): void {
    remoteDefinitions = new Map(definitions.map((d) => [d.id, d]));
}

/** Clear all remote metric definition overrides. */
export function clearRemoteMetricDefinitions(): void {
    remoteDefinitions = new Map();
}

// Re-export individual metrics for direct imports (deprecated)
export { alsGeneticBackgroundMetric } from './alsGeneticBackground';
export { alsKingsStageMetric } from './alsKingsStage';
export { alsNeurologicalExamMetric } from './alsNeurologicalExam';
export { alsfrsrMetric } from './alsfrsr';
export { alsSubtypeMetric } from './alsSubtype';
export { bmiMetric } from './bmi';
export { bloodOxygenMetric } from './bloodOxygen';
export { bloodPressureMetric } from './bloodPressure';
export { bodyTemperatureMetric } from './bodyTemperature';
export { bodyFatMetric } from './bodyFat';
export { bristolStoolScaleMetric } from './bristolStoolScale';
export { caloricIntakeMetric } from './caloricIntake';
export { coldSensitivityMetric } from './coldSensitivity';
export { crampsMetric } from './cramps';
export { fallsMetric } from './falls';
export { fasciculationsMetric } from './fasciculations';
export { fatigueMetric } from './fatigue';
export { fluidIntakeMetric } from './fluidIntake';
export { fvcMetric } from './fvc';
export { fvcPercentMetric } from './fvcPercent';
export { gripStrengthMetric } from './gripStrength';
export { heartRateMetric } from './heartRate';
export { nflMetric } from './nfl';
export { nflCsfMetric } from './nflCsf';
export { nocturnalSpO2Metric } from './nocturnalSpO2';
export { painLevelMetric } from './painLevel';
export { painMobilityMetric } from './painMobility';
export { painMoodMetric } from './painMood';
export { painSleepMetric } from './painSleep';
export { suicidalityMetric } from './suicidality';
export { peakCoughFlowMetric } from './peakCoughFlow';
export { sialorrheaMetric } from './sialorrhea';
export { speechRateMetric } from './speechRate';
export { swallowingTimeMetric } from './swallowingTime';
export { tdeeMetric } from './tdee';
export { walkingDistanceMetric } from './walkingDistance';
export { stepCountMetric } from './stepCount';
export { walkingSteadinessMetric } from './walkingSteadiness';
export { respiratoryRateMetric } from './respiratoryRate';
export { flightsClimbedMetric } from './flightsClimbed';
export { walkingSpeedMetric } from './walkingSpeed';
export { walkingStepLengthMetric } from './walkingStepLength';
export { walkingAsymmetryMetric } from './walkingAsymmetry';
export { walkingDoubleSupportMetric } from './walkingDoubleSupport';
export { stairDescentSpeedMetric } from './stairDescentSpeed';
export { hrvSdnnMetric } from './hrv';
export { hrvRmssdMetric } from './hrvRmssd';
export { activeEnergyMetric } from './activeEnergy';
export { weightMetric } from './weight';
