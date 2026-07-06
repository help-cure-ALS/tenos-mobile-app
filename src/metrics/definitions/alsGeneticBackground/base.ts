import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'als_genetic_background',
    icon: 'atom',
    iconColor: '#AF52DE',
    fhir: {
        code: {
            system: 'https://tenos.health/fhir/CodeSystem/clinical-assessment',
            code: 'als-genetic-background',
            display: 'ALS genetic background',
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
    defaultPinned: false,
    defaultPinnedOrder: 3,
    sortOrder: 3,
    category: 'assessment',
    computed: true,
};
