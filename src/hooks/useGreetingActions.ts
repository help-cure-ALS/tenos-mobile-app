/**
 * useGreetingActions - Calculates the highest-priority action for the GreetingBanner.
 *
 * Priority (highest first):
 *   1. Health data incomplete  → "Complete your health information"
 *   2. Due todo items          → "You have X tasks"
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { useFhirRepo } from '@/src/hooks/useFhirRepo';
import { useAppSync } from '@/src/context/AppSyncProvider';
import { useTodoItems } from '@/src/hooks/useTodoItems';
import { usePatientStores } from '@/src/context/AppSyncProvider';
import { on } from '@/src/lib/bus';

const FIRST_SYMPTOMS_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/first-symptoms-date';
const HEIGHT_EXTENSION_URL = 'http://example.org/fhir/StructureDefinition/body-height-cm';

export type GreetingAction = {
    text: string;
    onPress: () => void;
};

export function useGreetingActions(opts?: { onTodoPress?: () => void }): {
    isFirstLaunch: boolean;
    action: GreetingAction | undefined;
    hint: string | undefined;
} {
    const { t } = useTranslation();
    const router = useSafeRouter();
    const { get } = useFhirRepo();
    const { getOrCreateSubjectId } = useAppSync();
    const { patientPreferencesStore: prefsStore } = usePatientStores();

    const [isFirstLaunch, setIsFirstLaunch] = useState(false);
    const [healthDataComplete, setHealthDataComplete] = useState(true);
    const [hint, setHint] = useState<string | undefined>(undefined);

    const { items: todoItems } = useTodoItems();
    const dueCount = useMemo(() => todoItems.filter(i => i.isDue).length, [todoItems]);

    // Check first-launch flag
    useEffect(() => {
        if (!prefsStore) return;
        prefsStore.isFirstLaunchDone().then((done) => {
            if (!done) {
                setIsFirstLaunch(true);
                prefsStore.setFirstLaunchDone();
            }
        });
    }, [prefsStore]);

    // Check if we should show a verification hint (every 3rd day, only for unverified patients)
    useEffect(() => {
        if (!prefsStore) return;
        (async () => {
            const prefs = await prefsStore.getAll();
            const status = prefs.verification?.status;
            if (status === undefined || status === 'pending') {
                const daysSinceEpoch = Math.floor(Date.now() / 86400000);
                if (daysSinceEpoch % 3 === 0) {
                    setHint(t('greeting.hintVerification'));
                }
            }
        })();
    }, [prefsStore, t]);

    // Check health data completeness (birthDate, gender, height, firstSymptoms)
    const checkHealthData = useCallback(async () => {
        try {
            const patientId = await getOrCreateSubjectId();
            const row = await get('Patient', patientId);

            if (!row?.resource) {
                setHealthDataComplete(false);
                return;
            }

            const patient = row.resource;
            const hasGender = !!patient.gender;
            const hasBirthDate = !!patient.birthDate;

            const extensions = patient.extension ?? [];
            const hasHeight = extensions.some(
                (e: any) => e.url === HEIGHT_EXTENSION_URL && e.valueDecimal != null
            );
            const hasFirstSymptoms = extensions.some(
                (e: any) => e.url === FIRST_SYMPTOMS_EXTENSION_URL && !!e.valueString
            );

            setHealthDataComplete(hasGender && hasBirthDate && hasHeight && hasFirstSymptoms);
        } catch {
            // Can't check — assume complete to avoid nagging
            setHealthDataComplete(true);
        }
    }, [get, getOrCreateSubjectId]);

    useEffect(() => {
        checkHealthData();
        const off = on('fhir:changed', checkHealthData);
        return () => off();
    }, [checkHealthData]);

    const action = useMemo((): GreetingAction | undefined => {
        // Priority 1: Health data incomplete
        if (!healthDataComplete) {
            return {
                text: t('greeting.actionHealth'),
                onPress: () => router.push('/settings/profile'),
            };
        }

        // Priority 2: Due todo items
        if (dueCount > 0) {
            return {
                text: dueCount === 1
                    ? t('greeting.actionTodoOne')
                    : t('greeting.actionTodoMultiple', { count: dueCount }),
                onPress: () => opts?.onTodoPress?.(),
            };
        }

        return undefined;
    }, [healthDataComplete, dueCount, t, router, opts]);

    return { isFirstLaunch, action, hint };
}
