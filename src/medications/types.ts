
export type MedicationForm =
    | 'tablet'
    | 'capsule'
    | 'liquid'
    | 'topical'
    | 'cream'
    | 'gel'
    | 'device'
    | 'inhaler'
    | 'injection'
    | 'lotion'
    | 'patch'
    | 'powder'
    | 'ointment'
    | 'foam'
    | 'spray'
    | 'drops'
    | 'suppository';

/** Common medication forms (shown first) */
export const PRIMARY_FORM_KEYS: MedicationForm[] = ['capsule', 'tablet', 'liquid', 'topical'];

/** Additional medication forms (shown in "More" section) */
export const MORE_FORM_KEYS: MedicationForm[] = [
    'cream', 'gel', 'device', 'inhaler', 'injection',
    'lotion', 'patch', 'powder', 'ointment', 'foam',
    'spray', 'drops', 'suppository',
];

/** All medication forms combined */
export const ALL_FORM_KEYS: MedicationForm[] = [...PRIMARY_FORM_KEYS, ...MORE_FORM_KEYS];

export type MedicationUnit = 'mg' | 'mcg' | 'g' | 'ml' | 'drop' | 'tablet' | 'capsule' | 'other';

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type ScheduleType = 'daily' | 'weekly' | 'every_x_days' | 'cycle' | 'as_needed';

export type MedicationSchedule = {
    type: ScheduleType;
    times: string[];
    weekdays?: Weekday[];
    intervalDays?: number;
    cycleOnDays?: number;
    cycleOffDays?: number;
};

export type MedicationDuration = {
    startDate: string;
    endDate?: string;
};

export type MedicationItem = {
    id: string;
    name: string;
    form: MedicationForm;
    strengthValue?: number;
    strengthUnit?: MedicationUnit;
    dosageText?: string;
    schedule: MedicationSchedule;
    duration: MedicationDuration;
    notes?: string;
    createdAt: string;
    updatedAt: string;
    isActive: boolean;
    externalHealth?: {
        platform: 'apple_health' | 'health_connect';
        sourceId: string;
        sourceLabel: string;
        importedAt: string;
    };
};

export type MedicationDoseStatus = 'taken' | 'skipped';

export type MedicationDoseLog = {
    id: string;
    medicationId: string;
    status: MedicationDoseStatus;
    scheduledFor?: string;
    takenAt: string;
    notes?: string;
};

export type DayMedicationSlot = {
    time: string;
    medications: MedicationItem[];
};

export type MedicationSummary = {
    medication: MedicationItem;
    lastTakenAt: string | null;
    nextDueAt: string | null;
};

export function getMedicationFormLabel(form: MedicationForm): string {
    switch (form) {
        case 'tablet':
            return 'Tablette';
        case 'capsule':
            return 'Kapsel';
        case 'liquid':
            return 'Flüssigkeit';
        case 'topical':
            return 'Örtlich';
        case 'cream':
            return 'Creme';
        case 'gel':
            return 'Gel';
        case 'device':
            return 'Gerät';
        case 'inhaler':
            return 'Inhalator';
        case 'injection':
            return 'Injektion';
        case 'lotion':
            return 'Lotion';
        case 'patch':
            return 'Pflaster';
        case 'powder':
            return 'Pulver';
        case 'ointment':
            return 'Salbe';
        case 'foam':
            return 'Schaum';
        case 'spray':
            return 'Spray';
        case 'drops':
            return 'Tropfen';
        case 'suppository':
            return 'Zäpfchen';
        default:
            return String(form);
    }
}

export function getScheduleLabel(schedule: MedicationSchedule): string {
    switch (schedule.type) {
        case 'daily':
            return 'Täglich';
        case 'weekly':
            return 'An bestimmten Wochentagen';
        case 'every_x_days':
            return `Alle ${Math.max(1, schedule.intervalDays ?? 1)} Tage`;
        case 'cycle': {
            const on = Math.max(1, schedule.cycleOnDays ?? 1);
            const off = Math.max(1, schedule.cycleOffDays ?? 1);
            return `${on} Tage einnehmen, ${off} Tage Pause`;
        }
        case 'as_needed':
            return 'Bei Bedarf';
        default:
            return 'Unbekannt';
    }
}

export function formatMedicationStrength(item: MedicationItem): string {
    if (item.strengthValue === undefined || !item.strengthUnit) {
        return '-';
    }
    return `${item.strengthValue} ${item.strengthUnit}`;
}

export function parseMedicationStrengthInput(value: string): number | undefined {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) {
        return undefined;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
}

/** Get SF Symbol name based on medication form */
export function getMedicationFormIcon(form?: MedicationForm): string {
    switch (form) {
        case 'tablet':
            return 'pills.fill';
        case 'capsule':
            return 'capsule.fill';
        case 'drops':
            return 'drop.fill';
        case 'liquid':
            return 'cup.and.saucer.fill';
        case 'injection':
            return 'syringe.fill';
        case 'inhaler':
            return 'lungs.fill';
        case 'cream':
        case 'ointment':
        case 'patch':
            return 'bandage.fill';
        case 'powder':
            return 'cross.vial.fill';
        case 'spray':
            return 'wind';
        case 'suppository':
            return 'pills.fill';
        case 'lotion':
        case 'gel':
        case 'topical':
        case 'foam':
        case 'device':
        default:
            return 'pills.fill';
    }
}
