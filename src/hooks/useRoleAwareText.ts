import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppRole } from '@/src/context/AppRoleProvider';

/**
 * Hook that provides role-aware text strings.
 * Returns different text based on whether the user is viewing their own data
 * (patient/demo) or someone else's data (caregiver/doctor).
 */
export function useRoleAwareText() {
    const { t } = useTranslation();
    const { role, activePatientId, getPatientAlias } = useAppRole();

    const patientName = useMemo(() => {
        if (role === 'patient' || role === 'demo' || !activePatientId) {
            return null;
        }
        const alias = getPatientAlias(activePatientId);
        return alias?.localName ?? t('roleAwareText.defaultPatientName');
    }, [role, activePatientId, getPatientAlias, t]);

    const isOwnData = role === 'patient' || role === 'demo';

    return useMemo(() => ({
        /**
         * Whether the user is viewing their own data
         */
        isOwnData,

        /**
         * The patient's display name (null if viewing own data)
         */
        patientName,

        // ──────────────────────────────────────────────────────────
        // Settings Texts
        // ──────────────────────────────────────────────────────────

        /** "Deine Gesundheitsdaten" / "Gesundheitsdaten von Max" */
        healthData: isOwnData
            ? t('roleAwareText.yourHealthData')
            : t('roleAwareText.healthDataOf', { name: patientName }),

        /** "Deine Ambulanz / Ärzte" / "Behandler von Max" */
        careProvider: isOwnData
            ? t('roleAwareText.yourCareProvider')
            : t('roleAwareText.careProviderOf', { name: patientName }),

        /** "Deine Daten" / "Daten von Max" */
        privacyData: isOwnData
            ? t('roleAwareText.yourData')
            : t('roleAwareText.dataOf', { name: patientName }),

        /** "Detailgrad deiner Gesundheitsdaten" / "Detailgrad der Gesundheitsdaten" */
        displayModeSubtitle: isOwnData
            ? t('roleAwareText.displayModeSubtitleOwn')
            : t('roleAwareText.displayModeSubtitleOther'),

        // ──────────────────────────────────────────────────────────
        // General Texts
        // ──────────────────────────────────────────────────────────

        /** "Dein Profil" / "Profil von Max" */
        profile: isOwnData
            ? t('roleAwareText.yourProfile')
            : t('roleAwareText.profileOf', { name: patientName }),

        /** "Deine Fragebögen" / "Fragebögen von Max" */
        questionnaires: isOwnData
            ? t('roleAwareText.yourQuestionnaires')
            : t('roleAwareText.questionnairesOf', { name: patientName }),

        /** "Dein Gewicht" / "Gewicht von Max" */
        weight: isOwnData
            ? t('roleAwareText.yourWeight')
            : t('roleAwareText.weightOf', { name: patientName }),

        // ──────────────────────────────────────────────────────────
        // Helper Functions
        // ──────────────────────────────────────────────────────────

        /**
         * Generic function for custom role-aware text.
         * Use translation keys with {{name}} interpolation.
         *
         * @example
         * forPatient('roleAwareText.yourNotes', 'roleAwareText.notesOf')
         * // Returns translated "Your notes" for patient
         * // Returns translated "Notes of Max" for caregiver
         */
        forPatient: (ownKey: string, otherKey: string): string =>
            isOwnData ? t(ownKey) : t(otherKey, { name: patientName ?? t('roleAwareText.defaultPatientName') }),

        /**
         * Returns possessive form using translation keys.
         * @example
         * possessive('healthData')
         * // Returns "Your health data" for patient
         * // Returns "Health data of Max" for caregiver
         */
        possessive: (noun: string): string =>
            isOwnData
                ? t('roleAwareText.your', { noun })
                : t('roleAwareText.of', { noun, name: patientName }),

    }), [isOwnData, patientName, t]);
}
