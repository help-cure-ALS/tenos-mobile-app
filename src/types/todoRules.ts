/**
 * Todo Rule Types
 *
 * A definition carries a list of rule SETS. The todo item is shown when ANY
 * set applies (OR across sets); a set applies when its role scope matches
 * the active app role AND all of its conditions match (AND within a set).
 *
 * This allows different rules per role, e.g.:
 *
 *   todoRules: [
 *       { roles: ['doctor'], conditions: [ ...clinic thresholds... ] },
 *       { roles: ['patient'], conditions: [ ...home thresholds... ] },
 *   ]
 *
 * A set without `roles` applies to every role.
 */
import type { AppRole } from './appRole';

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

export type TodoRuleSet = {
    /**
     * Roles this set applies to. Omitted = all roles. Use to scope rules to
     * roles that can actually capture the instrument (e.g. spirometry values
     * recorded by a doctor — patients have no device for them).
     */
    roles?: AppRole[];
    /** All conditions must match (AND). An empty list never matches. */
    conditions: TodoCondition[];
};
