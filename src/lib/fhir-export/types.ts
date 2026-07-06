export type ExportSelection = {
    metricIds: string[];
    categories: {
        medications: boolean;
        aids: boolean;
        questionnaires: boolean;
    };
};

export type FhirBundle = {
    resourceType: 'Bundle';
    type: 'collection';
    timestamp: string;
    total: number;
    entry: Array<{ fullUrl: string; resource: any }>;
};
