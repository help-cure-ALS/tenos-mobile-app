import type { ResearchProjectParticipation } from "../../src/stores/patientPreferencesStore";
import {
    getActiveParticipations,
    getProjectIntervalDays,
    getProjectTodoDemands,
    getResearchContexts,
} from "../../src/lib/researchProjectTodos";

type TestCase = {
    name: string;
    fn: () => void;
};

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

function makeParticipation(overrides: Partial<ResearchProjectParticipation>): ResearchProjectParticipation {
    return {
        projectId: "p1",
        title: "Project One",
        status: "active",
        clinicId: "clinic-1",
        updatedAt: "2026-07-01T00:00:00.000Z",
        ...overrides,
    };
}

export function runResearchProjectTodosUnitTests(): void {
    const tests: TestCase[] = [
        {
            name: "only active participations are considered",
            fn: () => {
                const map = {
                    a: makeParticipation({ projectId: "a", status: "active" }),
                    b: makeParticipation({ projectId: "b", status: "pending" }),
                    c: makeParticipation({ projectId: "c", status: "revoked" }),
                };
                const active = getActiveParticipations(map);
                assert(active.length === 1 && active[0].projectId === "a", "expected only the active participation");
            },
        },
        {
            name: "contexts include enabled instruments only",
            fn: () => {
                const participations = [
                    makeParticipation({
                        instruments: {
                            "metric:nfl": { type: "metric", instrumentId: "nfl", displayName: "NFL", required: true, enabled: true },
                            "metric:weight": { type: "metric", instrumentId: "weight", displayName: "Weight", required: false, enabled: false },
                        },
                    }),
                ];
                assert(getResearchContexts(participations, "metric", "nfl").length === 1, "nfl should have a context");
                assert(getResearchContexts(participations, "metric", "weight").length === 0, "disabled instrument must have no context");
                assert(getResearchContexts(participations, "metric", "other").length === 0, "unrelated instrument must have no context");
            },
        },
        {
            name: "collectAll participation covers every instrument",
            fn: () => {
                const participations = [
                    makeParticipation({ collectAll: true, collectAllSettings: { required: true } }),
                ];
                const contexts = getResearchContexts(participations, "metric", "anything");
                assert(contexts.length === 1, "collectAll must cover any instrument");
                assert(contexts[0].required === true, "required flag comes from collectAllSettings");
            },
        },
        {
            name: "shortest frequency wins across projects",
            fn: () => {
                const participations = [
                    makeParticipation({
                        projectId: "a",
                        instruments: {
                            "metric:nfl": { type: "metric", instrumentId: "nfl", displayName: "NFL", required: false, enabled: true, frequencyDays: 7 },
                        },
                    }),
                    makeParticipation({
                        projectId: "b",
                        instruments: {
                            "metric:nfl": { type: "metric", instrumentId: "nfl", displayName: "NFL", required: false, enabled: true, frequencyDays: 3 },
                        },
                    }),
                ];
                assert(getProjectIntervalDays(participations, "metric", "nfl") === 3, "expected shortest frequency 3");
            },
        },
        {
            name: "collectAll frequency participates in shortest-wins",
            fn: () => {
                const participations = [
                    makeParticipation({ projectId: "a", collectAll: true, collectAllSettings: { frequencyDays: 2 } }),
                    makeParticipation({
                        projectId: "b",
                        instruments: {
                            "metric:nfl": { type: "metric", instrumentId: "nfl", displayName: "NFL", required: false, enabled: true, frequencyDays: 5 },
                        },
                    }),
                ];
                assert(getProjectIntervalDays(participations, "metric", "nfl") === 2, "collectAll frequency must win");
            },
        },
        {
            name: "demands merge across projects, collectAll creates none",
            fn: () => {
                const participations = [
                    makeParticipation({ projectId: "a", collectAll: true, collectAllSettings: { frequencyDays: 1 } }),
                    makeParticipation({
                        projectId: "b",
                        instruments: {
                            "metric:nfl": { type: "metric", instrumentId: "nfl", displayName: "NFL", required: false, enabled: true, frequencyDays: 7 },
                            "questionnaire:phq9": { type: "questionnaire", instrumentId: "phq9", displayName: "PHQ-9", required: true, enabled: true, frequencyDays: 14 },
                        },
                    }),
                    makeParticipation({
                        projectId: "c",
                        instruments: {
                            "metric:nfl": { type: "metric", instrumentId: "nfl", displayName: "NFL", required: true, enabled: true, frequencyDays: 3 },
                        },
                    }),
                ];
                const demands = getProjectTodoDemands(participations);
                assert(demands.size === 2, `expected 2 demands, got ${demands.size}`);
                const nfl = demands.get("metric:nfl");
                assert(nfl !== undefined, "nfl demand missing");
                assert(nfl!.intervalDays === 3, "merged demand must use shortest frequency");
                assert(nfl!.contexts.length === 2, "nfl demand must carry both project contexts");
                const phq = demands.get("questionnaire:phq9");
                assert(phq !== undefined && phq.intervalDays === 14, "phq9 demand missing or wrong interval");
            },
        },
        {
            name: "startsAfterDays produces a notBefore gate relative to consent",
            fn: () => {
                const participations = [
                    makeParticipation({
                        consentedAt: "2026-07-01T00:00:00.000Z",
                        instruments: {
                            "metric:nfl": { type: "metric", instrumentId: "nfl", displayName: "NFL", required: false, enabled: true, frequencyDays: 7, startsAfterDays: 10 },
                        },
                    }),
                ];
                const demand = getProjectTodoDemands(participations).get("metric:nfl");
                assert(demand !== undefined, "demand missing");
                const expected = new Date("2026-07-01T00:00:00.000Z").getTime() + 10 * 24 * 60 * 60 * 1000;
                assert(demand!.notBefore === expected, "notBefore must be consent + startsAfterDays");
            },
        },
    ];

    for (const test of tests) {
        try {
            test.fn();
        } catch (error) {
            throw new Error(`researchProjectTodos: ${test.name} — ${(error as Error).message}`);
        }
    }
}
