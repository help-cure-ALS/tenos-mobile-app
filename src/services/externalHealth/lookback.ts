const DAY_MS = 24 * 60 * 60 * 1000;

export const MIN_EXTERNAL_HEALTH_LOOKBACK_DAYS = 365 * 3;
export const FALLBACK_EXTERNAL_HEALTH_LOOKBACK_DAYS = 365 * 5;

const FIRST_SYMPTOMS_EXTENSION_URLS = [
    'http://example.org/fhir/StructureDefinition/first-symptoms-date',
    'urn:medical-sync-vault:first-symptoms-date',
];

export function getExternalHealthLookbackDaysFromPatientResource(
    patient: any,
    now: Date = new Date()
): number {
    const firstSymptomsDate = getFirstSymptomsDate(patient);
    if (!firstSymptomsDate || firstSymptomsDate.getTime() > now.getTime()) {
        return FALLBACK_EXTERNAL_HEALTH_LOOKBACK_DAYS;
    }

    const daysSinceFirstSymptoms = Math.max(
        1,
        Math.ceil((startOfDay(now).getTime() - startOfDay(firstSymptomsDate).getTime()) / DAY_MS)
    );
    return Math.max(MIN_EXTERNAL_HEALTH_LOOKBACK_DAYS, daysSinceFirstSymptoms);
}

function getFirstSymptomsDate(patient: any): Date | undefined {
    const extensions = patient?.extension;
    if (!Array.isArray(extensions)) return undefined;

    for (const url of FIRST_SYMPTOMS_EXTENSION_URLS) {
        const raw = extensions.find((ext: any) => ext?.url === url)?.valueString;
        const parsed = parseMonthYearDate(raw);
        if (parsed) return parsed;
    }

    return undefined;
}

function parseMonthYearDate(value: unknown): Date | undefined {
    if (typeof value !== 'string') return undefined;
    const match = value.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
    if (!match) return undefined;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = match[3] ? Number(match[3]) : 1;
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return undefined;
    if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;

    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
