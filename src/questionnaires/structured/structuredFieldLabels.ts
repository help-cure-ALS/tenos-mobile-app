import { getQuestionnaireDefinition } from '@/src/questionnaires/definitions';
import type { QuestionnaireDefinition, StructuredFieldDefinition } from '@/src/questionnaires/types';

export function getStructuredField(
    questionnaireId: string,
    fieldId: string,
    language?: string
): StructuredFieldDefinition | undefined {
    return getQuestionnaireDefinition(questionnaireId, language)?.structuredFields?.[fieldId];
}

export function getStructuredFieldFromDefinition(
    definition: QuestionnaireDefinition | undefined,
    fieldId: string
): StructuredFieldDefinition | undefined {
    return definition?.structuredFields?.[fieldId];
}

export function structuredFieldLabel(
    questionnaireId: string,
    fieldId: string,
    language?: string,
    fallback = fieldId
): string {
    return getStructuredField(questionnaireId, fieldId, language)?.label ?? fallback;
}

export function structuredFieldLabelFromDefinition(
    definition: QuestionnaireDefinition | undefined,
    fieldId: string,
    fallback = fieldId
): string {
    return getStructuredFieldFromDefinition(definition, fieldId)?.label ?? fallback;
}

export function structuredFieldInfo(
    questionnaireId: string,
    fieldId: string,
    language?: string
): string {
    return getStructuredField(questionnaireId, fieldId, language)?.info ?? '';
}

export function structuredFieldInfoFromDefinition(
    definition: QuestionnaireDefinition | undefined,
    fieldId: string
): string {
    return getStructuredFieldFromDefinition(definition, fieldId)?.info ?? '';
}

export function structuredFieldPlaceholderFromDefinition(
    definition: QuestionnaireDefinition | undefined,
    fieldId: string,
    fallback = ''
): string {
    return getStructuredFieldFromDefinition(definition, fieldId)?.placeholder ?? fallback;
}

export function structuredOptionLabel(
    questionnaireId: string,
    fieldId: string,
    value: string | undefined,
    language?: string
): string {
    if (!value) return '';
    const option = getStructuredField(questionnaireId, fieldId, language)?.options.find((item) => item.value === value);
    return option?.label ?? value;
}

export function structuredOptionDescription(
    questionnaireId: string,
    fieldId: string,
    value: string | undefined,
    language?: string
): string {
    if (!value) return '';
    const option = getStructuredField(questionnaireId, fieldId, language)?.options.find((item) => item.value === value);
    return option?.description ?? '';
}

export function structuredOptions(
    questionnaireId: string,
    fieldId: string,
    language?: string
): Array<{ value: string; label: string; description?: string }> {
    return getStructuredField(questionnaireId, fieldId, language)?.options ?? [];
}

export function structuredOptionsFromDefinition(
    definition: QuestionnaireDefinition | undefined,
    fieldId: string
): Array<{ value: string; label: string; description?: string }> {
    return getStructuredFieldFromDefinition(definition, fieldId)?.options ?? [];
}

export function structuredOptionValuesFromDefinition<T extends string>(
    definition: QuestionnaireDefinition | undefined,
    fieldId: string,
    fallback: T[]
): T[] {
    const values = getStructuredFieldFromDefinition(definition, fieldId)?.options.map((item) => item.value as T);
    return values && values.length > 0 ? values : fallback;
}
