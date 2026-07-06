import { structuredOptionDescription, structuredOptionLabel } from '@/src/questionnaires/structured/structuredFieldLabels';

import type { ALSSubtypeEntry, ALSSubtypeCertainty, OpmMotorNeuronCode, OpmOnsetCode } from './types';

const QUESTIONNAIRE_ID = 'als_subtype';

export function onsetLabel(value: OpmOnsetCode | undefined, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'onsetCode', value, language);
}

export function motorNeuronLabel(value: OpmMotorNeuronCode | undefined, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'motorNeuronCode', value, language);
}

export function certaintyLabel(value: ALSSubtypeCertainty | undefined, language?: string): string {
    return structuredOptionLabel(QUESTIONNAIRE_ID, 'certainty', value, language);
}

export function stageFieldDescription(fieldId: string, value: string | undefined, language?: string): string {
    return structuredOptionDescription(QUESTIONNAIRE_ID, fieldId, value, language);
}

export function buildClassificationCode(entry: Pick<ALSSubtypeEntry, 'onsetCode' | 'propagationStatus' | 'propagationMonths' | 'propagationTimingUnknown' | 'motorNeuronCode'>): string {
    const propagationSuffix = entry.propagationStatus === 'P0'
        ? `P0(${entry.propagationMonths ?? 0})`
        : entry.propagationTimingUnknown
            ? 'P1(x)'
            : `P1(${entry.propagationMonths ?? 0})`;
    return `${entry.onsetCode}-${propagationSuffix}-${entry.motorNeuronCode}`;
}

export function formatClassificationCode(code: string): string {
    return code.replaceAll('-', ' · ');
}

export function summarizeALSSubtype(entry: ALSSubtypeEntry, language?: string): string {
    const onset = onsetLabel(entry.onsetCode, language);
    const motor = motorNeuronLabel(entry.motorNeuronCode, language);
    const isDE = language === 'de';
    const propagation = entry.propagationStatus === 'P0'
        ? (isDE
            ? `keine vertikale Ausbreitung nach ${entry.propagationMonths ?? 0} Monaten`
            : `no vertical propagation after ${entry.propagationMonths ?? 0} months`)
        : entry.propagationTimingUnknown
            ? (isDE ? 'Ausbreitung erfolgt, Zeitpunkt unklar' : 'propagation occurred, timing unclear')
            : (isDE
                ? `Ausbreitung nach ${entry.propagationMonths ?? 0} Monaten`
                : `propagation after ${entry.propagationMonths ?? 0} months`);

    return `${onset}, ${propagation}, ${motor}.`;
}
