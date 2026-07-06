import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { on } from '@/src/lib/bus';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import { useAppRole } from '@/src/context/AppRoleProvider';
import { useFhirRepo } from '@/src/hooks/useFhirRepo';
import { filterNewProposals, supplierClient } from '@/src/services/supplierExchange';
import { fhirToAid } from '@/src/aids';
import type { SupplierIntegrationMeta } from '@/src/stores/patientPreferencesStore';
import type { AidItem } from '@/src/aids/types';
import { isAssistiveAidsEnabledForRole } from '@/src/features/assistiveAidsFeature';

export type SupplierProposalCountsState = {
    supplierIntegrations: SupplierIntegrationMeta[];
    proposalCounts: Record<string, number>;
    totalProposalCount: number;
    isLoading: boolean;
    reload: () => Promise<void>;
};

const EMPTY_STATE: SupplierProposalCountsState = {
    supplierIntegrations: [],
    proposalCounts: {},
    totalProposalCount: 0,
    isLoading: true,
    reload: async () => { },
};

const DISABLED_STATE: SupplierProposalCountsState = {
    supplierIntegrations: [],
    proposalCounts: {},
    totalProposalCount: 0,
    isLoading: false,
    reload: async () => { },
};

const SupplierProposalContext = createContext<SupplierProposalCountsState>(EMPTY_STATE);

function toAidItems(rows: Array<{ resource: any }>): AidItem[] {
    const aids: AidItem[] = [];
    for (const row of rows) {
        const aid = fhirToAid(row.resource);
        if (aid) aids.push(aid);
    }
    return aids;
}

export function SupplierProposalProvider({ children }: { children: React.ReactNode }) {
    const { isDemo, role, isLoading: roleLoading } = useAppRole();
    const assistiveAidsEnabled = !roleLoading && isAssistiveAidsEnabledForRole(role);

    useEffect(() => {
        supplierClient.setDemoMode(isDemo);
    }, [isDemo]);

    if (!assistiveAidsEnabled) {
        return (
            <SupplierProposalContext.Provider value={roleLoading ? EMPTY_STATE : DISABLED_STATE}>
                {children}
            </SupplierProposalContext.Provider>
        );
    }

    return <EnabledSupplierProposalProvider>{children}</EnabledSupplierProposalProvider>;
}

function EnabledSupplierProposalProvider({ children }: { children: React.ReactNode }) {
    const { patientPreferencesStore, supplierExchangeStore } = usePatientStores();
    const { list } = useFhirRepo();

    const [isLoading, setIsLoading] = useState(true);
    const [supplierIntegrations, setSupplierIntegrations] = useState<SupplierIntegrationMeta[]>([]);
    const [proposalCounts, setProposalCounts] = useState<Record<string, number>>({});
    const reloadSeqRef = useRef(0);

    const reload = useCallback(async () => {
        const seq = ++reloadSeqRef.current;

        if (!patientPreferencesStore || !supplierExchangeStore) {
            if (seq !== reloadSeqRef.current) return;
            setSupplierIntegrations([]);
            setProposalCounts({});
            setIsLoading(false);
            return;
        }

        try {
            const integrations = await patientPreferencesStore.getSupplierIntegrations();
            const declined = await supplierExchangeStore.getDeclinedProposals();
            const aidRows = await list('DeviceRequest');
            const aids = toAidItems(aidRows);
            const counts: Record<string, number> = {};

            for (const integration of integrations.filter(i => i.active)) {
                const cached = await supplierExchangeStore.getCachedProposals(integration.id);
                counts[integration.id] = filterNewProposals(cached, aids, declined, integration.id).length;
            }

            if (seq !== reloadSeqRef.current) return;
            setSupplierIntegrations(integrations);
            setProposalCounts(counts);
        } finally {
            if (seq !== reloadSeqRef.current) return;
            setIsLoading(false);
        }
    }, [patientPreferencesStore, supplierExchangeStore, list]);

    useEffect(() => {
        void reload();
        const offFhir = on('fhir:changed', reload);
        const offPrefs = on('preferences:changed', reload);
        const offSupplier = on('supplier:changed', reload);
        return () => {
            offFhir();
            offPrefs();
            offSupplier();
        };
    }, [reload]);

    const value = useMemo<SupplierProposalCountsState>(() => {
        const totalProposalCount = Object.values(proposalCounts).reduce((sum, count) => sum + count, 0);
        return {
            supplierIntegrations,
            proposalCounts,
            totalProposalCount,
            isLoading,
            reload,
        };
    }, [supplierIntegrations, proposalCounts, isLoading, reload]);

    return (
        <SupplierProposalContext.Provider value={value}>
            {children}
        </SupplierProposalContext.Provider>
    );
}

export function useSupplierProposalCounts(): SupplierProposalCountsState {
    return useContext(SupplierProposalContext);
}
