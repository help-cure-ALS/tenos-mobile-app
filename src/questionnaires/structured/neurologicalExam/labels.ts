import { structuredOptionLabel } from '@/src/questionnaires/structured/structuredFieldLabels';

import type {
    BodyRegion,
    BulbarSignName,
    ClinicalRegion,
    FindingSeverity,
    MrcGrade,
    MrcMuscleGroup,
    NeurologicalExamEntry,
    PathologicalSignName,
    ReflexGrade,
    ReflexName,
    SignPresence,
    LmnSignName,
} from './types';

const QUESTIONNAIRE_ID = 'als_neurological_exam';

export function regionLabel(region: BodyRegion, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'bodyRegion', region, language);
}

export function clinicalRegionLabel(region: ClinicalRegion, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'clinicalRegion', region, language);
}

export function severityLabel(severity?: FindingSeverity, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'findingSeverity', severity, language);
}

export function signPresenceLabel(value?: SignPresence, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'signPresence', value, language);
}

export function mrcGradeLabel(value?: MrcGrade, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'mrcGrade', value, language);
}

export function mrcMuscleGroupLabel(value: MrcMuscleGroup, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'mrcMuscleGroup', value, language);
}

export function reflexGradeLabel(value?: ReflexGrade, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'reflexGrade', value, language);
}

export function reflexNameLabel(value: ReflexName, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'reflexName', value, language);
}

export function pathologicalSignLabel(value: PathologicalSignName, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'pathologicalSignName', value, language);
}

export function lmnSignLabel(value: LmnSignName, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'lmnSignName', value, language);
}

export function bulbarSignLabel(value: BulbarSignName, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'bulbarSignName', value, language);
}

export function burdenLabel(value: string | undefined, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'burden', value, language);
}

export function summarizeNeurologicalExam(entry: NeurologicalExamEntry, language?: string): string {
    const de = language === 'de';
    if (entry.summary?.trim()) return entry.summary.trim();

    const affectedClinicalRegions = entry.clinicalRegions
        ?.filter((region) => isSeverityAffected(region.umnBurden) || isSeverityAffected(region.lmnBurden))
        .map((region) => clinicalRegionLabel(region.region, language));

    const affected = (affectedClinicalRegions && affectedClinicalRegions.length > 0 ? affectedClinicalRegions : entry.regions
        .filter((region) => {
            const umn = Object.values(region.umnSigns ?? {}).some(isSeverityAffected);
            const lmn = Object.values(region.lmnSigns ?? {}).some(isSeverityAffected);
            return umn || lmn;
        })
        .map((region) => regionLabel(region.region, language)));

    const regionText = affected.length > 0
        ? affected.slice(0, 2).join(', ')
        : (de ? 'kein fokaler Schwerpunkt' : 'no focal emphasis');

    const lmn = entry.overallLmnBurden && entry.overallLmnBurden !== 'none'
        ? `LMN ${burdenLabel(entry.overallLmnBurden, language)}`
        : null;
    const umn = entry.overallUmnBurden && entry.overallUmnBurden !== 'none'
        ? `UMN ${burdenLabel(entry.overallUmnBurden, language)}`
        : null;

    return [regionText, umn, lmn].filter(Boolean).join(' · ');
}

function isSeverityAffected(value: FindingSeverity | undefined): boolean {
    return value !== undefined && value !== 'absent' && value !== 'not_tested';
}
