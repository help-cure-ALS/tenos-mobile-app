/**
 * Builds the on-device patient snapshot for study matching.
 *
 * Reads only local data (Patient resource, structured questionnaires,
 * metric observations, medications, aids) — nothing leaves the device.
 * Every field stays undefined when the underlying datum is missing;
 * the matching engine then reports "unknown" instead of guessing.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFhirRepo } from '@/src/hooks/useFhirRepo';
import { useMedications } from '@/src/medications/context/MedicationsProvider';
import { useAids } from '@/src/aids';
import { useALSGeneticBackground } from '@/src/questionnaires/structured/alsGeneticBackground';
import { useALSKingsStage } from '@/src/questionnaires/structured/alsKingsStage';
import { useALSSubtype } from '@/src/questionnaires/structured/alsSubtype';
import { getQuestionnaireDefinition, loadQuestionnaireEntries } from '@/src/questionnaires';
import { getEntriesFromCache } from '@/src/metrics/hooks/observationsCache';
import { on } from '@/src/lib/bus';
import type { PatientMatchSnapshot } from './matching';

// Profile screen extension URLs (app/settings/profile/index.tsx) plus
// the sync-vault URN variants read by the PDF export — both families
// exist in the wild, so we check both.
const FIRST_SYMPTOMS_URLS = [
    'http://example.org/fhir/StructureDefinition/first-symptoms-date',
    'urn:medical-sync-vault:first-symptoms-date',
];
const DIAGNOSIS_DATE_URLS = [
    'http://example.org/fhir/StructureDefinition/diagnosis-date',
    'urn:medical-sync-vault:diagnosis-date',
];
const ALS_CAUSE_URLS = [
    'http://example.org/fhir/StructureDefinition/als-cause',
    'urn:medical-sync-vault:als-cause',
];
const ONSET_REGION_URLS = [
    'http://example.org/fhir/StructureDefinition/als-onset-region',
    'urn:medical-sync-vault:onset-region',
];

// Same aid detection as the King's stage derivation
// (src/questionnaires/structured/alsKingsStage/deriveKingsStage.ts)
const RELEVANT_AID_STATUSES = new Set(['requested', 'approved']);
const NIV_CATALOG_IDS = new Set(['ATM-001']);
const TRACH_CATALOG_IDS = new Set(['ATM-003', 'ATM-004']);
const PEG_CATALOG_IDS = new Set(['ERN-006']);

// Substance detection over medication names (brand names included)
const RILUZOLE_TERMS = ['riluzol', 'rilutek', 'tiglutik', 'exservan'];
const EDARAVONE_TERMS = ['edaravon', 'radicava', 'radicut'];

function getExtensionValue(extensions: any[] | undefined, urls: string[]): string | undefined {
    for (const url of urls) {
        const value = extensions?.find((e) => e?.url === url)?.valueString;
        if (typeof value === 'string' && value) return value;
    }
    return undefined;
}

/** "YYYY-MM" or ISO date → whole months from then until now. */
export function monthsSince(raw: string | undefined, now = new Date()): number | undefined {
    if (!raw) return undefined;
    const match = raw.match(/^(\d{4})-(\d{2})/);
    if (!match) return undefined;
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (!Number.isFinite(year) || month < 1 || month > 12) return undefined;
    const months = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
    return months >= 0 ? months : undefined;
}

/** ISO birth date → age in whole years. */
export function ageInYears(birthDate: string | undefined, now = new Date()): number | undefined {
    if (!birthDate) return undefined;
    const parsed = new Date(birthDate);
    if (Number.isNaN(parsed.getTime())) return undefined;
    let age = now.getFullYear() - parsed.getFullYear();
    const beforeBirthday =
        now.getMonth() < parsed.getMonth()
        || (now.getMonth() === parsed.getMonth() && now.getDate() < parsed.getDate());
    if (beforeBirthday) age -= 1;
    return age >= 0 && age <= 130 ? age : undefined;
}

