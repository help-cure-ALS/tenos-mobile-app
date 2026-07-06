/**
 * Todo Rule Types
 *
 * Defines conditions for conditionally showing todo items.
 * Rules use AND-logic: all conditions must match for the item to appear.
 */

export type ComparisonOperator = 'lt' | 'lte' | 'gt' | 'gte';

export type TodoCondition =
    | {
        type: 'questionnaireDomainScore';
        questionnaireId: string;
        domainId: string;
        operator: ComparisonOperator;
        value: number;
    }
    | {
        type: 'questionnaireTotalScore';
        questionnaireId: string;
        operator: ComparisonOperator;
        value: number;
    }
    | {
        type: 'metricValue';
        metricId: string;
        fieldKey: string;
        operator: ComparisonOperator;
        value: number;
    };
