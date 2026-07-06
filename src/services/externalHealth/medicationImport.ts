import type {
    MedicationForm,
    MedicationItem,
    MedicationUnit,
    MedicationSchedule,
} from '../../medications/types';

const SOURCE_LABEL = 'Apple Health';
const MEDICATION_SCHEDULE_TYPE_SCHEDULE = 2;
const MEDICATION_LOOKBACK_DAYS_FOR_PLANNING = 60;
const MAX_MEDICATION_EVENTS_FOR_PLANNING = 1000;

export type AppleHealthMedicationRecord = {
    isArchived: boolean;
    hasSchedule: boolean;
    nickname?: string;
    medication: {
        identifier: string;
        displayText: string;
        generalForm: string;
        relatedCodings?: Array<{
            system: string;
            code: string;
            version?: string;
        }>;
    };
};

export type AppleHealthMedicationDoseEventRecord = {
    medicationConceptIdentifier: string;
    scheduledDate?: Date | string;
    scheduledDoseQuantity?: number;
    doseQuantity?: number;
    scheduleType: number;
    unit?: string;
};

export type AppleHealthMedicationImportCandidate = {
    sourceId: string;
    name: string;
    form: MedicationForm;
    hasSchedule: boolean;
    schedule: MedicationSchedule;
    dosageText?: string;
    matchedMedicationId?: string;
    matchReason?: 'external_id' | 'name_form';
    draft: Partial<MedicationItem>;
};

export type AppleHealthMedicationImportPreview = {
    totalRead: number;
    archivedCount: number;
    newItems: AppleHealthMedicationImportCandidate[];
    existingItems: AppleHealthMedicationImportCandidate[];
    ambiguousItems: AppleHealthMedicationImportCandidate[];
};

export async function buildAppleHealthMedicationImportPreview(
    existingMedications: MedicationItem[],
    now = new Date()
): Promise<AppleHealthMedicationImportPreview> {
    const Device = await import('expo-device');
    if (!Device.isDevice) {
        throw new Error('medication_import_not_available');
    }

    const healthkit = await import('@kingstinct/react-native-healthkit');
    if (!healthkit.isHealthDataAvailable()) {
        throw new Error('medication_import_not_available');
    }

    try {
        await requestMedicationAuthorization(healthkit);
    } catch {
        throw new Error('medication_import_permissions_required');
    }

    const medications = (await healthkit.queryMedications()) as readonly AppleHealthMedicationRecord[];
    const events = await queryMedicationPlanningEvents(healthkit, now);
    return buildAppleHealthMedicationImportPreviewFromRecords(existingMedications, medications, events, now);
}

export function buildAppleHealthMedicationImportPreviewFromRecords(
    existingMedications: MedicationItem[],
    medications: readonly AppleHealthMedicationRecord[],
    events: readonly AppleHealthMedicationDoseEventRecord[],
    now = new Date()
): AppleHealthMedicationImportPreview {
    const eventsByMedicationId = groupMedicationEventsByMedicationId(events);
    const preview: AppleHealthMedicationImportPreview = {
        totalRead: medications.length,
        archivedCount: 0,
        newItems: [],
        existingItems: [],
        ambiguousItems: [],
    };

    for (const medication of medications) {
        if (medication.isArchived) {
            preview.archivedCount += 1;
            continue;
        }

        const candidate = buildMedicationCandidate(
            medication,
            eventsByMedicationId.get(medication.medication.identifier) ?? [],
            now
        );
        const match = findExistingMedicationMatch(candidate, existingMedications);

        if (match.kind === 'existing') {
            preview.existingItems.push({
                ...candidate,
                matchedMedicationId: match.medication.id,
                matchReason: match.reason,
            });
            continue;
        }

        if (match.kind === 'ambiguous') {
            preview.ambiguousItems.push(candidate);
            continue;
        }

        preview.newItems.push(candidate);
    }

    preview.newItems.sort(sortCandidateByName);
    preview.existingItems.sort(sortCandidateByName);
    preview.ambiguousItems.sort(sortCandidateByName);
    return preview;
}

export function getAppleHealthMedicationImportSelectionDefaults(
    preview: AppleHealthMedicationImportPreview
): string[] {
    return preview.newItems.map((item) => item.sourceId);
}

