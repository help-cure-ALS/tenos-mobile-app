// Maps proxy proposals to local filtering and AidItem creation

import type { AidItem } from '@/src/aids/types';
import type { SupplierProposal } from './types';

// Filter proposals against existing aids and declined list
// declinedProposalIds uses composite keys: "integrationId:proposalId"
export function filterNewProposals(
    proposals: SupplierProposal[],
    existingAids: AidItem[],
    declinedProposalIds: string[],
    integrationId: string,
): SupplierProposal[] {
    return proposals.filter(p => {
        // Already declined (composite key)
        const compositeKey = `${integrationId}:${p.proposal_id}`;
        if (declinedProposalIds.includes(compositeKey)) return false;
        // Already adopted as an aid (match both integrationId AND proposalId
        // to avoid cross-integration collisions)
        if (existingAids.some(a =>
            a.supplierProposalId === p.proposal_id &&
            a.supplierIntegrationId === integrationId
        )) return false;
        return true;
    });
}

// Convert an accepted proposal to a partial AidItem (for createAidDraft)
export function proposalToAidInput(
    proposal: SupplierProposal,
    integrationId: string,
): Partial<AidItem> {
    return {
        catalogId: proposal.catalog_id,
        name: proposal.name,
        category: proposal.category,
        status: 'suggested',
        source: 'supplier',
        supplierIntegrationId: integrationId,
        supplierProposalId: proposal.proposal_id,
        supplierReason: proposal.reason,
    };
}
