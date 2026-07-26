/**
 * Project-bound definition visibility.
 *
 * Definitions (metrics/questionnaires) without a project binding belong to
 * the standard data set and are visible to everyone. Definitions carrying
 * one or more research project ids (tag urn:hca:research-project on the
 * synced FHIR resource) are only visible to patients with an ACTIVE
 * participation in at least one of those projects.
 *
 * The active set is fed from the patient preferences (research project
 * participations) by AppSyncProvider and consumed by the metric and
 * questionnaire registries — the single choke point every list, todo,
 * sharing and donation path funnels through.
 */

let activeResearchProjectIds = new Set<string>();

export function setActiveResearchProjectIds(ids: string[]): void {
    activeResearchProjectIds = new Set(ids);
}

export function isDefinitionVisible(researchProjectIds?: string[]): boolean {
    if (!researchProjectIds || researchProjectIds.length === 0) {
        return true; // standard data set
    }
    return researchProjectIds.some((id) => activeResearchProjectIds.has(id));
}
