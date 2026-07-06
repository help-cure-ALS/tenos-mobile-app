/**
 * Studies Context & Hook
 *
 * Provides a shared cache of studies from the care server.
 * Wrap the app with <StudiesProvider> once, then use useStudies() anywhere.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { List, Organization, ResearchStudy } from '@medplum/fhirtypes';
import type { Study } from './types';
import { getCareClient, resetCareClient } from './careClient';
import { mapFhirStudy, normalizeLang } from './fhirMapping';
import { usePatientStores } from '../context/AppSyncProvider';

export type ClinicStudyInfo = {
    clinicId: string;
    clinicName: string;
    studyIds: string[];
    openStudyIds: Set<string>;
};

type StudiesContextValue = {
    studies: Study[];
    /** True on initial load (no data yet) */
    loading: boolean;
    /** True during pull-to-refresh (data already visible) */
    refreshing: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    getStudyById: (id: string) => Study | undefined;
    getAvailableStudies: () => Study[];
    /** Studies assigned to the patient's clinic */
    clinicStudies: Study[];
    /** IDs of clinic studies flagged as open for applications */
    openClinicStudyIds: Set<string>;
    /** Display name of the patient's clinic (if verified) */
    clinicName: string | null;
    /** All clinics that have study lists on the care server */
    allClinicStudies: ClinicStudyInfo[];
};

const StudiesContext = createContext<StudiesContextValue | null>(null);

