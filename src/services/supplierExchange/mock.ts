// Mock data and mock client for supplier exchange (proxy not yet available)

import type {
    SupplierOrganization,
    SupplierProposal,
    WorkflowPolicy,
    LinkRequestDetails,
} from './types';

export const MOCK_ORGANIZATIONS: SupplierOrganization[] = [
    { id: 'org-1', name: 'Sanitaetshaus Mueller', country: 'DE', specialty: 'Rollstuehle & Mobilitaet', address: 'Hauptstr. 12, 80331 München', phone: '+49 89 123456', email: 'info@mueller-reha.de' },
    { id: 'org-2', name: 'RehaTeam Nord', country: 'DE', specialty: 'Kommunikationshilfen', address: 'Alsterweg 5, 20095 Hamburg', phone: '+49 40 987654', email: 'kontakt@rehateam-nord.de' },
    { id: 'org-3', name: 'MedTech Sued', country: 'DE', specialty: 'Atemhilfen & Beatmung', address: 'Karlstr. 8, 70173 Stuttgart', phone: '+49 711 456789', email: 'service@medtech-sued.de' },
];

export const MOCK_PROPOSALS: SupplierProposal[] = [
    {
        proposal_id: 'prop-001',
        organization_id: 'org-1',
        organization_name: 'Sanitaetshaus Mueller',
        catalog_id: undefined,
        name: 'Elektrorollstuhl',
        category: 'mobility',
        reason: 'ALSFRS Gehen = 2',
        created_at: '2026-03-01T10:00:00Z',
    },
    {
        proposal_id: 'prop-002',
        organization_id: 'org-2',
        organization_name: 'RehaTeam Nord',
        name: 'Kommunikationshilfe Tobii',
        category: 'communication',
        reason: 'Sprache zunehmend eingeschraenkt',
        created_at: '2026-03-02T14:30:00Z',
    },
    {
        proposal_id: 'prop-003',
        organization_id: 'org-1',
        organization_name: 'Sanitaetshaus Mueller',
        name: 'Duschrollstuhl',
        category: 'daily_living',
        reason: 'Transfer zunehmend schwierig',
        created_at: '2026-03-03T09:15:00Z',
    },
];

export const MOCK_WORKFLOW_POLICY: WorkflowPolicy = {
    country: 'DE',
    transitions: [
        { from: 'suggested', to: 'requested', allowed_roles: ['patient', 'caregiver', 'doctor'] },
        { from: 'requested', to: 'approved', allowed_roles: ['patient', 'caregiver', 'doctor'] },
        { from: 'requested', to: 'rejected', allowed_roles: ['patient', 'caregiver', 'doctor'] },
    ],
    notify_provider_on: ['approved'],
};

export const MOCK_LINK_REQUEST: LinkRequestDetails = {
    organization_id: 'org-1',
    organization_name: 'Sanitaetshaus Mueller',
    specialty: 'Rollstuehle & Mobilitaet',
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
};

// Simulated delay for mock API calls
const MOCK_DELAY_MS = 500;

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const mockClient = {
    async listOrganizations(country: string): Promise<SupplierOrganization[]> {
        await delay(MOCK_DELAY_MS);
        return MOCK_ORGANIZATIONS.filter(o => o.country === country);
    },

    async getRequestDetails(_token: string): Promise<LinkRequestDetails> {
        await delay(MOCK_DELAY_MS);
        return MOCK_LINK_REQUEST;
    },

    async linkCareOrg(_orgId: string, _policy: unknown, _verificationTokenId: string): Promise<{ integration_id: string; token: string }> {
        await delay(MOCK_DELAY_MS);
        const id = `int-${Date.now()}`;
        return { integration_id: id, token: `mock-token-${id}` };
    },

    async acceptPartnerRequest(
        _token: string,
        _policy: unknown,
        _verificationTokenId: string,
    ): Promise<{ integration_id: string; token: string; organization_id: string; organization_name: string }> {
        await delay(MOCK_DELAY_MS);
        const id = `int-${Date.now()}`;
        return {
            integration_id: id,
            token: `mock-token-${id}`,
            organization_id: MOCK_LINK_REQUEST.organization_id,
            organization_name: MOCK_LINK_REQUEST.organization_name,
        };
    },

    async pushBundle(_integrationId: string, _bundle: unknown): Promise<{ ok: true; accepted: number }> {
        await delay(MOCK_DELAY_MS);
        return { ok: true, accepted: 1 };
    },

    async pullProposals(_integrationId: string, _cursor?: string): Promise<{ proposals: SupplierProposal[]; cursor?: string }> {
        await delay(MOCK_DELAY_MS);
        return { proposals: MOCK_PROPOSALS, cursor: undefined };
    },

    async sendDecision(_integrationId: string, _proposalId: string, _decision: 'accepted' | 'declined'): Promise<{ ok: true }> {
        await delay(MOCK_DELAY_MS);
        return { ok: true };
    },

    async sendTransition(_integrationId: string, _ticket: unknown): Promise<{ ok: true }> {
        await delay(MOCK_DELAY_MS);
        return { ok: true };
    },

    async disconnectIntegration(_integrationId: string): Promise<{ ok: true }> {
        await delay(MOCK_DELAY_MS);
        return { ok: true };
    },

    async getWorkflowPolicy(_country: string): Promise<WorkflowPolicy> {
        await delay(MOCK_DELAY_MS);
        return MOCK_WORKFLOW_POLICY;
    },
};
