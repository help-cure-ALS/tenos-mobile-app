/**
 * Builds a FHIR Transaction Bundle for research donation.
 *
 * Uses POST with ifNoneExist (conditional create) for idempotency.
 * The deterministic ID is stored as an identifier on the resource.
 * Sending the same data twice = no duplicates.
 */

export const RESEARCH_IDENTIFIER_SYSTEM = 'urn:hca:research:id';

export type AnonymizedResource = {
    resourceType: string;
    id: string;
    [key: string]: any;
};

function buildResearchIdentifier(resourceType: string, deterministicId: string, existingIdentifier: any) {
    const researchIdentifier = { system: RESEARCH_IDENTIFIER_SYSTEM, value: deterministicId };

    if (resourceType === 'QuestionnaireResponse') {
        const baseIdentifier = Array.isArray(existingIdentifier)
            ? existingIdentifier.find((identifier) => identifier?.system !== RESEARCH_IDENTIFIER_SYSTEM)
            : existingIdentifier;
        return baseIdentifier ? baseIdentifier : researchIdentifier;
    }

    const existing = Array.isArray(existingIdentifier)
        ? existingIdentifier.filter((identifier) => identifier?.system !== RESEARCH_IDENTIFIER_SYSTEM)
        : existingIdentifier
            ? [existingIdentifier]
            : [];

    return [...existing, researchIdentifier];
}

/**
 * Build a FHIR transaction bundle from anonymized resources.
 * Uses conditional create (POST + ifNoneExist) to prevent duplicates.
 */
export function buildTransactionBundle(resources: AnonymizedResource[]): any {
    return {
        resourceType: 'Bundle',
        type: 'transaction',
        entry: resources.map((resource) => {
            const deterministicId = resource.id;
            // Add identifier for conditional create dedup
            const { id: _removed, ...rest } = resource;
            const resourceWithIdentifier = {
                ...rest,
                identifier: buildResearchIdentifier(resource.resourceType, deterministicId, resource.identifier),
            };

            return {
                resource: resourceWithIdentifier,
                request: {
                    method: 'POST' as const,
                    url: resource.resourceType,
                    ifNoneExist: `identifier=${RESEARCH_IDENTIFIER_SYSTEM}|${deterministicId}`,
                },
            };
        }),
    };
}
