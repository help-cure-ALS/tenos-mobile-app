/**
 * useStudyFavorites Hook
 *
 * Reactive hook for managing study favorites.
 * Persisted in PatientPreferences, synced across devices via FHIR.
 */

import { useCallback, useEffect, useState } from 'react';

import { emit, on } from '@/src/lib/bus';
import { usePatientStores } from '@/src/context/AppSyncProvider';

/**
 * Emitted after a favorite was toggled and persisted. Every
 * useStudyFavorites instance listens to this — screens each hold
 * their own hook instance (list, detail), and without the event a
 * toggle in one screen would never reach the others.
 */
const FAVORITES_CHANGED = 'studyFavorites:changed';

export function useStudyFavorites() {
    const { patientPreferencesStore: store } = usePatientStores();
    const [favorites, setFavorites] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const load = useCallback(async () => {
        if (!store) { setFavorites([]); setIsLoading(false); return; }
        const favs = await store.getStudyFavorites();
        setFavorites(favs);
        setIsLoading(false);
    }, [store]);

    useEffect(() => {
        load();

        // Reload when FHIR data changes (sync from other device) or
        // when another screen's hook instance toggled a favorite.
        const offFhir = on('fhir:changed', load);
        const offLocal = on(FAVORITES_CHANGED, load);
        return () => {
            offFhir();
            offLocal();
        };
    }, [load]);

    const isFavorite = useCallback(
        (studyId: string) => favorites.includes(studyId),
        [favorites]
    );

    const toggleFavorite = useCallback(
        async (studyId: string) => {
            if (!store) return;
            // Optimistic update
            setFavorites(prev =>
                prev.includes(studyId)
                    ? prev.filter(id => id !== studyId)
                    : [...prev, studyId]
            );
            await store.toggleStudyFavorite(studyId);
            // Notify all other hook instances (they reload from the
            // store, which also reconciles this optimistic update).
            emit(FAVORITES_CHANGED);
        },
        [store]
    );

    return { favorites, isLoading, isFavorite, toggleFavorite };
}
