/**
 * Shared helpers for the research project application flow.
 *
 * The flow lives in a nested stack under app/researchProject/ (index →
 * clinic → code, plus data / privacy), presented as one modal by the
 * root stack — same structure as the settings modal, openable from
 * anywhere. These helpers hold the logic that more than one of those
 * screens needs.
 */
import type {
    ParticipationCollectAllSettings,
    ParticipationInstrument,
    ResearchProjectParticipation,
} from '@/src/stores/patientPreferencesStore';
import { deriveAnonymousResearchId } from '@/src/services/researchDonation/anonymousId';
import {
    applyForResearchProject,
    type ResearchProjectDetail,
} from '@/src/services/researchDonation/proxyClient';

/** Bus event fired when the draft instrument selection changes before an application exists. */
export const DRAFT_SELECTION_EVENT = 'researchProjects:draftSelection';

export type DraftSelectionPayload = {
    projectId: string;
    selection: Record<string, boolean>;
};

export function instrumentKey(type: 'metric' | 'questionnaire', instrumentId: string): string {
    return `${type}:${instrumentId}`;
}

/** Initial on/off selection: saved participation state wins, otherwise project defaults (required always on). */
export function buildDefaultSelection(
    project: ResearchProjectDetail,
    existing: ResearchProjectParticipation | null,
): Record<string, boolean> {
    const selection: Record<string, boolean> = {};
    for (const instrument of project.instruments) {
        const key = instrumentKey(instrument.instrument_type, instrument.instrument_id);
        const saved = existing?.instruments?.[key];
        selection[key] = instrument.required
            ? true
            : (saved ? saved.enabled : instrument.default_enabled);
    }
    return selection;
}

/** Instrument snapshot stored on the participation (drives todos and donation filtering). */
export function buildInstrumentsRecord(
    project: ResearchProjectDetail,
    selection: Record<string, boolean>,
): Record<string, ParticipationInstrument> {
    const record: Record<string, ParticipationInstrument> = {};
    for (const instrument of project.instruments) {
        const key = instrumentKey(instrument.instrument_type, instrument.instrument_id);
        record[key] = {
            type: instrument.instrument_type,
            instrumentId: instrument.instrument_id,
            displayName: instrument.display_name_snapshot,
            required: instrument.required,
            enabled: instrument.required ? true : (selection[key] ?? instrument.default_enabled),
            frequencyDays: instrument.frequency_days ?? null,
            startsAfterDays: instrument.starts_after_days ?? null,
        };
    }
    return record;
}

/** Global collection settings snapshot for collect-all projects. */
export function buildCollectAllSettings(
    project: ResearchProjectDetail,
): ParticipationCollectAllSettings | undefined {
    if (!project.collect_all) return undefined;
    const settings = project.collect_all_settings ?? {};
    return {
        required: Boolean(settings.required),
        frequencyDays: settings.frequency_days ?? null,
        startsAfterDays: settings.starts_after_days ?? null,
        includeHistory: Boolean(settings.include_history),
        historyWindowDays: settings.history_window_days ?? null,
    };
}

/** Whether the project's collection plan requests historical data. */
export function projectRequestsHistory(project: ResearchProjectDetail): boolean {
    return project.collect_all
        ? Boolean(project.collect_all_settings?.include_history)
        : project.instruments.some((instrument) => instrument.include_history);
}

/** Selection is passed between screens as a JSON route param. */
export function serializeSelection(selection: Record<string, boolean>): string {
    return JSON.stringify(selection);
}

export function parseSelectionParam(raw: string | undefined): Record<string, boolean> | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as Record<string, boolean>;
        }
    } catch {
        // fall through
    }
    return null;
}

type DonationTrackingStoreLike = {
    getState: () => Promise<{ anonymousResearchId?: string }>;
    setAnonymousResearchId: (id: string) => Promise<void>;
};

/** Resolve the stable anonymous research id (same id as used for donations). */
export async function resolveAnonymousResearchId(
    donationTrackingStore: DonationTrackingStoreLike | null,
    getOrCreateSubjectId: () => Promise<string>,
): Promise<string> {
    let anonymousResearchId = (await donationTrackingStore?.getState())?.anonymousResearchId;
    if (!anonymousResearchId) {
        const subjectId = await getOrCreateSubjectId();
        anonymousResearchId = await deriveAnonymousResearchId(subjectId);
        await donationTrackingStore?.setAnonymousResearchId(anonymousResearchId);
    }
    return anonymousResearchId;
}