function buildMedicationCandidate(
    medication: AppleHealthMedicationRecord,
    events: readonly AppleHealthMedicationDoseEventRecord[],
    now: Date
): AppleHealthMedicationImportCandidate {
    const sourceId = medication.medication.identifier;
    const displayText = normalizeMedicationName(medication.medication.displayText);
    const strength = extractMedicationStrength(displayText);
    const name = normalizeMedicationName(medication.nickname)
        || stripMedicationStrengthFromName(displayText, strength)
        || displayText
        || 'Medication';
    const form = mapMedicationForm(medication.medication.generalForm);
    const schedule = buildSchedule(medication.hasSchedule, events);
    const dosageText = buildDosageText(events);
    const importedAt = now.toISOString();

    return {
        sourceId,
        name,
        form,
        hasSchedule: medication.hasSchedule,
        schedule,
        dosageText,
        draft: {
            name,
            form,
            strengthValue: strength?.value,
            strengthUnit: strength?.unit,
            dosageText,
            schedule,
            duration: {
                startDate: importedAt,
            },
            isActive: true,
            externalHealth: {
                platform: 'apple_health',
                sourceId,
                sourceLabel: SOURCE_LABEL,
                importedAt,
            },
        },
    };
}

function buildSchedule(
    hasSchedule: boolean,
    events: readonly AppleHealthMedicationDoseEventRecord[]
): MedicationSchedule {
    if (!hasSchedule) {
        return { type: 'as_needed', times: [] };
    }

    const scheduledTimes = Array.from(
        new Set(
            events
                .filter((event) => event.scheduleType === MEDICATION_SCHEDULE_TYPE_SCHEDULE)
                .map((event) => toDate(event.scheduledDate))
                .filter((date): date is Date => Boolean(date))
                .map((date) => toLocalTime(date))
        )
    ).sort((a, b) => a.localeCompare(b));

    if (scheduledTimes.length === 0) {
        return { type: 'as_needed', times: [] };
    }

    return {
        type: 'daily',
        times: scheduledTimes,
    };
}

function buildDosageText(events: readonly AppleHealthMedicationDoseEventRecord[]): string | undefined {
    for (const event of events) {
        const quantity = event.scheduledDoseQuantity ?? event.doseQuantity;
        if (quantity === undefined || !Number.isFinite(quantity)) {
            continue;
        }

        const unit = normalizeDoseUnit(event.unit);
        if (unit === 'count') {
            return `${formatDoseQuantity(quantity)}x`;
        }

        if (!unit) {
            continue;
        }

        return `${formatDoseQuantity(quantity)} ${unit}`;
    }

    return undefined;
}

function normalizeDoseUnit(unit: string | undefined): string | undefined {
    if (!unit) return undefined;
    const trimmed = unit.trim();
    if (!trimmed) return undefined;
    return trimmed;
}

function formatDoseQuantity(quantity: number): string {
    return Number.isInteger(quantity) ? String(quantity) : String(Number(quantity.toFixed(2)));
}

type ExtractedMedicationStrength = {
    value: number;
    unit: MedicationUnit;
    matchText: string;
};

const EXPLICIT_STRENGTH_PATTERN = /(\d+(?:[.,]\d+)*)\s*(mg|mcg|\u00b5g|ug|g|ml)\b/gi;

function extractMedicationStrength(text: string): ExtractedMedicationStrength | undefined {
    const matches = Array.from(text.matchAll(EXPLICIT_STRENGTH_PATTERN));
    if (matches.length !== 1) {
        return undefined;
    }

    const match = matches[0];
    const value = parseMedicationStrengthNumber(match[1]);
    const unit = normalizeMedicationStrengthUnit(match[2]);
    if (value === undefined || !unit) {
        return undefined;
    }

    return {
        value,
        unit,
        matchText: match[0],
    };
}

