import * as Crypto from 'expo-crypto';
import type {
    MedicationDoseLog,
    MedicationDoseStatus,
    MedicationDuration,
    MedicationForm,
    MedicationItem,
    MedicationSchedule,
    MedicationUnit,
    Weekday,
} from '../types';

const MEDICATION_META_URL = 'urn:medical-sync-vault:medication-meta';
const SCHEDULE_META_URL = 'urn:medical-sync-vault:medication-schedule';
const DOSE_LOG_META_URL = 'urn:medical-sync-vault:medication-dose-log';

type FhirExtension = {
    url: string;
    valueString?: string;
    valueCode?: string;
    valueDateTime?: string;
    valueInteger?: number;
};

type FhirMedicationStatement = {
    resourceType: 'MedicationStatement';
    id: string;
    status: 'active' | 'completed' | 'entered-in-error' | 'intended' | 'stopped';
    medicationCodeableConcept: {
        text: string;
    };
    effectivePeriod?: {
        start?: string;
        end?: string;
    };
    dosage?: Array<{
        text?: string;
        timing?: {
            repeat?: {
                timeOfDay?: string[];
            };
        };
        doseAndRate?: Array<{
            doseQuantity?: {
                value?: number;
                unit?: string;
            };
        }>;
    }>;
    meta?: {
        lastUpdated?: string;
        extension?: FhirExtension[];
    };
    note?: Array<{ text: string }>;
};

type FhirMedicationAdministration = {
    resourceType: 'MedicationAdministration';
    id: string;
    status: 'completed' | 'not-done';
    medicationReference?: {
        reference: string;
    };
    effectiveDateTime?: string;
    note?: Array<{ text: string }>;
    meta?: {
        lastUpdated?: string;
        extension?: FhirExtension[];
    };
};

type MedicationMetaPayload = {
    id: string;
    name: string;
    form: MedicationForm;
    strengthValue?: number;
    strengthUnit?: MedicationUnit;
    dosageText?: string;
    duration: MedicationDuration;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    externalHealth?: MedicationItem['externalHealth'];
};

type ScheduleMetaPayload = MedicationSchedule;

type DoseLogMetaPayload = {
    medicationId: string;
    status: MedicationDoseStatus;
    scheduledFor?: string;
};

function parseJson<T>(value?: string): T | null {
    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}

function getExtension(resource: { meta?: { extension?: FhirExtension[] } }, url: string): FhirExtension | null {
    const ext = resource.meta?.extension?.find((x) => x.url === url);
    return ext ?? null;
}

export function medicationToFhir(medication: MedicationItem): FhirMedicationStatement {
    const metaPayload: MedicationMetaPayload = {
        id: medication.id,
        name: medication.name,
        form: medication.form,
        strengthValue: medication.strengthValue,
        strengthUnit: medication.strengthUnit,
        dosageText: medication.dosageText,
        duration: medication.duration,
        isActive: medication.isActive,
        createdAt: medication.createdAt,
        updatedAt: medication.updatedAt,
        externalHealth: medication.externalHealth,
    };

    const schedulePayload: ScheduleMetaPayload = medication.schedule;

    const doseQuantity =
        medication.strengthValue !== undefined && medication.strengthUnit
            ? {
                  value: medication.strengthValue,
                  unit: medication.strengthUnit,
              }
            : undefined;

    return {
        resourceType: 'MedicationStatement',
        id: medication.id,
        status: medication.isActive ? 'active' : 'stopped',
        medicationCodeableConcept: {
            text: medication.name,
        },
        effectivePeriod: {
            start: medication.duration.startDate,
            end: medication.duration.endDate,
        },
        dosage: [
            {
                text: medication.dosageText,
                timing: {
                    repeat: {
                        timeOfDay: medication.schedule.times,
                    },
                },
                doseAndRate: [
                    {
                        doseQuantity,
                    },
                ],
            },
        ],
        note: medication.notes ? [{ text: medication.notes }] : undefined,
        meta: {
            lastUpdated: medication.updatedAt,
            extension: [
                {
                    url: MEDICATION_META_URL,
                    valueString: JSON.stringify(metaPayload),
                },
                {
                    url: SCHEDULE_META_URL,
                    valueString: JSON.stringify(schedulePayload),
                },
            ],
        },
    };
}

