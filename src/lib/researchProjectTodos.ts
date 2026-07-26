/**
 * Research project todo helpers (pure functions, unit-testable).
 *
 * Active project participations influence the todo list in two ways:
 * 1. Existing todo items are annotated with a research context label
 *    ("Projekt"/"Studie") and their interval shrinks to the shortest
 *    project-requested frequency (shortest frequency wins — capturing
 *    more often satisfies every slower project).
 * 2. Individually selected instruments that have no todo item yet get
 *    one, using the project frequency (or the definition schedule).
 *    collectAll participations do NOT create new items — they only
 *    annotate and tighten existing ones.
 */
import type { ResearchProjectParticipation } from '../stores/patientPreferencesStore';

export type ResearchTodoContext = {
    projectId: string;
    title: string;
    required: boolean;
    linkedStudy: boolean;
};

export function getActiveParticipations(
    map: Record<string, ResearchProjectParticipation> | undefined,
): ResearchProjectParticipation[] {
    return Object.values(map ?? {}).filter((participation) => participation.status === 'active');
}

/** Research contexts of an instrument across all active participations. */
export function getResearchContexts(
    participations: ResearchProjectParticipation[],
    type: 'metric' | 'questionnaire',
    id: string,
): ResearchTodoContext[] {
    const key = `${type}:${id}`;
    const contexts: ResearchTodoContext[] = [];

    for (const participation of participations) {
        if (participation.collectAll) {
            contexts.push({
                projectId: participation.projectId,
                title: participation.title,
                required: Boolean(participation.collectAllSettings?.required),
                linkedStudy: Boolean(participation.linkedStudy),
            });
            continue;
        }
        const instrument = participation.instruments?.[key];
        if (instrument?.enabled) {
            contexts.push({
                projectId: participation.projectId,
                title: participation.title,
                required: instrument.required,
                linkedStudy: Boolean(participation.linkedStudy),
            });
        }
    }

    return contexts;
}

/**
 * Shortest project-requested interval for an instrument, or null when no
 * active participation requests a frequency for it.
 */
export function getProjectIntervalDays(
    participations: ResearchProjectParticipation[],
    type: 'metric' | 'questionnaire',
    id: string,
): number | null {
    const key = `${type}:${id}`;
    let shortest: number | null = null;

    for (const participation of participations) {
        let frequency: number | null | undefined;
        if (participation.collectAll) {
            frequency = participation.collectAllSettings?.frequencyDays;
        } else {
            const instrument = participation.instruments?.[key];
            if (instrument?.enabled) frequency = instrument.frequencyDays;
        }
        if (typeof frequency === 'number' && frequency > 0) {
            shortest = shortest === null ? frequency : Math.min(shortest, frequency);
        }
    }

    return shortest;
}

export type ProjectTodoDemand = {
    type: 'metric' | 'questionnaire';
    id: string;
    /** Shortest requested interval across projects (null = no frequency requested) */
    intervalDays: number | null;
    /** Earliest point the instrument becomes due (consent + startsAfterDays) */
    notBefore: number | null;
    contexts: ResearchTodoContext[];
};

/**
 * Explicit todo demands from individually selected instruments of active
 * participations (collectAll participations never create demands).
 */
export function getProjectTodoDemands(
    participations: ResearchProjectParticipation[],
): Map<string, ProjectTodoDemand> {
    const demands = new Map<string, ProjectTodoDemand>();

    for (const participation of participations) {
        if (participation.collectAll) continue;

        for (const instrument of Object.values(participation.instruments ?? {})) {
            if (!instrument.enabled) continue;

            const key = `${instrument.type}:${instrument.instrumentId}`;
            const frequency = typeof instrument.frequencyDays === 'number' && instrument.frequencyDays > 0
                ? instrument.frequencyDays
                : null;

            let notBefore: number | null = null;
            if (participation.consentedAt && typeof instrument.startsAfterDays === 'number' && instrument.startsAfterDays > 0) {
                notBefore = new Date(participation.consentedAt).getTime()
                    + instrument.startsAfterDays * 24 * 60 * 60 * 1000;
            }

            const context: ResearchTodoContext = {
                projectId: participation.projectId,
                title: participation.title,
                required: instrument.required,
                linkedStudy: Boolean(participation.linkedStudy),
            };

            const existing = demands.get(key);
            if (!existing) {
                demands.set(key, {
                    type: instrument.type,
                    id: instrument.instrumentId,
                    intervalDays: frequency,
                    notBefore,
                    contexts: [context],
                });
            } else {
                existing.contexts.push(context);
                if (frequency !== null) {
                    existing.intervalDays = existing.intervalDays === null
                        ? frequency
                        : Math.min(existing.intervalDays, frequency);
                }
                // earliest start wins so the strictest project is not delayed
                if (existing.notBefore !== null) {
                    existing.notBefore = notBefore === null ? null : Math.min(existing.notBefore, notBefore);
                }
            }
        }
    }

    return demands;
}
