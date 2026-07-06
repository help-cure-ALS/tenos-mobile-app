export const STRUCTURED_QUESTIONNAIRE_PAYLOAD_LINK_ID = 'payload';
export const STRUCTURED_QUESTIONNAIRE_ID_EXTENSION_URL = 'urn:medical-sync-vault:questionnaire-id';
export const STRUCTURED_QUESTIONNAIRE_SESSION_ID_EXTENSION_URL = 'urn:medical-sync-vault:questionnaire-session-id';

export type StructuredQuestionnaireResourceOptions<TPayload> = {
    id: string;
    questionnaireId: string;
    questionnaireUrl: string;
    authored: string;
    payload: TPayload;
    subjectReference?: string;
};

export function structuredQuestionnaireEntryToFhir<TPayload>({
    id,
    questionnaireId,
    questionnaireUrl,
    authored,
    payload,
    subjectReference,
}: StructuredQuestionnaireResourceOptions<TPayload>): any {
    const now = new Date().toISOString();
    const resource: any = {
        resourceType: 'QuestionnaireResponse',
        id,
        meta: {
            lastUpdated: now,
            extension: [
                {
                    url: STRUCTURED_QUESTIONNAIRE_ID_EXTENSION_URL,
                    valueString: questionnaireId,
                },
                {
                    url: STRUCTURED_QUESTIONNAIRE_SESSION_ID_EXTENSION_URL,
                    valueString: id,
                },
            ],
        },
        questionnaire: questionnaireUrl,
        status: 'completed',
        authored,
        item: [
            {
                linkId: STRUCTURED_QUESTIONNAIRE_PAYLOAD_LINK_ID,
                answer: [
                    {
                        valueString: JSON.stringify(payload),
                    },
                ],
            },
        ],
    };

    if (subjectReference) {
        resource.subject = { reference: subjectReference };
    }

    return resource;
}

export function fhirToStructuredQuestionnairePayload<TPayload>(
    resource: any,
    questionnaireId: string
): TPayload | null {
    if (resource?.resourceType !== 'QuestionnaireResponse') {
        return null;
    }

    const extensions = resource?.meta?.extension;
    if (Array.isArray(extensions)) {
        const resourceQuestionnaireId = extensions.find(
            (ext: any) => ext?.url === STRUCTURED_QUESTIONNAIRE_ID_EXTENSION_URL
        )?.valueString;
        if (resourceQuestionnaireId && resourceQuestionnaireId !== questionnaireId) {
            return null;
        }
    }

    const item = Array.isArray(resource.item)
        ? resource.item.find((i: any) => i?.linkId === STRUCTURED_QUESTIONNAIRE_PAYLOAD_LINK_ID)
        : undefined;
    const raw = item?.answer?.[0]?.valueString;
    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw) as TPayload;
    } catch {
        return null;
    }
}