/** Submit a fresh application and return the resulting pending participation. */
export async function submitProjectApplication(args: {
    project: ResearchProjectDetail;
    projectId: string;
    clinicId: string;
    clinicName?: string | null;
    verificationTokenId: string;
    anonymousResearchId: string;
    shareHistory: boolean;
    selection: Record<string, boolean>;
    locale: string;
    /** Partner account ref (partner_account forwarding projects, resolved during linking) */
    partnerAccountRef?: string;
}): Promise<ResearchProjectParticipation> {
    const { project, projectId, clinicId, clinicName, verificationTokenId,
        anonymousResearchId, shareHistory, selection, locale, partnerAccountRef } = args;

    const hasPolicy = Boolean(project.privacy_policy);
    const effectiveShareHistory = projectRequestsHistory(project) ? shareHistory : false;

    const result = await applyForResearchProject(projectId, {
        clinicId,
        verificationTokenId,
        anonymousResearchId,
        shareHistory: effectiveShareHistory,
        ...(hasPolicy ? {
            acceptedPolicyVersion: project.privacy_policy_version,
            acceptedLocale: locale,
        } : {}),
    });

    return {
        projectId,
        title: project.title,
        status: 'pending',
        clinicId,
        clinicName: clinicName ?? clinicId,
        applicationId: result.application_id,
        code: result.code,
        codeExpiresAt: result.expires_at,
        shareHistory: effectiveShareHistory,
        ...(hasPolicy ? {
            acceptedPolicyVersion: project.privacy_policy_version,
            acceptedLocale: locale,
        } : {}),
        collectAll: project.collect_all || undefined,
        collectAllSettings: buildCollectAllSettings(project),
        linkedStudy: Boolean(project.study_link) || undefined,
        instruments: buildInstrumentsRecord(project, selection),
        ...(partnerAccountRef ? { partnerAccountRef } : {}),
        updatedAt: new Date().toISOString(),
    };
}

/**
 * Direct participation without a clinic application — for projects with
 * verification_requirement 'general': the general verification token is
 * sufficient, so consent in the app completes the participation locally.
 * The server enforces the token on every donation regardless.
 */
export function buildDirectParticipation(args: {
    project: ResearchProjectDetail;
    projectId: string;
    shareHistory: boolean;
    selection: Record<string, boolean>;
    locale: string;
    partnerAccountRef?: string;
}): ResearchProjectParticipation {
    const { project, projectId, shareHistory, selection, locale, partnerAccountRef } = args;
    const hasPolicy = Boolean(project.privacy_policy);
    const effectiveShareHistory = projectRequestsHistory(project) ? shareHistory : false;

    return {
        projectId,
        title: project.title,
        status: 'active',
        clinicId: '',
        shareHistory: effectiveShareHistory,
        consentedAt: new Date().toISOString(),
        ...(hasPolicy ? {
            acceptedPolicyVersion: project.privacy_policy_version,
            acceptedLocale: locale,
        } : {}),
        collectAll: project.collect_all || undefined,
        collectAllSettings: buildCollectAllSettings(project),
        linkedStudy: Boolean(project.study_link) || undefined,
        instruments: buildInstrumentsRecord(project, selection),
        ...(partnerAccountRef ? { partnerAccountRef } : {}),
        updatedAt: new Date().toISOString(),
    };
}

/** Re-apply with the same clinic and consent data (expired-code flow on the code screen). */
export async function resubmitProjectApplication(args: {
    participation: ResearchProjectParticipation;
    verificationTokenId: string;
    anonymousResearchId: string;
    locale: string;
}): Promise<ResearchProjectParticipation> {
    const { participation, verificationTokenId, anonymousResearchId, locale } = args;
    const hasPolicy = participation.acceptedPolicyVersion != null;

    const result = await applyForResearchProject(participation.projectId, {
        clinicId: participation.clinicId,
        verificationTokenId,
        anonymousResearchId,
        shareHistory: participation.shareHistory ?? false,
        ...(hasPolicy ? {
            acceptedPolicyVersion: participation.acceptedPolicyVersion,
            acceptedLocale: locale,
        } : {}),
    });

    return {
        ...participation,
        status: 'pending',
        applicationId: result.application_id,
        code: result.code,
        codeExpiresAt: result.expires_at,
        ...(hasPolicy ? { acceptedLocale: locale } : {}),
        updatedAt: new Date().toISOString(),
    };
}
