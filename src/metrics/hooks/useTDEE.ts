/**
 * useTDEE Hook
 *
 * Calculates Total Daily Energy Expenditure (TDEE) for ALS patients
 * using the Kasarskis formula (2014).
 *
 * The calculation uses:
 * - Patient data: weight, height, age, gender
 * - ALSFRS-6 score for activity factor adjustment
 *
 * ALSFRS-6 consists of 6 questions from ALSFRS-R:
 * - swallowing (Q3), handwriting (Q4), dressing (Q6)
 * - turning_in_bed (Q7), walking (Q8), dyspnea (Q10)
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFhirRepo } from '@/src/hooks/useFhirRepo';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useQuestionnaire } from '@/src/questionnaires';
import { useMetric } from './useMetric';
import { on } from '@/src/lib/bus';

// ALSFRS-6 question IDs (subset of ALSFRS-R)
const ALSFRS6_QUESTION_IDS = [
    'swallowing',      // Q3
    'handwriting',     // Q4
    'dressing',        // Q6
    'turning_in_bed',  // Q7
    'walking',         // Q8
    'dyspnea',         // Q10
] as const;

const ALSFRS6_MAX_SCORE = 24; // 6 questions × 4 points each

// Extension URL for patient height (weight is now only stored as metric)
const HEIGHT_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/body-height-cm';

export type PatientData = {
    weightKg?: number;
    heightCm?: number;
    ageYears?: number;
    gender?: 'male' | 'female' | 'other' | 'unknown';
    /** Source of the weight data */
    weightSource?: 'metric' | 'profile';
};

export type ALSFRS6Data = {
    score: number;
    maxScore: number;
    questionScores: Record<string, number>;
    completedAt?: Date;
};

export type TDEEBreakdown = {
    bmr: number;
    activityFactor: number;
    alsAdjustment: number;
    tdee: number;
};

export type UseTDEEReturn = {
    /** Calculated daily calorie needs (kcal/day) */
    calories: number | undefined;

    /** Calculated daily water needs (L/day) */
    waterLiters: number | undefined;

    /** Breakdown of TDEE calculation */
    breakdown: TDEEBreakdown | undefined;

    /** Patient data used in calculation */
    patientData: PatientData;

    /** ALSFRS-6 data used in calculation */
    alsfrs6: ALSFRS6Data | undefined;

    /** Whether patient data is missing */
    missingPatientData: boolean;

    /** Which patient data fields are missing */
    missingFields: string[];

    /** Whether ALSFRS-R data is missing */
    missingALSFRS: boolean;

    /** Whether data is loading */
    isLoading: boolean;

    /** Reload data */
    reload: () => Promise<void>;
};

/**
 * Calculate BMR using Mifflin-St Jeor equation
 */
function calculateBMR(
    weightKg: number,
    heightCm: number,
    ageYears: number,
    gender: 'male' | 'female' | 'other' | 'unknown'
): number {
    // Base calculation
    const base = (10 * weightKg) + (6.25 * heightCm) - (5 * ageYears);

    // Gender adjustment
    if (gender === 'male') {
        return base + 5;
    } else if (gender === 'female') {
        return base - 161;
    } else {
        // For unknown/other, use average of male and female
        return base - 78;
    }
}

/**
 * Calculate activity factor based on ALSFRS-6 score
 * Lower scores indicate more disability, thus lower activity
 */
function calculateActivityFactor(alsfrs6Score: number): number {
    // Score ranges and corresponding activity factors
    // Based on functional capacity from ALSFRS-6
    if (alsfrs6Score >= 20) {
        // Near-normal function
        return 1.4;
    } else if (alsfrs6Score >= 15) {
        // Mild impairment
        return 1.3;
    } else if (alsfrs6Score >= 10) {
        // Moderate impairment
        return 1.2;
    } else if (alsfrs6Score >= 5) {
        // Severe impairment
        return 1.15;
    } else {
        // Very severe impairment / bedbound
        return 1.1;
    }
}

/**
 * ALS adjustment factor for hypermetabolism
 * ALS patients typically have 10-15% higher energy expenditure
 */
const ALS_HYPERMETABOLISM_FACTOR = 1.1; // 10% increase

/**
 * Calculate daily water needs based on body weight
 * Standard recommendation: 30-35 ml/kg
 */
function calculateWaterNeeds(weightKg: number): number {
    // Using 33 ml/kg as middle ground
    return (weightKg * 33) / 1000; // Convert to liters
}

/**
 * Calculate age from birth date
 */
function calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age;
}

/**
 * Hook for calculating TDEE for ALS patients
 */
