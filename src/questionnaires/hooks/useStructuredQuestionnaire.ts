import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAppSync } from '@/src/context/AppSyncProvider';
import { useFhirRepo } from '@/src/hooks/useFhirRepo';
import { emit, on } from '@/src/lib/bus';
import { getQuestionnaireDefinition } from '@/src/questionnaires/definitions';
import {
    fhirToStructuredQuestionnairePayload,
    structuredQuestionnaireEntryToFhir,
} from '@/src/questionnaires/fhir/structuredQuestionnaireToFhir';

export type StructuredQuestionnaireOptions<TDraft, TEntry> = {
    questionnaireId: string;
    questionnaireUrl?: string;
    syncReason: string;
    buildEntry: (draft: TDraft) => TEntry;
    getId: (entry: TEntry) => string;
    getDate: (entry: TEntry) => string;
    parseLegacyResource?: (resource: any) => TEntry | null;
    legacyResourceType?: string;
    legacyMetricTag?: string;
};

export type StructuredQuestionnaireResult<TDraft, TEntry> = {
    entries: TEntry[];
    latestEntry: TEntry | null;
    isLoading: boolean;
    saveEntry: (draft: TDraft) => Promise<void>;
    deleteEntry: (id: string) => Promise<void>;
    refresh: () => Promise<void>;
};

export function useStructuredQuestionnaire<TDraft, TEntry>({
    questionnaireId,
    questionnaireUrl,
    syncReason,
    buildEntry,
    getId,
    getDate,
    parseLegacyResource,
    legacyResourceType = 'Observation',
    legacyMetricTag,
}: StructuredQuestionnaireOptions<TDraft, TEntry>): StructuredQuestionnaireResult<TDraft, TEntry> {
    const fhirRepo = useFhirRepo();
    const { activePatientId, list, upsert, markDeleted, get } = fhirRepo;
    const { syncEnabled, fullSync } = useAppSync();
    const [entries, setEntries] = useState<TEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const buildEntryRef = useRef(buildEntry);
    const getIdRef = useRef(getId);
    const getDateRef = useRef(getDate);
    const parseLegacyResourceRef = useRef(parseLegacyResource);
    const listRef = useRef(list);
    const upsertRef = useRef(upsert);
    const markDeletedRef = useRef(markDeleted);
    const getRef = useRef(get);
    const fullSyncRef = useRef(fullSync);
    const syncEnabledRef = useRef(syncEnabled);

    buildEntryRef.current = buildEntry;
    getIdRef.current = getId;
    getDateRef.current = getDate;
    parseLegacyResourceRef.current = parseLegacyResource;
    listRef.current = list;
    upsertRef.current = upsert;
    markDeletedRef.current = markDeleted;
    getRef.current = get;
    fullSyncRef.current = fullSync;
    syncEnabledRef.current = syncEnabled;

    const definition = useMemo(
        () => getQuestionnaireDefinition(questionnaireId),
        [questionnaireId]
    );

    const canonicalUrl =
        questionnaireUrl ??
        definition?.fhir.questionnaireUrl ??
        `https://tenos.health/fhir/Questionnaire/${questionnaireId}`;

    const load = useCallback(async () => {
        if (!activePatientId) {
            setEntries([]);
            setIsLoading(false);
            return;
        }

        setIsLoading((current) => current ? current : true);
        try {
            const next = new Map<string, TEntry>();
            const qrRows = await listRef.current('QuestionnaireResponse', { tag: `q:${questionnaireId}`, limit: 500 });
            for (const row of qrRows) {
                const parsed = fhirToStructuredQuestionnairePayload<TEntry>(row.resource, questionnaireId);
                if (parsed) {
                    next.set(getIdRef.current(parsed), parsed);
                }
            }

            const parseLegacyResourceFn = parseLegacyResourceRef.current;
            if (parseLegacyResourceFn && legacyMetricTag) {
                const legacyRows = await listRef.current(legacyResourceType, {
                    metricTag: legacyMetricTag,
                    limit: 500,
                    orderBy: 'effective_date',
                });
                for (const row of legacyRows) {
                    const parsed = parseLegacyResourceFn(row.resource);
                    if (parsed && !next.has(getIdRef.current(parsed))) {
                        next.set(getIdRef.current(parsed), parsed);
                    }
                }
            }

            const parsedEntries = Array.from(next.values()).sort(
                (a, b) => new Date(getDateRef.current(b)).getTime() - new Date(getDateRef.current(a)).getTime()
            );
            setEntries((current) => (
                structuredEntriesChanged(current, parsedEntries, getIdRef.current, getDateRef.current)
                    ? parsedEntries
                    : current
            ));
        } finally {
            setIsLoading(false);
        }
    }, [
        activePatientId,
        legacyMetricTag,
        legacyResourceType,
        questionnaireId,
    ]);

    useEffect(() => {
        load();
        const off = on('fhir:changed', load);
        return () => off();
    }, [load]);

    const latestEntry = useMemo(() => entries[0] ?? null, [entries]);

    const saveEntry = useCallback(async (draft: TDraft) => {
        if (!activePatientId) {
            throw new Error('No active patient selected');
        }

        const entry = buildEntryRef.current(draft);
        const id = getIdRef.current(entry);
        const fhir = structuredQuestionnaireEntryToFhir({
            id,
            questionnaireId,
            questionnaireUrl: canonicalUrl,
            authored: getDateRef.current(entry),
            payload: entry,
            subjectReference: `Patient/${activePatientId}`,
        });
        await upsertRef.current('QuestionnaireResponse', id, fhir, fhir.meta?.lastUpdated, `q:${questionnaireId}`);
        emit('fhir:changed');
        if (syncEnabledRef.current) {
            fullSyncRef.current(`${syncReason} save`).catch(console.error);
        }
    }, [
        activePatientId,
        canonicalUrl,
        questionnaireId,
        syncReason,
    ]);

    const deleteEntry = useCallback(async (id: string) => {
        const current = await getRef.current('QuestionnaireResponse', id);
        if (current) {
            await markDeletedRef.current('QuestionnaireResponse', id);
        }

        if (parseLegacyResourceRef.current) {
            const legacy = await getRef.current(legacyResourceType, id);
            if (legacy) {
                await markDeletedRef.current(legacyResourceType, id);
            }
        }

        emit('fhir:changed');
        if (syncEnabledRef.current) {
            fullSyncRef.current(`${syncReason} delete`).catch(console.error);
        }
    }, [legacyResourceType, syncReason]);

    return {
        entries,
        latestEntry,
        isLoading,
        saveEntry,
        deleteEntry,
        refresh: load,
    };
}

function structuredEntriesChanged<TEntry>(
    current: TEntry[],
    next: TEntry[],
    getId: (entry: TEntry) => string,
    getDate: (entry: TEntry) => string
): boolean {
    if (current.length !== next.length) {
        return true;
    }

    for (let i = 0; i < current.length; i += 1) {
        if (getId(current[i]) !== getId(next[i])) {
            return true;
        }
        if (getDate(current[i]) !== getDate(next[i])) {
            return true;
        }
    }

    return false;
}
