// Local store for supplier exchange state (NOT synced between devices)
// Tracks cursors, bundle hashes, and declined proposals per integration
// Per-patient: each patient gets their own storage key

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupplierExchangeState, SupplierExchangeStoreData, SupplierProposal } from '@/src/services/supplierExchange/types';
import { emit } from '@/src/lib/bus';

const MAX_CACHED_PROPOSALS = 200;

function storageKey(patientId: string): string {
    return `supplier_exchange_store_v1_${patientId}`;
}

async function load(key: string): Promise<SupplierExchangeStoreData> {
    try {
        const json = await AsyncStorage.getItem(key);
        if (!json) return { exchangeStates: {}, declinedProposals: [] };
        return JSON.parse(json) as SupplierExchangeStoreData;
    } catch {
        return { exchangeStates: {}, declinedProposals: [] };
    }
}

async function save(key: string, data: SupplierExchangeStoreData): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(data));
}

export type SupplierExchangeStore = ReturnType<typeof createSupplierExchangeStore>;

export function createSupplierExchangeStore(patientId: string) {
    const key = storageKey(patientId);
    const notifyChanged = () => emit('supplier:changed');

    return {
        async getExchangeState(integrationId: string): Promise<SupplierExchangeState | undefined> {
            const data = await load(key);
            return data.exchangeStates[integrationId];
        },

        async setExchangeState(state: SupplierExchangeState): Promise<void> {
            const data = await load(key);
            data.exchangeStates[state.integrationId] = state;
            await save(key, data);
            notifyChanged();
        },

        async removeExchangeState(integrationId: string): Promise<void> {
            const data = await load(key);
            delete data.exchangeStates[integrationId];
            await save(key, data);
            notifyChanged();
        },

        // Remove all data for a specific integration (exchangeState, cache, declined)
        async removeIntegrationData(integrationId: string): Promise<void> {
            const data = await load(key);
            delete data.exchangeStates[integrationId];
            if (data.cachedProposals) {
                delete data.cachedProposals[integrationId];
            }
            const prefix = `${integrationId}:`;
            data.declinedProposals = data.declinedProposals.filter(k => !k.startsWith(prefix));
            await save(key, data);
            notifyChanged();
        },

        async getDeclinedProposals(): Promise<string[]> {
            const data = await load(key);
            return data.declinedProposals;
        },

        // Composite key: integrationId:proposalId to avoid cross-integration collisions
        async addDeclinedProposal(integrationId: string, proposalId: string): Promise<void> {
            const compositeKey = `${integrationId}:${proposalId}`;
            const data = await load(key);
            if (!data.declinedProposals.includes(compositeKey)) {
                data.declinedProposals.push(compositeKey);
                await save(key, data);
                notifyChanged();
            }
        },

        async isProposalDeclined(integrationId: string, proposalId: string): Promise<boolean> {
            const compositeKey = `${integrationId}:${proposalId}`;
            const data = await load(key);
            return data.declinedProposals.includes(compositeKey);
        },

        // Merge new proposals into the persistent cache.
        // Incoming proposals overwrite existing ones with the same proposal_id
        // so updated server data (e.g. changed reason) is reflected.
        // Capped at MAX_CACHED_PROPOSALS; oldest (by created_at) are evicted first.
        async cacheProposals(integrationId: string, proposals: SupplierProposal[]): Promise<void> {
            if (proposals.length === 0) return;
            const data = await load(key);
            const cached = data.cachedProposals ?? {};
            const existing = cached[integrationId] ?? [];
            const incomingIds = new Set(proposals.map(p => p.proposal_id));
            const merged = [
                ...proposals,
                ...existing.filter(p => !incomingIds.has(p.proposal_id)),
            ];
            // Evict oldest if over limit
            if (merged.length > MAX_CACHED_PROPOSALS) {
                merged.sort((a, b) => b.created_at.localeCompare(a.created_at));
                merged.length = MAX_CACHED_PROPOSALS;
            }
            cached[integrationId] = merged;
            data.cachedProposals = cached;
            await save(key, data);
            notifyChanged();
        },

        async getCachedProposals(integrationId: string): Promise<SupplierProposal[]> {
            const data = await load(key);
            return data.cachedProposals?.[integrationId] ?? [];
        },

        // Remove a single proposal from cache (after accept/decline)
        async removeCachedProposal(integrationId: string, proposalId: string): Promise<void> {
            const data = await load(key);
            const cached = data.cachedProposals?.[integrationId];
            if (!cached) return;
            data.cachedProposals![integrationId] = cached.filter(p => p.proposal_id !== proposalId);
            await save(key, data);
            notifyChanged();
        },

        async clear(): Promise<void> {
            await AsyncStorage.removeItem(key);
            notifyChanged();
        },
    };
}

// Delete all exchange data for a specific patient (used in cleanup)
export async function deleteSupplierExchangeData(patientId: string): Promise<void> {
    await AsyncStorage.removeItem(storageKey(patientId));
}
