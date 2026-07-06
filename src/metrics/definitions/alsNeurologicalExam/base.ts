import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'als_neurological_exam',
    icon: 'stethoscope',
    iconColor: '#145C9E',
    fhir: {
        code: {
            system: 'https://tenos.health/fhir/CodeSystem/clinical-assessment',
            code: 'als-neurological-motor-exam',
            display: 'ALS neurological motor exam',
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
    sortOrder: 2,
    category: 'assessment',
    computed: true,
};