function mapOnsetRegionExtension(raw: string | undefined): 'bulbar' | 'spinal' | undefined {
    if (!raw) return undefined;
    const value = raw.toLowerCase();
    if (value.includes('bulbar')) return 'bulbar';
    if (value.includes('limb') || value.includes('extremity') || value.includes('spinal')) return 'spinal';
    return undefined;
}

/** OPM onset code → region. O1 = head/bulbar; O2x and O4x = limbs; O3x = neither. */
function mapOnsetCode(code: string | undefined): 'bulbar' | 'spinal' | undefined {
    if (!code) return undefined;
    if (code === 'O1') return 'bulbar';
    if (code.startsWith('O2') || code.startsWith('O4')) return 'spinal';
    return undefined;
}

export interface StudyMatchSnapshotResult {
    snapshot: PatientMatchSnapshot;
    isLoading: boolean;
}

export function useStudyMatchSnapshot(): StudyMatchSnapshotResult {
    const { i18n } = useTranslation();
    const { get, list, count, activePatientId } = useFhirRepo();
    const { medications, isLoading: medicationsLoading } = useMedications();
    const { aids, isLoading: aidsLoading } = useAids();
    const genetic = useALSGeneticBackground();
    const kings = useALSKingsStage();
    const subtype = useALSSubtype();

    const [loaded, setLoaded] = useState<PatientMatchSnapshot>({});
    const [isLoading, setIsLoading] = useState(true);

    // Patient resource + observation-backed values (async loads)
    const loadAsyncParts = useCallback(async () => {
        const next: PatientMatchSnapshot = {};
        if (!activePatientId) {
            setLoaded(next);
            setIsLoading(false);
            return;
        }

        try {
            const [patientRow, fvcEntries, svcEntries] = await Promise.all([
                get('Patient', activePatientId),
                getEntriesFromCache('fvc_percent', activePatientId, list, count),
                getEntriesFromCache('svc', activePatientId, list, count),
            ]);

            const patient = patientRow?.resource;
            if (patient) {
                next.ageYears = ageInYears(patient.birthDate);
                if (patient.gender === 'male' || patient.gender === 'female') {
                    next.sex = patient.gender;
                }
                const extensions = patient.extension;
                next.monthsSinceOnset = monthsSince(getExtensionValue(extensions, FIRST_SYMPTOMS_URLS));
                next.monthsSinceDiagnosis = monthsSince(getExtensionValue(extensions, DIAGNOSIS_DATE_URLS));

                const cause = getExtensionValue(extensions, ALS_CAUSE_URLS)?.toLowerCase();
                if (cause === 'familial' || cause === 'sporadic') {
                    next.alsCause = cause;
                }
                next.onsetRegion = mapOnsetRegionExtension(getExtensionValue(extensions, ONSET_REGION_URLS));
            }

            const fvc = fvcEntries[0]?.values?.value;
            if (typeof fvc === 'number') next.fvcPercent = fvc;
            const svc = svcEntries[0]?.values?.value;
            if (typeof svc === 'number') next.svcPercent = svc;

            // ALSFRS-R total from the questionnaire entries
            const alsfrsDef = getQuestionnaireDefinition('alsfrs-r', i18n.language);
            if (alsfrsDef) {
                const listFn = async (resourceType: string, opts?: { tag?: string }) =>
                    list(resourceType, { limit: 1000, ...opts });
                const entries = await loadQuestionnaireEntries(alsfrsDef, listFn);
                const total = entries[0]?.totalScore;
                if (typeof total === 'number') next.alsfrsRTotal = total;
            }
        } catch {
            // Partial snapshot is fine — missing fields stay unknown
        }

        setLoaded(next);
        setIsLoading(false);
    }, [activePatientId, get, list, count, i18n.language]);

    useEffect(() => {
        setIsLoading(true);
        void loadAsyncParts();
        const off = on('fhir:changed', () => { void loadAsyncParts(); });
        return () => off();
    }, [loadAsyncParts]);

    // Hook-backed values (already reactive). Memoized so the snapshot
    // keeps a stable identity between renders — consumers use it as a
    // dependency for per-study match maps.
    const geneticEntry = genetic.latestEntry;
    const kingsEntry = kings.latestEntry;
    const subtypeEntry = subtype.latestEntry;

    const snapshot: PatientMatchSnapshot = useMemo(() => {
        const next: PatientMatchSnapshot = { ...loaded };
        applyDerivedParts(next, {
            geneticEntry,
            kingsEntry,
            subtypeEntry,
            aids,
            aidsLoading,
            medications,
            medicationsLoading,
        });
        return next;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loaded, geneticEntry, kingsEntry, subtypeEntry, aids, aidsLoading, medications, medicationsLoading]);

    return {
        snapshot,
        isLoading:
            isLoading
            || medicationsLoading
            || aidsLoading
            || genetic.isLoading
            || kings.isLoading
            || subtype.isLoading,
    };
}