export function fhirToMedication(resource: unknown): MedicationItem | null {
    const r = resource as FhirMedicationStatement;
    if (!r || r.resourceType !== 'MedicationStatement' || !r.id) {
        return null;
    }

    const metaExt = getExtension(r, MEDICATION_META_URL);
    const scheduleExt = getExtension(r, SCHEDULE_META_URL);

    const metaPayload = parseJson<MedicationMetaPayload>(metaExt?.valueString);
    const schedulePayload = parseJson<ScheduleMetaPayload>(scheduleExt?.valueString);

    const fallbackSchedule: MedicationSchedule = {
        type: 'daily',
        times: r.dosage?.[0]?.timing?.repeat?.timeOfDay ?? [],
    };

    const fallbackCreatedAt = r.meta?.lastUpdated ?? new Date().toISOString();

    return {
        id: r.id,
        name: metaPayload?.name ?? r.medicationCodeableConcept?.text ?? 'Unbenannt',
        form: metaPayload?.form ?? 'tablet',
        strengthValue: metaPayload?.strengthValue,
        strengthUnit: metaPayload?.strengthUnit,
        dosageText: metaPayload?.dosageText ?? r.dosage?.[0]?.text,
        schedule: normalizeSchedule(schedulePayload ?? fallbackSchedule),
        duration: metaPayload?.duration ?? {
            startDate: r.effectivePeriod?.start ?? fallbackCreatedAt,
            endDate: r.effectivePeriod?.end,
        },
        notes: r.note?.[0]?.text,
        createdAt: metaPayload?.createdAt ?? fallbackCreatedAt,
        updatedAt: metaPayload?.updatedAt ?? r.meta?.lastUpdated ?? fallbackCreatedAt,
        isActive: metaPayload?.isActive ?? r.status === 'active',
        externalHealth: metaPayload?.externalHealth,
    };
}

export function medicationDoseLogToFhir(log: MedicationDoseLog): FhirMedicationAdministration {
    const metaPayload: DoseLogMetaPayload = {
        medicationId: log.medicationId,
        status: log.status,
        scheduledFor: log.scheduledFor,
    };

    return {
        resourceType: 'MedicationAdministration',
        id: log.id,
        status: log.status === 'taken' ? 'completed' : 'not-done',
        medicationReference: {
            reference: `MedicationStatement/${log.medicationId}`,
        },
        effectiveDateTime: log.takenAt,
        note: log.notes ? [{ text: log.notes }] : undefined,
        meta: {
            lastUpdated: log.takenAt,
            extension: [
                {
                    url: DOSE_LOG_META_URL,
                    valueString: JSON.stringify(metaPayload),
                },
            ],
        },
    };
}

export function fhirToMedicationDoseLog(resource: unknown): MedicationDoseLog | null {
    const r = resource as FhirMedicationAdministration;
    if (!r || r.resourceType !== 'MedicationAdministration' || !r.id) {
        return null;
    }

    const ext = getExtension(r, DOSE_LOG_META_URL);
    const metaPayload = parseJson<DoseLogMetaPayload>(ext?.valueString);

    const medicationRef = r.medicationReference?.reference ?? '';
    const medIdFromRef = medicationRef.startsWith('MedicationStatement/')
        ? medicationRef.replace('MedicationStatement/', '')
        : medicationRef;

    const takenAt = r.effectiveDateTime ?? r.meta?.lastUpdated ?? new Date().toISOString();

    return {
        id: r.id,
        medicationId: metaPayload?.medicationId ?? medIdFromRef,
        status: metaPayload?.status ?? (r.status === 'completed' ? 'taken' : 'skipped'),
        scheduledFor: metaPayload?.scheduledFor,
        takenAt,
        notes: r.note?.[0]?.text,
    };
}

export function createMedicationDraft(input: Partial<MedicationItem>): MedicationItem {
    const now = new Date().toISOString();
    const id = input.id ?? Crypto.randomUUID();

    return {
        id,
        name: input.name ?? '',
        form: input.form ?? 'tablet',
        strengthValue: input.strengthValue,
        strengthUnit: input.strengthUnit,
        dosageText: input.dosageText,
        schedule: normalizeSchedule(input.schedule),
        duration: {
            startDate: input.duration?.startDate ?? now,
            endDate: input.duration?.endDate,
        },
        notes: input.notes,
        createdAt: input.createdAt ?? now,
        updatedAt: input.updatedAt ?? now,
        isActive: input.isActive ?? true,
        externalHealth: input.externalHealth,
    };
}

export function normalizeSchedule(schedule?: Partial<MedicationSchedule> | null): MedicationSchedule {
    const type = schedule?.type ?? 'daily';
    const rawTimes = schedule?.times ?? [];
    const deduped = new Set(rawTimes.filter(Boolean));
    const times = Array.from(deduped).sort((a, b) => a.localeCompare(b));

    const base: MedicationSchedule = {
        type,
        times,
    };

    if (type === 'weekly') {
        base.weekdays = normalizeWeekdays(schedule?.weekdays);
    }

    if (type === 'every_x_days') {
        base.intervalDays = Math.max(1, Number(schedule?.intervalDays ?? 1));
    }

    if (type === 'cycle') {
        base.cycleOnDays = Math.max(1, Number(schedule?.cycleOnDays ?? 1));
        base.cycleOffDays = Math.max(1, Number(schedule?.cycleOffDays ?? 1));
    }

    return base;
}

function normalizeWeekdays(value?: number[]): Weekday[] {
    if (!value?.length) {
        return [1, 2, 3, 4, 5, 6, 0];
    }

    const unique = new Set<number>();
    for (const day of value) {
        if (day >= 0 && day <= 6) {
            unique.add(day);
        }
    }

    return Array.from(unique).sort((a, b) => a - b) as Weekday[];
}