/** Provider — mount once in _layout.tsx */
export function StudiesProvider({ children }: { children: React.ReactNode }) {
    const { patientPreferencesStore: prefsStore } = usePatientStores();
    const { i18n } = useTranslation();
    // Raw FHIR resources are kept in state; the app-facing Study[]
    // is derived per language below. A language switch then re-maps
    // locally without re-fetching from the care server.
    const [rawStudies, setRawStudies] = useState<ResearchStudy[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [clinicStudyIds, setClinicStudyIds] = useState<string[]>([]);
    const [openClinicStudyIds, setOpenClinicStudyIds] = useState<Set<string>>(new Set());
    const [clinicName, setClinicName] = useState<string | null>(null);
    const [allClinicStudies, setAllClinicStudies] = useState<ClinicStudyInfo[]>([]);
    const mounted = useRef(true);
    const hasLoaded = useRef(false);

    const fetchStudies = useCallback(async () => {
        // First load → full loading spinner; subsequent → pull-to-refresh spinner
        if (hasLoaded.current) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError(null);

        try {
            const client = await getCareClient();
            const resources = await client.searchResources('ResearchStudy', {
                _count: '1000',
                _sort: '-date',
            });

            if (!mounted.current) return;

            setRawStudies(resources as ResearchStudy[]);
            hasLoaded.current = true;

            // Fetch clinic-study assignments if patient is verified
            try {
                const prefs = prefsStore ? await prefsStore.getAll() : null;
                const verification = prefs?.verification;
                if (verification?.status === 'verified' && verification.clinicId) {
                    setClinicName(verification.clinicName || null);
                    const lists = await client.searchResources('List', {
                        subject: `Organization/${verification.clinicId}`,
                        code: 'http://help-cure-als.org/list-type|clinic-studies',
                    });
                    const list = (lists as List[])[0];
                    const entries = list?.entry ?? [];
                    const ids = entries
                        .map((e) => e.item?.reference?.replace('ResearchStudy/', ''))
                        .filter((id): id is string => !!id);
                    const openIds = new Set(
                        entries
                            .filter((e) => (e.flag?.coding ?? []).some(
                                (c) => c.system === 'http://help-cure-als.org/study-flag' && c.code === 'open-for-applications',
                            ))
                            .map((e) => e.item?.reference?.replace('ResearchStudy/', ''))
                            .filter((id): id is string => !!id),
                    );
                    if (mounted.current) {
                        setClinicStudyIds(ids);
                        setOpenClinicStudyIds(openIds);
                    }
                }
            } catch (err) {
                console.log('[Studies] Could not fetch clinic studies:', err instanceof Error ? err.message : err);
            }

            // Fetch ALL clinic-study lists for the clinic filter
            try {
                const allLists = await client.searchResources('List', {
                    code: 'http://help-cure-als.org/list-type|clinic-studies',
                    _count: '1000',
                });
                if (!mounted.current) return;

                const listsTyped = allLists as List[];
                // Extract unique organization IDs
                const orgIds = [...new Set(
                    listsTyped
                        .map((l) => l.subject?.reference?.replace('Organization/', ''))
                        .filter((id): id is string => !!id)
                )];

                // Fetch organization names in parallel
                const orgMap = new Map<string, string>();
                await Promise.all(
                    orgIds.map(async (orgId) => {
                        try {
                            const org = await client.readResource('Organization', orgId) as Organization;
                            orgMap.set(orgId, org.name ?? orgId);
                        } catch {
                            orgMap.set(orgId, orgId);
                        }
                    })
                );

                // Build ClinicStudyInfo for each list
                const clinicInfos: ClinicStudyInfo[] = listsTyped
                    .map((list) => {
                        const orgId = list.subject?.reference?.replace('Organization/', '');
                        if (!orgId) return null;
                        const entries = list.entry ?? [];
                        const studyIds = entries
                            .map((e) => e.item?.reference?.replace('ResearchStudy/', ''))
                            .filter((id): id is string => !!id);
                        const openStudyIds = new Set(
                            entries
                                .filter((e) => (e.flag?.coding ?? []).some(
                                    (c) => c.system === 'http://help-cure-als.org/study-flag' && c.code === 'open-for-applications',
                                ))
                                .map((e) => e.item?.reference?.replace('ResearchStudy/', ''))
                                .filter((id): id is string => !!id),
                        );
                        return {
                            clinicId: orgId,
                            clinicName: orgMap.get(orgId) ?? orgId,
                            studyIds,
                            openStudyIds,
                        };
                    })
                    .filter((info): info is ClinicStudyInfo => info !== null);

                if (mounted.current) {
                    setAllClinicStudies(clinicInfos);
                }
            } catch (err) {
                console.log('[Studies] Could not fetch all clinic study lists:', err instanceof Error ? err.message : err);
            }
        } catch (err) {
            if (!mounted.current) return;

            console.log('[Studies] Care server not reachable:', err instanceof Error ? err.message : err);
            resetCareClient();
        } finally {
            if (mounted.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [prefsStore]);

    useEffect(() => {
        mounted.current = true;
        fetchStudies();
        return () => { mounted.current = false; };
    }, [fetchStudies]);

    // Map raw FHIR resources to the app's Study type in the current
    // language (translated extensions with English fallback).
    const lang = normalizeLang(i18n.language);
    const studies = useMemo(
        () => rawStudies.map((r) => mapFhirStudy(r, lang)),
        [rawStudies, lang]
    );

    const getStudyById = useCallback(
        (id: string): Study | undefined => studies.find((s) => s.id === id),
        [studies]
    );

    const getAvailableStudies = useCallback(
        (): Study[] => studies.filter(
            (s) => s.status === 'recruiting' || s.status === 'enrolling'
        ),
        [studies]
    );

    const clinicStudies = useMemo(
        () => {
            if (clinicStudyIds.length === 0) return [];
            const idSet = new Set(clinicStudyIds);
            return studies.filter((s) => idSet.has(s.id));
        },
        [studies, clinicStudyIds]
    );

    const value: StudiesContextValue = {
        studies,
        loading,
        refreshing,
        error,
        refetch: fetchStudies,
        getStudyById,
        getAvailableStudies,
        clinicStudies,
        openClinicStudyIds,
        clinicName,
        allClinicStudies,
    };

    return React.createElement(StudiesContext.Provider, { value }, children);
}

/** Hook — use in any screen below StudiesProvider */
export function useStudies(): StudiesContextValue {
    const ctx = useContext(StudiesContext);
    if (!ctx) {
        throw new Error('useStudies must be used within a <StudiesProvider>');
    }
    return ctx;
}
