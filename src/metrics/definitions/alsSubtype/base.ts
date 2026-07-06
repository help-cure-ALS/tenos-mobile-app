import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'als_subtype',
    icon: 'figure.mind.and.body',
    iconColor: '#145C9E',
    fhir: {
        code: {
            system: 'https://tenos.health/fhir/CodeSystem/clinical-assessment',
            code: 'als-opm-classification',
            display: 'ALS OPM classification',
        },
        category: 'survey',
    },
    fields: [],
    defaultUnit: '',
    showUnit: false,
    chart: {
        type: 'line',
        showChart: false,
        showAverage: false,
    },
    canPin: true,
    sortOrder: 1,
    category: 'assessment',
    computed: true,
};
