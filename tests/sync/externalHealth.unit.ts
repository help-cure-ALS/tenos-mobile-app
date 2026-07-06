import { base as bloodOxygenBase } from "../../src/metrics/definitions/bloodOxygen/base";
import { base as bloodPressureBase } from "../../src/metrics/definitions/bloodPressure/base";
import { base as bodyFatBase } from "../../src/metrics/definitions/bodyFat/base";
import { base as bmiBase } from "../../src/metrics/definitions/bmi/base";
import { base as bodyTemperatureBase } from "../../src/metrics/definitions/bodyTemperature/base";
import { base as heartRateBase } from "../../src/metrics/definitions/heartRate/base";
import { base as walkingDistanceBase } from "../../src/metrics/definitions/walkingDistance/base";
import { base as weightBase } from "../../src/metrics/definitions/weight/base";
import { base as fvcBase } from "../../src/metrics/definitions/fvc/base";
import { base as caloricIntakeBase } from "../../src/metrics/definitions/caloricIntake/base";
import { base as fluidIntakeBase } from "../../src/metrics/definitions/fluidIntake/base";
import { base as stepCountBase } from "../../src/metrics/definitions/stepCount/base";
import { base as walkingSteadinessBase } from "../../src/metrics/definitions/walkingSteadiness/base";
import { base as respiratoryRateBase } from "../../src/metrics/definitions/respiratoryRate/base";
import { base as flightsClimbedBase } from "../../src/metrics/definitions/flightsClimbed/base";
import { base as walkingSpeedBase } from "../../src/metrics/definitions/walkingSpeed/base";
import { base as walkingStepLengthBase } from "../../src/metrics/definitions/walkingStepLength/base";
import { base as walkingAsymmetryBase } from "../../src/metrics/definitions/walkingAsymmetry/base";
import { base as walkingDoubleSupportBase } from "../../src/metrics/definitions/walkingDoubleSupport/base";
import { base as stairDescentSpeedBase } from "../../src/metrics/definitions/stairDescentSpeed/base";
import { base as hrvSdnnBase } from "../../src/metrics/definitions/hrv/base";
import { base as hrvRmssdBase } from "../../src/metrics/definitions/hrvRmssd/base";
import { base as activeEnergyBase } from "../../src/metrics/definitions/activeEnergy/base";
import { base as fallsBase } from "../../src/metrics/definitions/falls/base";
import { fhirToMetricEntry, EXTERNAL_HEALTH_SOURCE_URL } from "../../src/metrics/fhir/metricToFhir";
import type { MetricDefinition } from "../../src/metrics/types";
import { importExternalHealthSamples, selectExternalHealthSamplesForImport } from "../../src/services/externalHealth/importService";
import { isMetricAvailableOnPlatform } from "../../src/metrics/platformAvailability";
import {
    EXTERNAL_HEALTH_AUTO_IMPORT_COOLDOWN_MS,
    shouldRunExternalHealthAutoImport,
} from "../../src/services/externalHealth/autoImportPolicy";
import { runExternalHealthImportExclusive } from "../../src/services/externalHealth/importLock";
import {
    HEALTH_CONNECT_ANDROID_READ_PERMISSIONS,
    buildExternalHealthRegistry,
} from "../../src/services/externalHealth/registry";
import { buildExternalHealthObservationId } from "../../src/services/externalHealth/dedupe";
import {
    FALLBACK_EXTERNAL_HEALTH_LOOKBACK_DAYS,
    MIN_EXTERNAL_HEALTH_LOOKBACK_DAYS,
    getExternalHealthLookbackDaysFromPatientResource,
} from "../../src/services/externalHealth/lookback";
import {
    buildAppleHealthMedicationImportPreviewFromRecords,
    type AppleHealthMedicationDoseEventRecord,
    type AppleHealthMedicationRecord,
} from "../../src/services/externalHealth/medicationImport";
import type { ExternalHealthRawSample } from "../../src/services/externalHealth/types";
import {
    parseMedicationStrengthInput,
    type MedicationItem,
} from "../../src/medications/types";

const RECORDED_BY_ROLE_URL = "urn:medical-sync-vault:recorded-by-role";

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

