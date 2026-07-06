import type { ExportSelection } from '../../lib/fhir-export/types';
import type { PatientPreferences, ShareTarget } from '../../stores/patientPreferencesStore';

const RESEARCH_TARGET: ShareTarget = 'research';

/**
 * Build a fail-closed export selection from patient preferences.
 * Returns null when nothing is explicitly shared with research.
 */
export function buildResearchSelection(prefs: PatientPreferences): ExportSelection | null {
    const metricIds = Array.from(
        new Set(
            Object.entries(prefs.metrics)
                .filter(([, metricPrefs]) => metricPrefs.shareWith?.includes(RESEARCH_TARGET))
                .map(([metricId]) => metricId),
        ),
    );
    const questionnairesShared = prefs.sharing?.questionnaires?.includes(RESEARCH_TARGET) === true;

    if (metricIds.length === 0 && !questionnairesShared) {
        return null;
    }

    return {
        metricIds,
        categories: {
            medications: false,
            aids: false,
            questionnaires: questionnairesShared,
        },
    };
}
