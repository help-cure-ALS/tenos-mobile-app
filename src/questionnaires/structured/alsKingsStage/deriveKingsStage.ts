import type { AidItem } from '@/src/aids/types';
import type { BodyRegion, FindingSeverity, NeurologicalExamEntry, RegionMotorNeuronFindings } from '@/src/questionnaires/structured/neurologicalExam/types';

import type {
    ALSKingsStage4Reason,
    ALSKingsStageEntry,
    ALSKingsStageRegion,
    ALSKingsStageSource,
    ALSKingsStageValue,
} from './types';

export type ALSKingsStageDerivationBasis = {
    neurologicalExamIds: string[];
    aidIds: string[];
};

export type ALSKingsStageDerivedEntry = ALSKingsStageEntry & {
    isCalculated: true;
    derivedFrom: ALSKingsStageDerivationBasis;
};

type DeriveInput = {
    neurologicalExams?: NeurologicalExamEntry[];
    aids?: AidItem[];
    now?: Date;
};

const RELEVANT_AID_STATUSES = new Set(['requested', 'approved']);
const NIV_CATALOG_IDS = new Set(['ATM-001', 'ATM-003']);
const PEG_CATALOG_IDS = new Set(['ERN-006']);

export function deriveALSKingsStage({
    neurologicalExams = [],
    aids = [],
    now = new Date(),
}: DeriveInput): ALSKingsStageDerivedEntry | null {
    const stage4 = deriveStage4FromAids(aids);
    if (stage4) {
        return buildDerivedEntry({
            assessedAt: stage4.assessedAt,
            stage: stage4.stage,
            source: 'suggested_from_care',
            affectedRegions: deriveAffectedRegionsFromExams(neurologicalExams).regions,
            stage4Reason: stage4.reason,
            neurologicalExamIds: [],
            aidIds: stage4.aidIds,
            note: stage4.note,
        });
    }

    const affected = deriveAffectedRegionsFromExams(neurologicalExams);
    if (affected.regions.length === 0) {
        return null;
    }

    return buildDerivedEntry({
        assessedAt: affected.latestAssessedAt ?? now.toISOString(),
        stage: stageFromRegionCount(affected.regions.length),
        source: 'suggested_from_exam',
        affectedRegions: affected.regions,
        neurologicalExamIds: affected.examIds,
        aidIds: [],
    });
}

export function isDerivedALSKingsStageEntry(
    entry: ALSKingsStageEntry | ALSKingsStageDerivedEntry | null | undefined
): entry is ALSKingsStageDerivedEntry {
    return !!entry && 'isCalculated' in entry && entry.isCalculated === true;
}

export function deriveAffectedRegionsFromExams(exams: NeurologicalExamEntry[]): {
    regions: ALSKingsStageRegion[];
    examIds: string[];
    latestAssessedAt?: string;
} {
    const regions = new Set<ALSKingsStageRegion>();
    const examIds = new Set<string>();
    let latestAssessedAt: string | undefined;

    for (const exam of exams) {
        let examContributed = false;
        for (const region of exam.regions) {
            if (!isRegionAffected(region)) continue;
            const kingsRegion = bodyRegionToKingsRegion(region.region);
            regions.add(kingsRegion);
            examContributed = true;
        }

        if (examContributed) {
            examIds.add(exam.id);
            if (!latestAssessedAt || new Date(exam.assessedAt).getTime() > new Date(latestAssessedAt).getTime()) {
                latestAssessedAt = exam.assessedAt;
            }
        }
    }

    return {
        regions: sortKingsRegions(Array.from(regions)),
        examIds: Array.from(examIds),
        latestAssessedAt,
    };
}

function deriveStage4FromAids(aids: AidItem[]): {
    stage: ALSKingsStageValue;
    reason: ALSKingsStage4Reason;
    aidIds: string[];
    assessedAt: string;
    note?: string;
} | null {
    const relevant = aids.filter((aid) => RELEVANT_AID_STATUSES.has(aid.status));
    const nutrition = relevant.filter(isGastrostomyAid);
    const respiratory = relevant.filter(isVentilationAid);

    if (nutrition.length === 0 && respiratory.length === 0) {
        return null;
    }

    const aidIds = [...nutrition, ...respiratory].map((aid) => aid.id);
    const latest = [...nutrition, ...respiratory]
        .map((aid) => aid.updatedAt || aid.createdAt)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

    if (nutrition.length > 0 && respiratory.length > 0) {
        return {
            stage: '4',
            reason: 'both',
            aidIds,
            assessedAt: latest,
        };
    }

    if (nutrition.length > 0) {
        return {
            stage: '4A',
            reason: 'nutrition',
            aidIds,
            assessedAt: latest,
        };
    }

    return {
        stage: '4B',
        reason: 'respiratory',
        aidIds,
        assessedAt: latest,
    };
}

function isRegionAffected(region: RegionMotorNeuronFindings): boolean {
    return hasFinding(region.umnSigns) || hasFinding(region.lmnSigns);
}

function hasFinding(findings: Record<string, FindingSeverity | undefined>): boolean {
    return Object.values(findings).some((value) => value !== undefined && value !== 'absent' && value !== 'not_tested');
}

function bodyRegionToKingsRegion(region: BodyRegion): ALSKingsStageRegion {
    switch (region) {
        case 'head':
            return 'bulbar';
        case 'right_arm':
        case 'left_arm':
            return 'upper_limb';
        case 'right_leg':
        case 'left_leg':
            return 'lower_limb';
        case 'trunk':
            return 'thoracic';
    }
}

function stageFromRegionCount(regionCount: number): ALSKingsStageValue {
    if (regionCount <= 1) return '1';
    if (regionCount === 2) return '2';
    return '3';
}

function sortKingsRegions(regions: ALSKingsStageRegion[]): ALSKingsStageRegion[] {
    const order: ALSKingsStageRegion[] = ['bulbar', 'upper_limb', 'lower_limb', 'thoracic'];
    return [...regions].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

function isGastrostomyAid(aid: AidItem): boolean {
    if (aid.catalogId && PEG_CATALOG_IDS.has(aid.catalogId)) return true;
    const haystack = `${aid.name} ${aid.notes ?? ''}`.toLowerCase();
    return haystack.includes('peg') || haystack.includes('gastrostom') || haystack.includes('feeding tube');
}

function isVentilationAid(aid: AidItem): boolean {
    if (aid.catalogId && NIV_CATALOG_IDS.has(aid.catalogId)) return true;
    const haystack = `${aid.name} ${aid.notes ?? ''}`.toLowerCase();
    return haystack.includes('niv') || haystack.includes('bipap') || haystack.includes('cpap') || haystack.includes('non-invasive ventil');
}

function buildDerivedEntry({
    assessedAt,
    stage,
    source,
    affectedRegions,
    stage4Reason,
    neurologicalExamIds,
    aidIds,
    note,
}: {
    assessedAt: string;
    stage: ALSKingsStageValue;
    source: ALSKingsStageSource;
    affectedRegions?: ALSKingsStageRegion[];
    stage4Reason?: ALSKingsStage4Reason;
    neurologicalExamIds: string[];
    aidIds: string[];
    note?: string;
}): ALSKingsStageDerivedEntry {
    return {
        id: 'calculated-current-kings-stage',
        schemaVersion: 'als-kings-stage-v1',
        assessedAt,
        recordedByRole: 'doctor',
        stage,
        source,
        affectedRegions: affectedRegions?.length ? affectedRegions : undefined,
        stage4Reason,
        note,
        isCalculated: true,
        derivedFrom: {
            neurologicalExamIds,
            aidIds,
        },
    };
}
