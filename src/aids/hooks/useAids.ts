// CRUD hook for assistive aids — mirrors useMedications pattern

import { useCallback, useEffect, useState } from 'react';
import { useFhirRepo } from '@/src/hooks/useFhirRepo';
import { emit, on } from '@/src/lib/bus';
import { aidToFhir, createAidDraft, fhirToAid } from '../fhir/aidToFhir';
import type { AidItem } from '../types';

export type UseAidsResult = {
    aids: AidItem[];
    isLoading: boolean;
    reload: () => Promise<void>;
    addAids: (inputs: Partial<AidItem>[]) => Promise<void>;
    updateAid: (id: string, updates: Partial<AidItem>) => Promise<AidItem>;
    deleteAid: (id: string) => Promise<void>;
    getAidById: (id: string) => AidItem | null;
};

export function useAids(): UseAidsResult {
    const { list, upsert, markDeleted } = useFhirRepo();

    const [aids, setAids] = useState<AidItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const reload = useCallback(async () => {
        try {
            setIsLoading(true);
            const rows = await list('DeviceRequest');
            const parsed: AidItem[] = [];
            for (const row of rows) {
                const item = fhirToAid(row.resource);
                if (item) parsed.push(item);
            }
            // Sort by creation date (newest first)
            parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setAids(parsed);
        } catch (err) {
            console.warn('useAids: failed to load aids', err);
        } finally {
            setIsLoading(false);
        }
    }, [list]);

    useEffect(() => {
        reload();
        const off = on('fhir:changed', reload);
        return () => off();
    }, [reload]);

    const addAids = useCallback(async (inputs: Partial<AidItem>[]) => {
        await Promise.all(inputs.map(input => {
            const item = createAidDraft(input);
            const fhir = aidToFhir(item);
            return upsert('DeviceRequest', fhir.id, fhir);
        }));
        emit('fhir:changed');
    }, [upsert]);

    const updateAid = useCallback(async (id: string, updates: Partial<AidItem>): Promise<AidItem> => {
        const existing = aids.find(a => a.id === id);
        if (!existing) throw new Error(`Aid not found: ${id}`);

        const updated: AidItem = {
            ...existing,
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        const fhir = aidToFhir(updated);
        await upsert('DeviceRequest', fhir.id, fhir);
        emit('fhir:changed');
        return updated;
    }, [aids, upsert]);

    const deleteAid = useCallback(async (id: string) => {
        await markDeleted('DeviceRequest', id);
        emit('fhir:changed');
    }, [markDeleted]);

    const getAidById = useCallback((id: string): AidItem | null => {
        return aids.find(a => a.id === id) ?? null;
    }, [aids]);

    return {
        aids,
        isLoading,
        reload,
        addAids,
        updateAid,
        deleteAid,
        getAidById,
    };
}