export function useTDEE(): UseTDEEReturn {
    const { get } = useFhirRepo();
    const { getOrCreateSubjectId } = useAppSync();
    const { activePatientId, isDemo } = useAppRole();
    const { latestEntry: alsfrLatest, isLoading: alsfrLoading } = useQuestionnaire({ questionnaireId: 'alsfrs-r' });

    // Get latest weight from weight metric (preferred over profile weight)
    const { latestEntry: latestWeightEntry, isLoading: weightMetricLoading } = useMetric({ metricId: 'weight' });

    const [profileData, setProfileData] = useState<{
        heightCm?: number;
        ageYears?: number;
        gender?: PatientData['gender'];
    }>({});
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);

    // Load patient profile data (height, age, gender - weight is loaded from metric)
    const loadProfileData = useCallback(async () => {
        try {
            setIsLoadingProfile(true);
            // In demo mode, use activePatientId directly (matches demo Patient resource ID)
            const patientId = (isDemo && activePatientId) ? activePatientId : await getOrCreateSubjectId();
            const row = await get('Patient', patientId);

            if (!row?.resource) {
                setProfileData({});
                return;
            }

            const patient = row.resource as any;

            // Extract height from extension (weight is now only stored as metric)
            let heightCm: number | undefined;

            if (patient.extension) {
                for (const ext of patient.extension) {
                    if (ext.url === HEIGHT_EXTENSION_URL && ext.valueDecimal !== undefined) {
                        heightCm = ext.valueDecimal;
                    }
                }
            }

            // Extract birth date and calculate age
            let ageYears: number | undefined;
            if (patient.birthDate) {
                const birthDate = new Date(patient.birthDate);
                if (!isNaN(birthDate.getTime())) {
                    ageYears = calculateAge(birthDate);
                }
            }

            // Extract gender
            const gender = patient.gender as PatientData['gender'];

            setProfileData({
                heightCm,
                ageYears,
                gender,
            });
        } catch (error) {
            console.warn('Failed to load patient data for TDEE:', error);
            setProfileData({});
        } finally {
            setIsLoadingProfile(false);
        }
    }, [get, getOrCreateSubjectId, isDemo, activePatientId]);

    // Initial load
    useEffect(() => {
        loadProfileData();

        // Reload when patient data changes
        const off = on('fhir:changed', loadProfileData);
        return () => off();
    }, [loadProfileData]);

    // Combine profile data with weight from metric (single source of truth)
    const patientData = useMemo((): PatientData => {
        // Weight is only loaded from metric - no more profile fallback
        const weightKg = latestWeightEntry?.values?.value;

        return {
            weightKg,
            heightCm: profileData.heightCm,
            ageYears: profileData.ageYears,
            gender: profileData.gender,
            weightSource: weightKg !== undefined ? 'metric' : undefined,
        };
    }, [latestWeightEntry, profileData]);

    // Calculate ALSFRS-6 from ALSFRS-R answers
    const alsfrs6 = useMemo((): ALSFRS6Data | undefined => {
        if (!alsfrLatest?.answers) {
            return undefined;
        }

        const questionScores: Record<string, number> = {};
        let totalScore = 0;

        for (const questionId of ALSFRS6_QUESTION_IDS) {
            const score = alsfrLatest.answers[questionId];
            if (score !== undefined) {
                questionScores[questionId] = score;
                totalScore += score;
            }
        }

        // Check if we have all 6 questions answered
        if (Object.keys(questionScores).length !== 6) {
            return undefined;
        }

        return {
            score: totalScore,
            maxScore: ALSFRS6_MAX_SCORE,
            questionScores,
            completedAt: alsfrLatest.completedAt,
        };
    }, [alsfrLatest]);

    // Determine missing data
    const missingFields = useMemo(() => {
        const missing: string[] = [];
        if (patientData.weightKg === undefined) missing.push('Gewicht');
        if (patientData.heightCm === undefined) missing.push('Körpergröße');
        if (patientData.ageYears === undefined) missing.push('Geburtsdatum');
        if (!patientData.gender || patientData.gender === 'unknown') missing.push('Geschlecht');
        return missing;
    }, [patientData]);

    const missingPatientData = missingFields.length > 0;
    const missingALSFRS = !alsfrs6;

    // Calculate TDEE
    const { calories, waterLiters, breakdown } = useMemo(() => {
        // Need complete patient data
        if (
            patientData.weightKg === undefined ||
            patientData.heightCm === undefined ||
            patientData.ageYears === undefined ||
            !patientData.gender
        ) {
            return { calories: undefined, waterLiters: undefined, breakdown: undefined };
        }

        // Calculate BMR
        const bmr = calculateBMR(
            patientData.weightKg,
            patientData.heightCm,
            patientData.ageYears,
            patientData.gender
        );

        // Calculate activity factor
        // If no ALSFRS data, use conservative estimate (1.2)
        const activityFactor = alsfrs6
            ? calculateActivityFactor(alsfrs6.score)
            : 1.2;

        // Calculate TDEE
        const tdee = Math.round(bmr * activityFactor * ALS_HYPERMETABOLISM_FACTOR);

        // Calculate water needs
        const water = calculateWaterNeeds(patientData.weightKg);

        return {
            calories: tdee,
            waterLiters: Math.round(water * 10) / 10, // Round to 1 decimal
            breakdown: {
                bmr: Math.round(bmr),
                activityFactor,
                alsAdjustment: ALS_HYPERMETABOLISM_FACTOR,
                tdee,
            },
        };
    }, [patientData, alsfrs6]);

    const isLoading = isLoadingProfile || weightMetricLoading || alsfrLoading;

    const reload = useCallback(async () => {
        await loadProfileData();
    }, [loadProfileData]);

    return {
        calories,
        waterLiters,
        breakdown,
        patientData,
        alsfrs6,
        missingPatientData,
        missingFields,
        missingALSFRS,
        isLoading,
        reload,
    };
}

// Export constants for use in UI
export { ALSFRS6_QUESTION_IDS, ALSFRS6_MAX_SCORE };
