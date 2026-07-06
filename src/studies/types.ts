/**
 * Study Types
 *
 * Type definitions for clinical studies/trials
 */

/** Study recruitment status */
export type StudyStatus =
    | 'recruiting'    // Actively seeking participants
    | 'enrolling'     // Enrollment open but not actively recruiting
    | 'active'        // Running, no new participants
    | 'completed'     // Study finished
    | 'paused'        // Temporarily paused
    | 'withdrawn';    // Study withdrawn/cancelled

/** Participant's enrollment status in a study */
export type ParticipantStatus =
    | 'not_enrolled'  // Not enrolled
    | 'screening'     // In screening process
    | 'enrolled'      // Actively participating
    | 'completed'     // Completed participation
    | 'withdrawn';    // Withdrew from study

/** Study phase (for clinical trials) */
export type StudyPhase =
    | 'preclinical'
    | 'phase_1'
    | 'phase_2'
    | 'phase_3'
    | 'phase_4'
    | 'observational'
    | 'registry';

/** Study type/category */
export type StudyType =
    | 'interventional'   // Drug/treatment trial
    | 'observational'    // Observation only
    | 'registry'         // Patient registry
    | 'biobank'          // Sample collection
    | 'survey'           // Questionnaire-based
    | 'device';          // Medical device trial

/** Eligibility criterion */
export type EligibilityCriterion = {
    type: 'inclusion' | 'exclusion';
    description: string;
};

/** Study center/location */
export type StudyCenter = {
    id: string;
    name: string;
    city: string;
    country: string;
    /** Contact email */
    email?: string;
    /** Contact phone */
    phone?: string;
    /** Distance from patient (calculated) */
    distanceKm?: number;
};

/** Task/activity for enrolled participants */
export type StudyTask = {
    id: string;
    title: string;
    description?: string;
    /** Task type */
    type: 'questionnaire' | 'measurement' | 'visit' | 'sample' | 'other';
    /** Due date */
    dueDate?: Date;
    /** Completed date */
    completedDate?: Date;
    /** Is task overdue */
    isOverdue?: boolean;
};

/** Study sponsor/organization */
export type StudySponsor = {
    name: string;
    type: 'pharmaceutical' | 'academic' | 'government' | 'nonprofit' | 'other';
    logo?: string;
};

/** Full study definition */
export type Study = {
    /** Unique identifier */
    id: string;

    /** Official study title */
    title: string;

    /** Short/display title */
    shortTitle?: string;

    /** Study description */
    description: string;

    /** Brief summary (for cards) */
    summary?: string;

    /** Study type */
    type: StudyType;

    /** Clinical trial phase */
    phase?: StudyPhase;

    /** Current recruitment status */
    status: StudyStatus;

    /** Primary sponsor */
    sponsor: StudySponsor;

    /** SF Symbol icon name */
    icon: string;

    /** Icon color */
    iconColor: string;

    /** Eligibility criteria (structured, English base) */
    eligibility: EligibilityCriterion[];

    /**
     * Translated eligibility criteria as flat text (from
     * `ext/eligibility-{lang}`). Only set for non-English languages
     * when a translation exists — takes precedence over `eligibility`
     * in the UI.
     */
    eligibilityText?: string;

    /**
     * True when displayed text fields come from an AI translation
     * (non-English language with at least one translated extension).
     * Drives the AI-translation notice in the detail view.
     */
    isTranslated?: boolean;

    /** Study centers/locations */
    centers: StudyCenter[];

    /** Expected duration in months */
    durationMonths?: number;

    /** Number of participants needed */
    targetParticipants?: number;

    /** Current number of participants */
    currentParticipants?: number;

    /** Start date */
    startDate?: Date;

    /** Expected end date */
    endDate?: Date;

    /** ClinicalTrials.gov identifier */
    nctId?: string;

    /** EudraCT number */
    eudraCtId?: string;

    /** Contact email for inquiries */
    contactEmail?: string;

    /** External URL for more info */
    externalUrl?: string;

    /** Tags for filtering */
    tags?: string[];
};

/** Participant's enrollment in a study */
export type StudyEnrollment = {
    /** Study ID */
    studyId: string;

    /** Participant status */
    status: ParticipantStatus;

    /** Enrollment date */
    enrolledAt?: Date;

    /** Assigned study center */
    centerId?: string;

    /** Participant ID within study */
    participantId?: string;

    /** Upcoming/pending tasks */
    tasks?: StudyTask[];

    /** Next scheduled visit/activity */
    nextActivity?: {
        title: string;
        date: Date;
    };
};

/** Study with participant's enrollment info */
export type StudyWithEnrollment = {
    study: Study;
    enrollment?: StudyEnrollment;
};

/** Status display info */
export type StudyStatusInfo = {
    label: string;
    color: string;
    icon: string;
};

/** Get display info for study status */
export function getStudyStatusInfo(status: StudyStatus): StudyStatusInfo {
    switch (status) {
        case 'recruiting':
            return { label: 'Rekrutiert', color: '#34C759', icon: 'person.badge.plus' };
        case 'enrolling':
            return { label: 'Einschreibung offen', color: '#007AFF', icon: 'door.left.hand.open' };
        case 'active':
            return { label: 'Aktiv', color: '#FF9500', icon: 'play.circle.fill' };
        case 'completed':
            return { label: 'Abgeschlossen', color: '#8E8E93', icon: 'checkmark.circle.fill' };
        case 'paused':
            return { label: 'Pausiert', color: '#FFCC00', icon: 'pause.circle.fill' };
        case 'withdrawn':
            return { label: 'Eingestellt', color: '#FF3B30', icon: 'xmark.circle.fill' };
    }
}

/** Get display info for participant status */
export function getParticipantStatusInfo(status: ParticipantStatus): StudyStatusInfo {
    switch (status) {
        case 'not_enrolled':
            return { label: 'Nicht eingeschrieben', color: '#8E8E93', icon: 'person' };
        case 'screening':
            return { label: 'Im Screening', color: '#007AFF', icon: 'person.badge.clock' };
        case 'enrolled':
            return { label: 'Teilnahme aktiv', color: '#34C759', icon: 'person.badge.check' };
        case 'completed':
            return { label: 'Abgeschlossen', color: '#8E8E93', icon: 'checkmark.seal.fill' };
        case 'withdrawn':
            return { label: 'Zurückgezogen', color: '#FF3B30', icon: 'person.badge.minus' };
    }
}

/** Get phase display label */
export function getPhaseLabel(phase: StudyPhase): string {
    switch (phase) {
        case 'preclinical':
            return 'Präklinisch';
        case 'phase_1':
            return 'Phase 1';
        case 'phase_2':
            return 'Phase 2';
        case 'phase_3':
            return 'Phase 3';
        case 'phase_4':
            return 'Phase 4';
        case 'observational':
            return 'Beobachtungsstudie';
        case 'registry':
            return 'Register';
    }
}

/** Get study type display label */
export function getStudyTypeLabel(type: StudyType): string {
    switch (type) {
        case 'interventional':
            return 'Interventionsstudie';
        case 'observational':
            return 'Beobachtungsstudie';
        case 'registry':
            return 'Patientenregister';
        case 'biobank':
            return 'Biobank';
        case 'survey':
            return 'Befragung';
        case 'device':
            return 'Medizinproduktestudie';
    }
}
