import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'als_kings_stage',
    icon: 'chart.bar.fill',
    iconColor: '#FF9500',
    fhir: {
        code: {
            system: 'https://tenos.health/fhir/CodeSystem/clinical-assessment',
            code: 'als-kings-stage',
            display: "King's Stage",
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
    sortOrder: 3,
    category: 'assessment',
    computed: true,
};
