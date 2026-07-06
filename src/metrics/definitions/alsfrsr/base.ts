/**
 * ALSFRS-R (ALS Functional Rating Scale - Revised) - Computed Metric
 *
 * This is a computed metric that displays ALSFRS-R questionnaire results.
 * The data comes from the questionnaire system, not from direct metric entries.
 */

import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'alsfrs-r',
    icon: 'waveform.path.ecg',
    iconColor: '#5856D6',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '67740-9',
            display: 'ALSFRS-R total score',
        },
        category: 'survey',
    },
    fields: [], // Computed metrics have no input fields
    defaultUnit: 'Punkte',
    chart: {
        type: 'line',
        showChart: false, // Chart is shown on detail page
        showAverage: false,
    },
    canPin: true,
    defaultPinned: true,
    defaultPinnedOrder: 0, // First position by default
    sortOrder: 0,
    category: 'assessment',
    computed: true,
};
