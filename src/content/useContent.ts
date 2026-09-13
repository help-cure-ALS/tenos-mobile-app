/**
 * Articles for the news tab — fetch, audience, targeting, read state.
 *
 * The audience snapshot is built exclusively from local data (Patient
 * profile, ALSFRS-R entries, clinic verification); the care server
 * only ever sees an anonymous "give me all published articles".
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Basic } from '@medplum/fhirtypes';
import { useFhirRepo } from '../hooks/useFhirRepo';
import { usePatientStores } from '../context/AppSyncProvider';
import { useAppRole } from '../context/AppRoleProvider';
import { useStudyMatchSnapshot } from '../studies/useStudyMatchSnapshot';
import { getQuestionnaireDefinition, loadQuestionnaireEntries } from '../questionnaires';
import { on } from '../lib/bus';
import { fetchArticleResources } from './contentClient';
import { mapFhirArticle } from './fhirMapping';
import { isReadExpired, visibleArticles } from './targeting';
import type { ContentArticle, ContentAudience } from './types';

const READ_KEY = 'content:readArticleIds';
const CACHE_KEY = 'content:articleCache';

/** Local audience snapshot for the targeting evaluation. */
export function useContentAudience(): { audience: ContentAudience; isLoading: boolean } {
    const { i18n } = useTranslation();
    const { snapshot, isLoading: snapshotLoading } = useStudyMatchSnapshot();
    const { get, list, activePatientId } = useFhirRepo();
    const { patientPreferencesStore: prefsStore } = usePatientStores();
    const { role } = useAppRole();

    const [country, setCountry] = useState<string | undefined>(undefined);
    const [domains, setDomains] = useState<Record<string, number> | undefined>(undefined);
    const [verifiedClinicId, setVerifiedClinicId] = useState<string | undefined>(undefined);
    const [extrasLoading, setExtrasLoading] = useState(true);

    const loadExtras = useCallback(async () => {
        try {
            if (activePatientId) {
                const patientRow = await get('Patient', activePatientId);
                const raw = (patientRow?.resource as any)?.address?.[0]?.country;
                setCountry(typeof raw === 'string' && raw ? raw.toUpperCase() : undefined);

                const def = getQuestionnaireDefinition('alsfrs-r', i18n.language);
                if (def) {
                    const listFn = async (resourceType: string, opts?: { tag?: string }) =>
                        list(resourceType, { limit: 1000, ...opts });
                    const entries = await loadQuestionnaireEntries(def, listFn);
                    setDomains(entries[0]?.domainScores);
                }
            } else {
                setCountry(undefined);
                setDomains(undefined);
            }

            if (prefsStore) {
                const prefs = await prefsStore.getAll();
                const verification = prefs?.verification;
                setVerifiedClinicId(
                    verification?.status === 'verified' ? verification.clinicId : undefined,
                );
            } else {
                setVerifiedClinicId(undefined);
            }
        } catch {
            // Missing pieces just widen the audience — never block the tab.
        } finally {
            setExtrasLoading(false);
        }
    }, [activePatientId, get, list, prefsStore, i18n.language]);

    useEffect(() => {
        setExtrasLoading(true);
        void loadExtras();
        const off = on('fhir:changed', () => { void loadExtras(); });
        return () => off();
    }, [loadExtras]);

    const audience = useMemo<ContentAudience>(() => ({
        country,
        monthsSinceOnset: snapshot.monthsSinceOnset,
        alsfrsTotal: snapshot.alsfrsRTotal,
        alsfrsDomains: domains,
        verifiedClinicId,
        // 'demo' behaves like a patient for the news targeting.
        role: role === 'demo' ? 'patient' : role ?? undefined,
    }), [country, snapshot.monthsSinceOnset, snapshot.alsfrsRTotal, domains, verifiedClinicId, role]);

    return { audience, isLoading: snapshotLoading || extrasLoading };
}

export interface UseContentResult {
    /** Articles visible for this patient, newest window first. */
    articles: ContentArticle[];
    loading: boolean;
    refreshing: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    readIds: Set<string>;
    markRead: (articleId: string) => void;
    unreadCount: number;
}

export function useContent(): UseContentResult {
    const { i18n } = useTranslation();
    const { audience, isLoading: audienceLoading } = useContentAudience();

    const [raw, setRaw] = useState<Basic[]>([]);
    const hasFreshData = useRef(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Read dates per article id (ISO) — the date drives the
    // per-article "hide n days after reading" option.
    const [readDates, setReadDates] = useState<Record<string, string>>({});

    const load = useCallback(async (isRefresh: boolean) => {
        if (isRefresh) setRefreshing(true);
        setError(null);
        try {
            const resources = await fetchArticleResources();
            console.log(`[content] loaded ${resources.length} article(s) from care server`);
            hasFreshData.current = true;
            setRaw(resources);
            // Cache for the next app start: the tab then renders
            // immediately instead of popping in after the fetch.
            void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(resources));
        } catch (err) {
            // Surface fetch problems in the dev console — while the tab
            // is hidden the error state is otherwise invisible.
            console.warn('[content] failed to load articles:', err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        void load(false);
        // Hydrate from the last run — only until fresh data arrived.
        void AsyncStorage.getItem(CACHE_KEY).then((stored) => {
            if (!stored || hasFreshData.current) return;
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && !hasFreshData.current) setRaw(parsed);
            } catch {
                // Corrupt cache: the fetch will replace it.
            }
        });
        void AsyncStorage.getItem(READ_KEY).then((stored) => {
            if (!stored) return;
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) {
                    // Migrate the old id-array format: read date unknown,
                    // treat as read today so nothing expires retroactively.
                    const today = new Date().toISOString();
                    const migrated: Record<string, string> = {};
                    for (const id of parsed) {
                        if (typeof id === 'string') migrated[id] = today;
                    }
                    setReadDates(migrated);
                } else if (parsed && typeof parsed === 'object') {
                    const clean: Record<string, string> = {};
                    for (const [id, date] of Object.entries(parsed)) {
                        if (typeof date === 'string') clean[id] = date;
                    }
                    setReadDates(clean);
                }
            } catch {
                // Corrupt read state — start fresh.
            }
        });
    }, [load]);

    const articles = useMemo(() => {
        const mapped = raw
            .map((r) => mapFhirArticle(r, i18n.language))
            .filter((a): a is ContentArticle => a !== null);
        const visible = visibleArticles(mapped, audience)
            .filter((a) => !isReadExpired(a, readDates[a.articleId]));
        if (raw.length > 0 && visible.length === 0) {
            console.log(`[content] ${mapped.length}/${raw.length} mapped, 0 visible after targeting`, audience);
        }
        // Pinned first, then newest article date; id keeps the order
        // stable on ties.
        return visible.sort((a, b) =>
            Number(b.pinned ?? false) - Number(a.pinned ?? false)
            || b.articleDate.localeCompare(a.articleDate)
            || a.articleId.localeCompare(b.articleId));
    }, [raw, audience, i18n.language, readDates]);

    const markRead = useCallback((articleId: string) => {
        setReadDates((prev) => {
            if (prev[articleId]) return prev;
            const next = { ...prev, [articleId]: new Date().toISOString() };
            void AsyncStorage.setItem(READ_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    const readIds = useMemo(() => new Set(Object.keys(readDates)), [readDates]);

    const unreadCount = useMemo(
        () => articles.filter((a) => !readIds.has(a.articleId)).length,
        [articles, readIds],
    );

    return {
        articles,
        loading: loading || audienceLoading,
        refreshing,
        error,
        refetch: () => load(true),
        readIds,
        markRead,
        unreadCount,
    };
}