function applyDerivedParts(
    snapshot: PatientMatchSnapshot,
    parts: {
        geneticEntry: ReturnType<typeof useALSGeneticBackground>['latestEntry'];
        kingsEntry: ReturnType<typeof useALSKingsStage>['latestEntry'];
        subtypeEntry: ReturnType<typeof useALSSubtype>['latestEntry'];
        aids: ReturnType<typeof useAids>['aids'];
        aidsLoading: boolean;
        medications: ReturnType<typeof useMedications>['medications'];
        medicationsLoading: boolean;
    },
): void {
    const { geneticEntry, kingsEntry, subtypeEntry, aids, aidsLoading, medications, medicationsLoading } = parts;
    if (geneticEntry) {
        if (geneticEntry.diseaseForm === 'familial' || geneticEntry.diseaseForm === 'sporadic') {
            snapshot.alsCause = geneticEntry.diseaseForm;
        }
        const gene = geneticEntry.gene;
        if (gene && gene !== 'unknown' && gene !== 'other') {
            snapshot.geneMutations = [gene.toLowerCase()];
        } else if (geneticEntry.testingStatus === 'negative') {
            snapshot.geneMutations = [];
        }
    }

    if (kingsEntry?.stage) {
        const stage = Number.parseInt(String(kingsEntry.stage), 10);
        if (Number.isFinite(stage) && stage >= 1 && stage <= 5) {
            snapshot.kingsStage = stage;
        }
    }

    // Clinical OPM onset beats the coarse profile extension
    const subtypeRegion = mapOnsetCode(subtypeEntry?.onsetCode);
    if (subtypeRegion) snapshot.onsetRegion = subtypeRegion;

    if (!aidsLoading) {
        const relevant = aids.filter((aid) => RELEVANT_AID_STATUSES.has(aid.status));
        const haystackOf = (aid: { name: string; notes?: string }) =>
            `${aid.name} ${aid.notes ?? ''}`.toLowerCase();
        snapshot.ventilation = {
            niv: relevant.some(
                (aid) =>
                    (aid.catalogId && NIV_CATALOG_IDS.has(aid.catalogId))
                    || /\bniv\b|bipap|cpap|non-invasive ventil/.test(haystackOf(aid)),
            ),
            tracheostomy: relevant.some(
                (aid) =>
                    (aid.catalogId && TRACH_CATALOG_IDS.has(aid.catalogId))
                    || /tracheostom|trachealkan/.test(haystackOf(aid)),
            ),
        };
        snapshot.peg = relevant.some(
            (aid) =>
                (aid.catalogId && PEG_CATALOG_IDS.has(aid.catalogId))
                || /\bpeg\b|gastrostom|feeding tube/.test(haystackOf(aid)),
        );
    }

    if (!medicationsLoading) {
        const names = medications.map((m) => m.name.toLowerCase());
        const substances: string[] = [];
        if (names.some((n) => RILUZOLE_TERMS.some((term) => n.includes(term)))) substances.push('riluzole');
        if (names.some((n) => EDARAVONE_TERMS.some((term) => n.includes(term)))) substances.push('edaravone');
        snapshot.medications = substances;
    }
}
