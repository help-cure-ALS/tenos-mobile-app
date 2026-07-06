import type { PatientPreferences } from "../../src/stores/patientPreferencesStore";
import { buildResearchSelection } from "../../src/services/researchDonation/selection";

type TestCase = {
    name: string;
    fn: () => void;
};

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

function makePrefs(overrides: Partial<PatientPreferences>): PatientPreferences {
    const now = "2026-03-11T00:00:00.000Z";
    return {
        version: 1,
        metrics: {},
        updatedAt: now,
        ...overrides,
    };
}

export function runResearchDonationSelectionUnitTests(): void {
    const tests: TestCase[] = [
        {
            name: "returns null when nothing is shared with research",
            fn: () => {
                const prefs = makePrefs({
                    metrics: {
                        weight: { shareWith: ["doctor"] },
                        tdee: { shareWith: ["caregiver"] },
                    },
                    sharing: { questionnaires: ["doctor"] },
                });

                const selection = buildResearchSelection(prefs);
                assert(selection === null, "expected null selection");
            },
        },
        {
            name: "includes only metrics explicitly shared with research",
            fn: () => {
                const prefs = makePrefs({
                    metrics: {
                        weight: { shareWith: ["research"] },
                        tdee: { shareWith: ["doctor"] },
                        "alsfrs-r": { shareWith: ["research", "doctor"] },
                    },
                });

                const selection = buildResearchSelection(prefs);
                assert(selection !== null, "expected non-null selection");
                assert(selection.metricIds.length === 2, "expected exactly two research metrics");
                assert(selection.metricIds.includes("weight"), "expected weight in research selection");
                assert(selection.metricIds.includes("alsfrs-r"), "expected alsfrs-r in research selection");
                assert(!selection.metricIds.includes("tdee"), "did not expect tdee in research selection");
                assert(selection.categories.questionnaires === false, "questionnaires should be disabled by default");
                assert(selection.categories.medications === false, "medications must stay disabled");
                assert(selection.categories.aids === false, "aids must stay disabled");
            },
        },
        {
            name: "allows questionnaire donation when questionnaires category is shared",
            fn: () => {
                const prefs = makePrefs({
                    metrics: {},
                    sharing: {
                        questionnaires: ["research"],
                    },
                });

                const selection = buildResearchSelection(prefs);
                assert(selection !== null, "expected non-null selection");
                assert(selection.metricIds.length === 0, "expected no metric ids");
                assert(selection.categories.questionnaires === true, "expected questionnaires category enabled");
                assert(selection.categories.medications === false, "medications must stay disabled");
                assert(selection.categories.aids === false, "aids must stay disabled");
            },
        },
    ];

    for (const t of tests) {
        t.fn();
    }
}