export async function runExternalHealthUnitTests(): Promise<void> {
    const definitions = [
        makeDefinition(weightBase, "Gewicht"),
        makeDefinition(heartRateBase, "Herzfrequenz"),
        makeDefinition(bloodOxygenBase, "Sauerstoffsättigung"),
        makeDefinition(bodyFatBase, "Körperfett"),
        makeDefinition(bmiBase, "BMI"),
        makeDefinition(bodyTemperatureBase, "Körpertemperatur"),
        makeDefinition(bloodPressureBase, "Blutdruck"),
        makeDefinition(walkingDistanceBase, "6-Minuten-Gehtest"),
        makeDefinition(fvcBase, "FVC"),
        makeDefinition(caloricIntakeBase, "Kalorien"),
        makeDefinition(fluidIntakeBase, "Flüssigkeit"),
        makeDefinition(stepCountBase, "Schritte"),
        makeDefinition(walkingSteadinessBase, "Gehstabilität"),
        makeDefinition(respiratoryRateBase, "Atemfrequenz"),
        makeDefinition(flightsClimbedBase, "Etagen"),
        makeDefinition(walkingSpeedBase, "Gehgeschwindigkeit"),
        makeDefinition(walkingStepLengthBase, "Schrittlänge"),
        makeDefinition(walkingAsymmetryBase, "Asymmetrie"),
        makeDefinition(walkingDoubleSupportBase, "Doppelstand"),
        makeDefinition(stairDescentSpeedBase, "Treppab"),
        makeDefinition(hrvSdnnBase, "HRV (SDNN)"),
        makeDefinition(hrvRmssdBase, "HRV (RMSSD)"),
        makeDefinition(activeEnergyBase, "Aktive Energie"),
        makeDefinition(fallsBase, "Stürze"),
    ];

    const registry = buildExternalHealthRegistry(definitions);
    assert(registry.length === 23, "expected twenty-three importable metrics");
    assert(!registry.some((entry) => entry.metricId === "bmi"), "bmi must stay derived inside TENOS instead of importing external derived values");

    // walking_distance imports Apple's estimated 6-minute walk distance (the metric IS the 6MWT)
    const walkingDistance = registry.find((entry) => entry.metricId === "walking_distance");
    assert(walkingDistance?.appleHealthKit?.quantityTypes.includes("HKQuantityTypeIdentifierSixMinuteWalkTestDistance"), "walking_distance should import the six-minute walk test estimate on iOS");
    assert(!walkingDistance?.healthConnect, "walking_distance 6MWT import is iOS-only");
    assert(walkingDistance?.importPolicy.mode === "daily-latest", "walking_distance should keep the latest 6MWT value per day");
    assert(!walkingDistanceBase.platforms, "walking_distance stays manually enterable on both platforms");

    // T-002 Part A additions
    const fvc = registry.find((entry) => entry.metricId === "fvc");
    assert(fvc?.appleHealthKit?.quantityTypes.includes("HKQuantityTypeIdentifierForcedVitalCapacity"), "fvc should import forced vital capacity on iOS");
    assert(!fvc?.healthConnect, "fvc has no Health Connect source (iOS-only import)");
    assert(fvc?.importPolicy.mode === "daily-latest", "fvc should keep the latest spirometry value per day");

    const caloric = registry.find((entry) => entry.metricId === "caloric_intake");
    assert(caloric?.appleHealthKit?.quantityTypes.includes("HKQuantityTypeIdentifierDietaryEnergyConsumed"), "caloric_intake should import dietary energy on iOS");
    assert(caloric?.healthConnect?.recordTypes.includes("Nutrition"), "caloric_intake should import Nutrition on Android");
    assert(caloric?.importPolicy.mode === "daily-sum", "caloric_intake should sum cumulative samples per day");

    const fluid = registry.find((entry) => entry.metricId === "fluid_intake");
    assert(fluid?.healthConnect?.recordTypes.includes("Hydration"), "fluid_intake should import Hydration on Android");
    assert(fluid?.importPolicy.mode === "daily-sum", "fluid_intake should sum cumulative samples per day");

    // T-002 Part C: first new metrics
    const stepCount = registry.find((entry) => entry.metricId === "step_count");
    assert(stepCount?.appleHealthKit?.quantityTypes.includes("HKQuantityTypeIdentifierStepCount"), "step_count should import StepCount on iOS");
    assert(stepCount?.healthConnect?.recordTypes.includes("Steps"), "step_count should import Steps on Android");
    assert(stepCount?.importPolicy.mode === "daily-sum", "step_count should sum steps per day");
    assert(!walkingDistanceBase.platforms, "walking_distance has no platform restriction");

    const steadiness = registry.find((entry) => entry.metricId === "walking_steadiness");
    assert(steadiness?.appleHealthKit?.quantityTypes.includes("HKQuantityTypeIdentifierAppleWalkingSteadiness"), "walking_steadiness should import Apple Walking Steadiness on iOS");
    assert(!steadiness?.healthConnect, "walking_steadiness has no Health Connect source (iOS-only)");
    assert(JSON.stringify(walkingSteadinessBase.platforms) === JSON.stringify(["ios"]), "walking_steadiness must be declared iOS-only via platforms");

    const respiratory = registry.find((entry) => entry.metricId === "respiratory_rate");
    assert(respiratory?.appleHealthKit?.quantityTypes.includes("HKQuantityTypeIdentifierRespiratoryRate"), "respiratory_rate should import RespiratoryRate on iOS");
    assert(respiratory?.healthConnect?.recordTypes.includes("RespiratoryRate"), "respiratory_rate should import RespiratoryRate on Android");
    assert(respiratory?.importPolicy.mode === "daily-average", "respiratory_rate should average samples per day");

    const flights = registry.find((entry) => entry.metricId === "flights_climbed");
    assert(flights?.healthConnect?.recordTypes.includes("FloorsClimbed"), "flights_climbed should import FloorsClimbed on Android");
    assert(flights?.importPolicy.mode === "daily-sum", "flights_climbed should sum floors per day");

    // walking_speed: cross-platform via Health Connect series record (Speed)
    const walkingSpeed = registry.find((entry) => entry.metricId === "walking_speed");
    assert(walkingSpeed?.appleHealthKit?.quantityTypes.includes("HKQuantityTypeIdentifierWalkingSpeed"), "walking_speed should import WalkingSpeed on iOS");
    assert(walkingSpeed?.healthConnect?.recordTypes.includes("Speed"), "walking_speed should import the Speed series record on Android");
    assert(walkingSpeed?.healthConnect?.fields.some((f) => f.sourceField === "Speed.speed.inMetersPerSecond"), "walking_speed must resolve the inner speed sample path");
    assert(walkingSpeed?.importPolicy.mode === "daily-average", "walking_speed should average samples per day");
    assert(!walkingSpeedBase.platforms, "walking_speed is cross-platform (no platforms restriction)");

    // iOS-only mobility group: declared via platforms, no Health Connect source
    for (const iosBase of [walkingStepLengthBase, walkingAsymmetryBase, walkingDoubleSupportBase, stairDescentSpeedBase]) {
        assert(JSON.stringify(iosBase.platforms) === JSON.stringify(["ios"]), `${iosBase.id} must be declared iOS-only`);
        const entry = registry.find((e) => e.metricId === iosBase.id);
        assert(entry?.appleHealthKit && !entry?.healthConnect, `${iosBase.id} should be iOS-only in the registry`);
        assert(entry?.importPolicy.mode === "daily-average", `${iosBase.id} should average samples per day`);
    }

    // hrv split into two platform-specific metrics: SDNN (iOS) and RMSSD (Android)
    const hrvSdnn = registry.find((entry) => entry.metricId === "hrv_sdnn");
    assert(hrvSdnn?.appleHealthKit?.quantityTypes.includes("HKQuantityTypeIdentifierHeartRateVariabilitySDNN"), "hrv_sdnn should import SDNN on iOS");
    assert(!hrvSdnn?.healthConnect, "hrv_sdnn is iOS-only");
    assert(JSON.stringify(hrvSdnnBase.platforms) === JSON.stringify(["ios"]), "hrv_sdnn must be declared iOS-only");

    const hrvRmssd = registry.find((entry) => entry.metricId === "hrv_rmssd");
    assert(hrvRmssd?.healthConnect?.recordTypes.includes("HeartRateVariabilityRmssd"), "hrv_rmssd should import RMSSD on Android");
    assert(!hrvRmssd?.appleHealthKit, "hrv_rmssd is Android-only");
    assert(JSON.stringify(hrvRmssdBase.platforms) === JSON.stringify(["android"]), "hrv_rmssd must be declared Android-only");
    assert(hrvRmssd?.importPolicy.mode === "daily-average", "hrv_rmssd should average samples per day");

    // active_energy: cross-platform, daily-sum
    const activeEnergy = registry.find((entry) => entry.metricId === "active_energy");
    assert(activeEnergy?.appleHealthKit?.quantityTypes.includes("HKQuantityTypeIdentifierActiveEnergyBurned"), "active_energy should import ActiveEnergyBurned on iOS");
    assert(activeEnergy?.healthConnect?.recordTypes.includes("ActiveCaloriesBurned"), "active_energy should import ActiveCaloriesBurned on Android");
    assert(activeEnergy?.importPolicy.mode === "daily-sum", "active_energy should sum energy per day");

    // falls: HealthKit *quantity* type (NumberOfTimesFallen, unit count) — NOT a category
    // type; iOS-only import, stays manually enterable on both platforms.
    const falls = registry.find((entry) => entry.metricId === "falls");
    assert(falls?.appleHealthKit?.quantityTypes.includes("HKQuantityTypeIdentifierNumberOfTimesFallen"), "falls should import the NumberOfTimesFallen quantity on iOS");
    assert(falls?.appleHealthKit?.fields.some((f) => f.sourceKind === "quantity"), "falls field mapping should be marked as a quantity source");
    assert(!falls?.appleHealthKit?.categoryTypes.length, "falls must use no category types (NumberOfTimesFallen is a quantity type, not a category)");
    assert(!falls?.healthConnect, "falls has no Health Connect source (iOS-only import)");
    assert(falls?.importPolicy.mode === "daily-sum", "falls should sum fall counts per day");
    assert(!fallsBase.platforms, "falls stays manually enterable on both platforms (no platforms restriction)");

    const heartRate = registry.find((entry) => entry.metricId === "heart_rate");
    assert(heartRate?.healthConnect?.recordTypes.includes("RestingHeartRate"), "heart_rate should import resting heart rate on Android");
    assert(heartRate?.appleHealthKit?.quantityTypes.includes("HKQuantityTypeIdentifierRestingHeartRate"), "heart_rate should import resting heart rate on iOS");

    const bloodPressure = registry.find((entry) => entry.metricId === "blood_pressure");
    assert(bloodPressure?.healthConnect?.fields.length === 2, "blood pressure should map systolic and diastolic fields");
    assert(bloodPressure?.appleHealthKit?.correlationTypes.includes("HKCorrelationTypeIdentifierBloodPressure"), "blood pressure should import HealthKit blood pressure correlations on iOS");
    assert(!bloodPressure?.appleHealthKit?.quantityTypes.includes("HKQuantityTypeIdentifierBloodPressureSystolic"), "blood pressure should not query iOS systolic quantity samples directly");
    assert(bloodPressure?.appleHealthKit?.readTypes.includes("HKQuantityTypeIdentifierBloodPressureSystolic"), "blood pressure should request iOS systolic read permission");
    assert(!bloodPressure?.appleHealthKit?.readTypes.includes("HKCorrelationTypeIdentifierBloodPressure"), "blood pressure should not request iOS correlation authorization directly");

    const bodyFat = registry.find((entry) => entry.metricId === "body_fat");
    assert(bodyFat?.appleHealthKit?.quantityTypes.includes("HKQuantityTypeIdentifierBodyFatPercentage"), "body_fat should import body fat percentage on iOS");
    assert(bodyFat?.healthConnect?.recordTypes.includes("BodyFat"), "body_fat should import BodyFat on Android");

    const weight = registry.find((entry) => entry.metricId === "weight");
    assert(weight?.importPolicy.mode === "daily-latest", "weight should condense external samples to the latest value per day");
    assert(bloodPressure?.importPolicy.mode === "daily-first-and-last", "blood pressure should keep first and last value per day");

    {
        // platforms field: metrics without a restriction are available everywhere; an
        // iOS-only metric is hidden on Android and vice-versa.
        assert(isMetricAvailableOnPlatform({}, "ios"), "metric without platforms is available on iOS");
        assert(isMetricAvailableOnPlatform({}, "android"), "metric without platforms is available on Android");
        assert(isMetricAvailableOnPlatform({ platforms: ["ios"] }, "ios"), "iOS-only metric is available on iOS");
        assert(!isMetricAvailableOnPlatform({ platforms: ["ios"] }, "android"), "iOS-only metric is hidden on Android");
        assert(isMetricAvailableOnPlatform({ platforms: ["android"] }, "android"), "Android-only metric is available on Android");
        assert(!isMetricAvailableOnPlatform({ platforms: ["android"] }, "ios"), "Android-only metric is hidden on iOS");
    }

    {
        // daily-sum: cumulative samples of one local day collapse into a single daily total.
        const mk = (observedAt: Date, value: number): ExternalHealthRawSample => ({
            platform: "apple_health",
            metricId: "caloric_intake",
            observedAt,
            values: { value },
            unit: "kcal",
            sourceLabel: "Apple Health",
        });
        const selected = selectExternalHealthSamplesForImport(
            [
                mk(new Date(2026, 5, 8, 8, 0), 300),
                mk(new Date(2026, 5, 8, 12, 0), 500),
                mk(new Date(2026, 5, 8, 19, 0), 400),
                mk(new Date(2026, 5, 9, 9, 0), 250),
            ],
            definitions
        );
        const caloricSelected = selected.filter((sample) => sample.metricId === "caloric_intake");
        assert(caloricSelected.length === 2, "daily-sum should produce one caloric_intake sample per local day");
        const june8 = caloricSelected.find((sample) => sample.observedAt.getDate() === 8);
        assert(june8?.values.value === 1200, "daily-sum should total the day's samples (300+500+400)");
        assert(june8?.externalId === "daily-sum:caloric_intake:2026-06-08", "daily-sum should use a stable per-day external id");
    }

    {
        // daily-average: rate-like samples of one local day collapse into the daily mean.
        const mk = (observedAt: Date, value: number): ExternalHealthRawSample => ({
            platform: "apple_health",
            metricId: "respiratory_rate",
            observedAt,
            values: { value },
            unit: "count/min",
            sourceLabel: "Apple Health",
        });
        const selected = selectExternalHealthSamplesForImport(
            [
                mk(new Date(2026, 5, 8, 2, 0), 14),
                mk(new Date(2026, 5, 8, 4, 0), 16),
                mk(new Date(2026, 5, 8, 6, 0), 18),
            ],
            definitions
        );
        const resp = selected.filter((sample) => sample.metricId === "respiratory_rate");
        assert(resp.length === 1, "daily-average should produce one respiratory_rate sample per local day");
        assert(resp[0].values.value === 16, "daily-average should mean the day's samples ((14+16+18)/3)");
        assert(resp[0].externalId === "daily-avg:respiratory_rate:2026-06-08", "daily-average should use a stable per-day external id");
    }

    {
        const now = new Date("2026-06-08T12:00:00.000Z").getTime();
        const readyState = {
            canUseHealthImport: true,
            availability: "available" as const,
            enabled: true,
            selectedMetricCount: 2,
            isLoading: false,
            isSyncing: false,
        };
        assert(shouldRunExternalHealthAutoImport(readyState, now), "expected auto import to run when ready and never imported");
        assert(!shouldRunExternalHealthAutoImport({
            ...readyState,
            lastImportedAt: new Date(now - 60_000).toISOString(),
        }, now), "expected auto import to respect last import cooldown");
        assert(shouldRunExternalHealthAutoImport({
            ...readyState,
            lastImportedAt: new Date(now - EXTERNAL_HEALTH_AUTO_IMPORT_COOLDOWN_MS - 1).toISOString(),
        }, now), "expected auto import after cooldown");
        assert(!shouldRunExternalHealthAutoImport({
            ...readyState,
            lastAutoAttemptAtMs: now - 60_000,
        }, now), "expected auto import to respect failed-attempt cooldown");
        assert(!shouldRunExternalHealthAutoImport({
            ...readyState,
            enabled: false,
        }, now), "expected disabled import to skip auto import");
    }

    {
        let runs: number = 0;
        const resultTemplate = { imported: 0, updated: 0, unchanged: 0, thinned: 0, skipped: 0, errors: [] };
        const first = runExternalHealthImportExclusive(async () => {
            runs += 1;
            await Promise.resolve();
            return { ...resultTemplate, imported: 1 };
        });
        const second = runExternalHealthImportExclusive(async () => {
            runs += 1;
            return { ...resultTemplate, imported: 2 };
        });
        const [firstResult, secondResult] = await Promise.all([first, second]);
        assert(Number(runs) === 1, "expected concurrent external health imports to share one run");
        assert(firstResult.imported === 1 && secondResult.imported === 1, "expected concurrent imports to share the same result");

        const thirdResult = await runExternalHealthImportExclusive(async () => {
            runs += 1;
            return { ...resultTemplate, imported: 3 };
        });
        assert(Number(runs) === 2, "expected lock to clear after import finishes");
        assert(thirdResult.imported === 3, "expected later import to run after lock clears");
    }

    {
        const lookback = getExternalHealthLookbackDaysFromPatientResource(
            {
                extension: [{
                    url: "http://example.org/fhir/StructureDefinition/first-symptoms-date",
                    valueString: "2024-06",
                }],
            },
            new Date("2026-06-08T12:00:00.000Z")
        );
        assert(lookback === MIN_EXTERNAL_HEALTH_LOOKBACK_DAYS, "expected recent first symptoms date to keep the minimum external health lookback");
    }

    {
        const lookback = getExternalHealthLookbackDaysFromPatientResource(
            {
                extension: [{
                    url: "http://example.org/fhir/StructureDefinition/first-symptoms-date",
                    valueString: "2020-06",
                }],
            },
            new Date("2026-06-08T12:00:00.000Z")
        );
        assert(lookback > 2190 && lookback < 2210, "expected older first symptoms date to define external health lookback");
    }

    {
        const fallback = getExternalHealthLookbackDaysFromPatientResource({}, new Date("2026-06-08T12:00:00.000Z"));
        assert(fallback === FALLBACK_EXTERNAL_HEALTH_LOOKBACK_DAYS, "expected five-year fallback without first symptoms");
    }

    {
        assert(parseMedicationStrengthInput("2,5") === 2.5, "expected German decimal comma medication strength to parse");
        assert(parseMedicationStrengthInput("2.5") === 2.5, "expected decimal point medication strength to parse");
        assert(parseMedicationStrengthInput("") === undefined, "expected empty medication strength to stay unset");
        assert(parseMedicationStrengthInput("abc") === undefined, "expected invalid medication strength not to become NaN");
    }

    {
        const appConfig = require(`${process.cwd()}/app.config.js`)();
        const permissions = appConfig.expo.android.permissions as string[];
        for (const permission of HEALTH_CONNECT_ANDROID_READ_PERMISSIONS) {
            assert(permissions.includes(permission), `missing Android permission ${permission}`);
        }
        const plugins = appConfig.expo.plugins.map((plugin: any) => Array.isArray(plugin) ? plugin[0] : plugin);
        assert(plugins.includes("@kingstinct/react-native-healthkit"), "missing HealthKit config plugin");
        assert(plugins.includes("expo-health-connect"), "missing Health Connect config plugin");
        assert(plugins.includes("expo-build-properties"), "missing build-properties config plugin");
        const healthKitPlugin = appConfig.expo.plugins.find((plugin: any) => Array.isArray(plugin) && plugin[0] === "@kingstinct/react-native-healthkit");
        assert(typeof healthKitPlugin?.[1]?.NSHealthShareUsageDescription === "string", "missing iOS HealthKit read purpose string");
        assert(typeof healthKitPlugin?.[1]?.NSHealthUpdateUsageDescription === "string", "missing iOS HealthKit update purpose string required by App Store validation");
    }

    {
        const now = new Date("2026-06-08T12:00:00.000Z");
        const existing: MedicationItem[] = [
            makeMedication("med-existing", "Riluzol", "tablet", {
                platform: "apple_health",
                sourceId: "apple-riluzol",
                sourceLabel: "Apple Health",
                importedAt: "2026-06-01T12:00:00.000Z",
            }),
            makeMedication("med-duplicate-a", "Baclofen", "tablet"),
            makeMedication("med-duplicate-b", "Baclofen", "tablet"),
        ];
        const medications: AppleHealthMedicationRecord[] = [
            makeAppleMedication("apple-riluzol", "Riluzol", "tablet", true),
            makeAppleMedication("apple-edaravone", "Edaravone", "injection", true),
            makeAppleMedication("apple-rhodiologes", "Rhodiologes", "tablet", true),
            makeAppleMedication("apple-archived", "Archived", "tablet", false, true),
            makeAppleMedication("apple-baclofen", "Baclofen", "tablet", false),
        ];
        const events: AppleHealthMedicationDoseEventRecord[] = [
            {
                medicationConceptIdentifier: "apple-edaravone",
                scheduleType: 2,
                scheduledDate: new Date(2026, 5, 8, 7, 30),
                scheduledDoseQuantity: 50,
                unit: "mg",
            },
            {
                medicationConceptIdentifier: "apple-edaravone",
                scheduleType: 2,
                scheduledDate: new Date(2026, 5, 7, 19, 30),
                scheduledDoseQuantity: 50,
                unit: "mg",
            },
            {
                medicationConceptIdentifier: "apple-rhodiologes",
                scheduleType: 2,
                scheduledDate: new Date(2026, 5, 8, 11, 30),
                scheduledDoseQuantity: 2,
                unit: "count",
            },
        ];

        const preview = buildAppleHealthMedicationImportPreviewFromRecords(existing, medications, events, now);
        assert(preview.totalRead === 5, "expected all Apple Health medications to be counted");
        assert(preview.archivedCount === 1, "expected archived Apple Health medications to be ignored");
        assert(preview.existingItems.length === 1, "expected external id match to be treated as existing");
        assert(preview.newItems.length === 2, "expected two new medication candidates");
        assert(preview.ambiguousItems.length === 1, "expected duplicate name matches to require manual review");

        const candidate = preview.newItems.find((item) => item.sourceId === "apple-edaravone");
        assert(candidate, "expected Edaravone import candidate");
        assert(candidate.name === "Edaravone", "expected new medication name");
        assert(candidate.form === "injection", "expected Apple form mapping");
        assert(candidate.schedule.type === "daily", "expected scheduled medication to import daily plan");
        assert(candidate.schedule.times.includes("07:30") && candidate.schedule.times.includes("19:30"), "expected scheduled times from dose events");
        assert(candidate.dosageText === "50 mg", "expected dose text from scheduled dose event");
        assert(candidate.draft.externalHealth?.sourceId === "apple-edaravone", "expected Apple Health source metadata");

        const countCandidate = preview.newItems.find((item) => item.sourceId === "apple-rhodiologes");
        assert(countCandidate?.dosageText === "2x", "expected Apple Health count dose to import as dosage text");
    }

    {
        const now = new Date("2026-06-08T12:00:00.000Z");
        const medications: AppleHealthMedicationRecord[] = [
            makeAppleMedication("apple-vitamin-d", "Vitamin D3 20.000 mg", "capsule", false),
            makeAppleMedication("apple-metoprolol", "Metoprolol 47,5", "tablet", true, false, "Metoprolol"),
            makeAppleMedication("apple-combination", "Amoxicillin 875 mg / Clavulanat 125 mg", "tablet", false),
        ];

        const preview = buildAppleHealthMedicationImportPreviewFromRecords([], medications, [], now);
        const vitaminD = preview.newItems.find((item) => item.sourceId === "apple-vitamin-d");
        const metoprolol = preview.newItems.find((item) => item.sourceId === "apple-metoprolol");
        const combination = preview.newItems.find((item) => item.sourceId === "apple-combination");

        assert(vitaminD?.name === "Vitamin D3", "expected explicit strength to be stripped from imported medication name");
        assert(vitaminD?.draft.strengthValue === 20000, "expected German thousand separator in explicit medication strength to parse");
        assert(vitaminD?.draft.strengthUnit === "mg", "expected explicit medication strength unit to import");
        assert(metoprolol?.name === "Metoprolol", "expected nickname to stay the medication name");
        assert(metoprolol?.draft.strengthValue === undefined, "expected unitless Apple Health strength text not to be guessed");
        assert(combination?.draft.strengthValue === undefined, "expected multi-strength medication names not to be collapsed into one strength");
    }

    {
        const olderSample: ExternalHealthRawSample = {
            platform: "apple_health",
            metricId: "weight",
            observedAt: new Date("2026-06-08T08:00:00.000Z"),
            values: { value: 170 },
            unit: "lb",
            sourceLabel: "Apple Health",
            externalId: "sample-old",
            sourceApp: "Health",
            deviceName: "Apple Watch",
        };
        const sample: ExternalHealthRawSample = {
            platform: "apple_health",
            metricId: "weight",
            observedAt: new Date("2026-06-08T10:00:00.000Z"),
            values: { value: 180 },
            unit: "lb",
            sourceLabel: "Apple Health",
            externalId: "sample-1",
            sourceApp: "Health",
            deviceName: "Apple Watch",
        };
        const id = buildExternalHealthObservationId(sample);
        const stored = new Map<string, any>();

        const result = await importExternalHealthSamples(
            [olderSample, sample],
            [makeDefinition(weightBase, "Gewicht")],
            {
                activePatientId: "patient-1",
                get: async (_resourceType, resourceId) => {
                    const resource = stored.get(resourceId);
                    return resource ? { resource, deleted: false, updated_at: resource.meta?.lastUpdated ?? "" } : null;
                },
                upsert: async (_resourceType, resourceId, resource) => {
                    stored.set(resourceId, resource);
                },
            }
        );

        assert(result.imported === 1, "expected imported result");
        assert(result.thinned === 1, "expected same-day older sample to be thinned");
        const resource = stored.get(id);
        assert(resource?.meta?.extension?.some((ext: any) => ext.url === EXTERNAL_HEALTH_SOURCE_URL), "expected external metadata extension");
        const entry = fhirToMetricEntry(resource, makeDefinition(weightBase, "Gewicht"));
        assert(entry?.externalHealth?.platform === "apple_health", "expected external metadata roundtrip");
        assert(entry.source === "Apple Health", "expected source display roundtrip");
        assert(Math.abs((entry.values.value ?? 0) - 81.6466266) < 0.0001, "expected lb sample to store canonical kg");

        resource.meta = resource.meta ?? {};
        resource.meta.extension = [
            ...(resource.meta.extension ?? []),
            { url: RECORDED_BY_ROLE_URL, valueCode: "patient" },
        ];
        stored.set(id, resource);

        const repeated = await importExternalHealthSamples(
            [olderSample, sample],
            [makeDefinition(weightBase, "Gewicht")],
            {
                activePatientId: "patient-1",
                get: async (_resourceType, resourceId) => {
                    const resource = stored.get(resourceId);
                    return resource ? { resource, deleted: false, updated_at: resource.meta?.lastUpdated ?? "" } : null;
                },
                upsert: async (_resourceType, resourceId, resource) => {
                    stored.set(resourceId, resource);
                },
            }
        );
        assert(repeated.imported === 0, "expected repeated import to create no new resources");
        assert(repeated.updated === 0, "expected repeated import to update no resources");
        assert(repeated.unchanged === 1, "expected repeated import to count the existing resource as unchanged");

        const changedSample = {
            ...sample,
            values: { value: 181 },
        };
        const changed = await importExternalHealthSamples(
            [olderSample, changedSample],
            [makeDefinition(weightBase, "Gewicht")],
            {
                activePatientId: "patient-1",
                get: async (_resourceType, resourceId) => {
                    const resource = stored.get(resourceId);
                    return resource ? { resource, deleted: false, updated_at: resource.meta?.lastUpdated ?? "" } : null;
                },
                upsert: async (_resourceType, resourceId, resource) => {
                    stored.set(resourceId, resource);
                },
            }
        );
        assert(changed.imported === 0, "expected changed existing sample to create no new resource");
        assert(changed.updated === 1, "expected changed existing sample to be updated");
    }
}

function makeDefinition(base: any, name: string): MetricDefinition {
    return {
        ...base,
        name,
        description: name,
        fields: base.fields.map((field: any) => ({
            ...field,
            label: field.key,
        })),
    } as MetricDefinition;
}

function makeMedication(
    id: string,
    name: string,
    form: MedicationItem["form"],
    externalHealth?: MedicationItem["externalHealth"]
): MedicationItem {
    return {
        id,
        name,
        form,
        schedule: { type: "daily", times: ["08:00"] },
        duration: { startDate: "2026-06-01T00:00:00.000Z" },
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
        isActive: true,
        externalHealth,
    };
}

function makeAppleMedication(
    identifier: string,
    displayText: string,
    generalForm: string,
    hasSchedule: boolean,
    isArchived = false,
    nickname?: string
): AppleHealthMedicationRecord {
    return {
        isArchived,
        hasSchedule,
        nickname,
        medication: {
            identifier,
            displayText,
            generalForm,
        },
    };
}
