/**
 * TDEE (Total Daily Energy Expenditure) - Computed Metric
 *
 * This is a computed metric that calculates daily calorie and water needs
 * based on patient data and ALSFRS-6 score using the Kasarskis formula.
 *
 * ALSFRS-6 questions used: swallowing (Q3), handwriting (Q4), dressing (Q6),
 * turning_in_bed (Q7), walking (Q8), dyspnea (Q10)
 */

import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'tdee',
    icon: 'flame.fill',
    iconColor: '#FF9500',
    fhir: {
        // Computed metrics don't store data in FHIR
        code: {
            system: 'http://example.org/fhir/CodeSystem/computed-metrics',
            code: 'tdee',
            display: 'Total Daily Energy Expenditure',
        },
        category: 'survey', // Not really used for computed metrics
    },
    fields: [], // Computed metrics have no input fields
    defaultUnit: 'kcal',
    chart: {
        type: 'line',
        showChart: false, // No historical data to chart
        showAverage: false,
    },
    canPin: true,
    defaultPinned: true,
    defaultPinnedOrder: 15, // After weight (10)
    sortOrder: 15,
    category: 'nutrition',
    computed: true,
};
