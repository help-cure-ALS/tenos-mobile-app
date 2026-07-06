import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Basic, Bundle, Questionnaire } from '@medplum/fhirtypes';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { mergeMetricDefinition, type MetricDefinition } from '@/src/metrics/types';
import { mergeDefinition, type QuestionnaireDefinition } from '@/src/questionnaires/types';
import { setRemoteMetricDefinitions, clearRemoteMetricDefinitions } from '@/src/metrics/definitions';
import { setRemoteQuestionnaireDefinitions, clearRemoteQuestionnaireDefinitions } from '@/src/questionnaires/definitions';
import { getDefinitionsClient, resetDefinitionsClient } from './definitionsClient';
import { mapMetricDefinition, mapQuestionnaireDefinition } from './fhirMapping';
import { DOMAIN_SYSTEM, APP_DOMAIN } from './domainConfig';

const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;
const METRIC_CODE = 'urn:hca:definition-type|metric-definition';
const LIFECYCLE_PUBLISHED = 'urn:hca:lifecycle|published';

type DefinitionsContextValue = {
    loading: boolean;
    refreshing: boolean;
    error: string | null;
    lastSyncedAt: string | null;
    refresh: () => Promise<void>;
};

const DefinitionsContext = createContext<DefinitionsContextValue | null>(null);

function cacheKey(kind: 'metrics' | 'questionnaires' | 'fingerprint' | 'lastChecked' | 'lastSynced', language: string): string {
    return `definitions.${kind}.${language}.v1`;
}

async function readCache(language: string): Promise<{
    metrics: MetricDefinition[];
    questionnaires: QuestionnaireDefinition[];
    fingerprint: string | null;
    lastCheckedAt: string | null;
    lastSyncedAt: string | null;
}> {
    const [metricsJson, questionnairesJson, fingerprint, lastCheckedAt, lastSyncedAt] = await Promise.all([
        AsyncStorage.getItem(cacheKey('metrics', language)),
        AsyncStorage.getItem(cacheKey('questionnaires', language)),
        AsyncStorage.getItem(cacheKey('fingerprint', language)),
        AsyncStorage.getItem(cacheKey('lastChecked', language)),
        AsyncStorage.getItem(cacheKey('lastSynced', language)),
    ]);

    return {
        metrics: metricsJson ? (JSON.parse(metricsJson) as MetricDefinition[]) : [],
        questionnaires: questionnairesJson ? (JSON.parse(questionnairesJson) as QuestionnaireDefinition[]) : [],
        fingerprint,
        lastCheckedAt,
        lastSyncedAt,
    };
}

async function writeCache(
    language: string,
    data: {
        metrics: MetricDefinition[];
        questionnaires: QuestionnaireDefinition[];
        fingerprint: string;
        checkedAt: string;
        syncedAt: string;
    }
): Promise<void> {
    await Promise.all([
        AsyncStorage.setItem(cacheKey('metrics', language), JSON.stringify(data.metrics)),
        AsyncStorage.setItem(cacheKey('questionnaires', language), JSON.stringify(data.questionnaires)),
        AsyncStorage.setItem(cacheKey('fingerprint', language), data.fingerprint),
        AsyncStorage.setItem(cacheKey('lastChecked', language), data.checkedAt),
        AsyncStorage.setItem(cacheKey('lastSynced', language), data.syncedAt),
    ]);
}

async function fetchFingerprint(language: string): Promise<string> {
    const client = await getDefinitionsClient();

    const [metricCountBundle, metricLatestBundle, questionnaireCountBundle, questionnaireLatestBundle] = await Promise.all([
        client.search('Basic', {
            code: METRIC_CODE,
            _tag: LIFECYCLE_PUBLISHED,
            _summary: 'count',
        }) as Promise<Bundle<Basic>>,
        client.search('Basic', {
            code: METRIC_CODE,
            _tag: LIFECYCLE_PUBLISHED,
            _count: '1',
            _sort: '-_lastUpdated',
        }) as Promise<Bundle<Basic>>,
        client.search('Questionnaire', {
            status: 'active',
            _summary: 'count',
        }) as Promise<Bundle<Questionnaire>>,
        client.search('Questionnaire', {
            status: 'active',
            _count: '1',
            _sort: '-_lastUpdated',
        }) as Promise<Bundle<Questionnaire>>,
    ]);

    const metricCount = metricCountBundle.total ?? 0;
    const questionnaireCount = questionnaireCountBundle.total ?? 0;
    const metricLatest = metricLatestBundle.entry?.[0]?.resource?.meta?.lastUpdated ?? '-';
    const questionnaireLatest = questionnaireLatestBundle.entry?.[0]?.resource?.meta?.lastUpdated ?? '-';

    return `m:${metricCount}:${metricLatest}|q:${questionnaireCount}:${questionnaireLatest}|lang:${language}`;
}