function parseMedicationStrengthNumber(raw: string): number | undefined {
    const compact = raw.replace(/\s+/g, '');
    if (!compact) {
        return undefined;
    }

    let normalized = compact;
    if (compact.includes(',') && compact.includes('.')) {
        normalized = compact.lastIndexOf(',') > compact.lastIndexOf('.')
            ? compact.replace(/\./g, '').replace(',', '.')
            : compact.replace(/,/g, '');
    } else if (compact.includes(',')) {
        normalized = compact.replace(',', '.');
    } else if (/^\d{1,3}(?:\.\d{3})+$/.test(compact)) {
        normalized = compact.replace(/\./g, '');
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeMedicationStrengthUnit(raw: string): MedicationUnit | undefined {
    const unit = raw.trim().toLocaleLowerCase().replace('\u00b5', 'u');
    switch (unit) {
        case 'mg':
        case 'g':
        case 'ml':
            return unit;
        case 'mcg':
        case 'ug':
            return 'mcg';
        default:
            return undefined;
    }
}

function stripMedicationStrengthFromName(
    text: string,
    strength: ExtractedMedicationStrength | undefined
): string {
    if (!strength) {
        return text;
    }

    return text
        .replace(new RegExp(`\\s*[-\\u2013\\u2014,(/]*\\s*${escapeRegExp(strength.matchText)}\\s*[)\\]]?\\s*$`, 'i'), '')
        .replace(/\s+/g, ' ')
        .trim();
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mapMedicationForm(form: string | undefined): MedicationForm {
    switch (form) {
        case 'capsule':
        case 'cream':
        case 'device':
        case 'drops':
        case 'foam':
        case 'gel':
        case 'inhaler':
        case 'injection':
        case 'liquid':
        case 'lotion':
        case 'ointment':
        case 'patch':
        case 'powder':
        case 'spray':
        case 'suppository':
        case 'tablet':
        case 'topical':
            return form;
        default:
            return 'tablet';
    }
}

async function requestMedicationAuthorization(
    healthkit: typeof import('@kingstinct/react-native-healthkit')
): Promise<void> {
    // The generic per-object bridge in @kingstinct/react-native-healthkit@14.0.2
    // currently maps the medication identifier incorrectly. The medication-specific
    // helper calls HKObjectType.userAnnotatedMedicationType() directly.
    await healthkit.requestMedicationsAuthorization();
}

async function queryMedicationPlanningEvents(
    healthkit: typeof import('@kingstinct/react-native-healthkit'),
    now: Date
): Promise<readonly AppleHealthMedicationDoseEventRecord[]> {
    try {
        const startDate = new Date(now.getTime() - MEDICATION_LOOKBACK_DAYS_FOR_PLANNING * 24 * 60 * 60 * 1000);
        const events = await healthkit.queryMedicationEvents({
            limit: MAX_MEDICATION_EVENTS_FOR_PLANNING,
            ascending: false,
            filter: {
                date: {
                    startDate,
                },
            },
        } as any);
        return events as readonly AppleHealthMedicationDoseEventRecord[];
    } catch {
        return [];
    }
}

function groupMedicationEventsByMedicationId(
    events: readonly AppleHealthMedicationDoseEventRecord[]
): Map<string, readonly AppleHealthMedicationDoseEventRecord[]> {
    const result = new Map<string, AppleHealthMedicationDoseEventRecord[]>();
    for (const event of events) {
        if (!event.medicationConceptIdentifier) continue;
        const current = result.get(event.medicationConceptIdentifier) ?? [];
        current.push(event);
        result.set(event.medicationConceptIdentifier, current);
    }
    return result;
}

function findExistingMedicationMatch(
    candidate: AppleHealthMedicationImportCandidate,
    existingMedications: MedicationItem[]
):
    | { kind: 'none' }
    | { kind: 'ambiguous' }
    | { kind: 'existing'; medication: MedicationItem; reason: 'external_id' | 'name_form' } {
    const externalMatch = existingMedications.find(
        (medication) =>
            medication.externalHealth?.platform === 'apple_health' &&
            medication.externalHealth.sourceId === candidate.sourceId
    );
    if (externalMatch) {
        return { kind: 'existing', medication: externalMatch, reason: 'external_id' };
    }

    const normalizedCandidateName = normalizeForMatch(candidate.name);
    const nameMatches = existingMedications.filter(
        (medication) =>
            normalizeForMatch(medication.name) === normalizedCandidateName &&
            medication.form === candidate.form
    );

    if (nameMatches.length === 1) {
        return { kind: 'existing', medication: nameMatches[0], reason: 'name_form' };
    }

    if (nameMatches.length > 1) {
        return { kind: 'ambiguous' };
    }

    return { kind: 'none' };
}

function normalizeMedicationName(value: string | undefined): string {
    return value?.replace(/\s+/g, ' ').trim() ?? '';
}

function normalizeForMatch(value: string): string {
    return normalizeMedicationName(value).toLocaleLowerCase();
}

function toDate(value: Date | string | undefined): Date | null {
    if (value instanceof Date) return value;
    if (typeof value === 'string') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
}

function toLocalTime(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

function sortCandidateByName(
    a: AppleHealthMedicationImportCandidate,
    b: AppleHealthMedicationImportCandidate
): number {
    return a.name.localeCompare(b.name);
}