/**
 * Filter resources by domain: include if no domain tags (universal) or if tagged with APP_DOMAIN.
 * Client-side because FHIR _tag cannot express "has NO tag with system X".
 */
function filterByDomain<T extends { meta?: { tag?: Array<{ system?: string; code?: string }> } }>(
    resources: T[]
): T[] {
    return resources.filter((r) => {
        const domainTags = (r.meta?.tag ?? []).filter((t) => t.system === DOMAIN_SYSTEM);
        if (domainTags.length === 0) return true; // Universal
        return domainTags.some((t) => t.code === APP_DOMAIN);
    });
}

async function fetchDefinitions(language: string): Promise<{
    metrics: MetricDefinition[];
    questionnaires: QuestionnaireDefinition[];
}> {
    const client = await getDefinitionsClient();

    const [metricResources, questionnaireResources] = await Promise.all([
        client.searchResources('Basic', {
            code: METRIC_CODE,
            _tag: LIFECYCLE_PUBLISHED,
            _count: '1000',
        }) as Promise<Basic[]>,
        client.searchResources('Questionnaire', {
            status: 'active',
            _count: '1000',
        }) as Promise<Questionnaire[]>,
    ]);

    const metrics = filterByDomain(metricResources)
        .map((r) => mapMetricDefinition(r, language))
        .filter((v): v is NonNullable<typeof v> => v !== null)
        .map((v) => mergeMetricDefinition(v.base, v.locale));

    const questionnaires = filterByDomain(questionnaireResources)
        .map((r) => mapQuestionnaireDefinition(r, language))
        .filter((v): v is NonNullable<typeof v> => v !== null)
        .map((v) => mergeDefinition(v.base, v.locale));

    return { metrics, questionnaires };
}

function shouldCheckRemote(lastCheckedAt: string | null, force: boolean): boolean {
    if (force) return true;
    if (!lastCheckedAt) return true;
    return Date.now() - new Date(lastCheckedAt).getTime() >= CHECK_INTERVAL_MS;
}

function applyDefinitions(metrics: MetricDefinition[], questionnaires: QuestionnaireDefinition[]): void {
    if (metrics.length > 0) {
        setRemoteMetricDefinitions(metrics);
    } else {
        clearRemoteMetricDefinitions();
    }

    if (questionnaires.length > 0) {
        setRemoteQuestionnaireDefinitions(questionnaires);
    } else {
        clearRemoteQuestionnaireDefinitions();
    }
}

export function DefinitionsProvider({ children, language }: { children: React.ReactNode; language: string }) {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
    const mounted = useRef(true);
    const hasLoaded = useRef(false);

    const syncDefinitions = useCallback(async (force: boolean) => {
        if (!mounted.current) return;

        if (hasLoaded.current) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError(null);

        try {
            const cached = await readCache(language);

            if (!hasLoaded.current && (cached.metrics.length || cached.questionnaires.length)) {
                applyDefinitions(cached.metrics, cached.questionnaires);
                setLastSyncedAt(cached.lastSyncedAt);
                hasLoaded.current = true;
                setLoading(false);
            }

            if (!shouldCheckRemote(cached.lastCheckedAt, force)) {
                return;
            }

            const checkedAt = new Date().toISOString();
            const fingerprint = await fetchFingerprint(language);

            if (cached.fingerprint === fingerprint && !force) {
                await AsyncStorage.setItem(cacheKey('lastChecked', language), checkedAt);
                return;
            }

            const remote = await fetchDefinitions(language);
            const syncedAt = new Date().toISOString();

            if (!mounted.current) return;

            applyDefinitions(remote.metrics, remote.questionnaires);
            setLastSyncedAt(syncedAt);
            hasLoaded.current = true;

            await writeCache(language, {
                metrics: remote.metrics,
                questionnaires: remote.questionnaires,
                fingerprint,
                checkedAt,
                syncedAt,
            });
        } catch (err) {
            if (!mounted.current) return;

            setError(err instanceof Error ? err.message : String(err));
            resetDefinitionsClient();

            // Keep app usable with existing local definitions if remote fails.
            if (!hasLoaded.current) {
                clearRemoteMetricDefinitions();
                clearRemoteQuestionnaireDefinitions();
            }
        } finally {
            if (mounted.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [language]);

    useEffect(() => {
        mounted.current = true;
        hasLoaded.current = false;
        syncDefinitions(false);

        return () => {
            mounted.current = false;
        };
    }, [syncDefinitions]);

    const value: DefinitionsContextValue = {
        loading,
        refreshing,
        error,
        lastSyncedAt,
        refresh: () => syncDefinitions(true),
    };

    return React.createElement(DefinitionsContext.Provider, { value }, children);
}

export function useDefinitions(): DefinitionsContextValue {
    const ctx = useContext(DefinitionsContext);
    if (!ctx) {
        throw new Error('useDefinitions must be used within <DefinitionsProvider>');
    }
    return ctx;
}
