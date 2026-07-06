/**
 * Todo Rule Engine
 *
 * Pure functions for evaluating todo rule conditions against patient data.
 * All evaluation is synchronous after data has been pre-loaded.
 */

import type { TodoCondition, ComparisonOperator } from '@/src/types/todoRules';
import type { QuestionnaireEntry } from '@/src/questionnaires/types';
import type { MetricEntry } from '@/src/metrics/types';

export type TodoRuleContext = {
    /** Latest questionnaire entry per questionnaire ID */
    questionnaireEntries: Map<string, QuestionnaireEntry>;
    /** Latest metric entry per metric ID */
    metricEntries: Map<string, MetricEntry>;
};

/**
 * Compare a value against a threshold using the given operator.
 */
export function compare(actual: number, operator: ComparisonOperator, threshold: number): boolean {
    switch (operator) {
        case 'lt': return actual < threshold;
        case 'lte': return actual <= threshold;
        case 'gt': return actual > threshold;
        case 'gte': return actual >= threshold;
    }
}

/**
 * Evaluate all todo rules (AND-logic).
 * Returns true only if ALL conditions match.
 * Returns false if rules is empty/undefined or any referenced data is missing.
 */
export function evaluateTodoRules(
    rules: TodoCondition[] | undefined,
    ctx: TodoRuleContext
): boolean {
    if (!rules || rules.length === 0) return false;

    return rules.every(rule => evaluateCondition(rule, ctx));
}

function evaluateCondition(condition: TodoCondition, ctx: TodoRuleContext): boolean {
    switch (condition.type) {
        case 'questionnaireDomainScore': {
            const entry = ctx.questionnaireEntries.get(condition.questionnaireId);
            if (!entry?.domainScores) return false;
            const score = entry.domainScores[condition.domainId];
            if (score === undefined) return false;
            return compare(score, condition.operator, condition.value);
        }
        case 'questionnaireTotalScore': {
            const entry = ctx.questionnaireEntries.get(condition.questionnaireId);
            if (!entry) return false;
            return compare(entry.totalScore, condition.operator, condition.value);
        }
        case 'metricValue': {
            const entry = ctx.metricEntries.get(condition.metricId);
            if (!entry) return false;
            const value = entry.values[condition.fieldKey];
            if (value === undefined) return false;
            return compare(value, condition.operator, condition.value);
        }
    }
}

/**
 * Collect all data source IDs referenced by rules for pre-loading.
 */
export function collectRuleDataSources(rules: TodoCondition[]): {
    questionnaireIds: Set<string>;
    metricIds: Set<string>;
} {
    const questionnaireIds = new Set<string>();
    const metricIds = new Set<string>();

    for (const rule of rules) {
        switch (rule.type) {
            case 'questionnaireDomainScore':
            case 'questionnaireTotalScore':
                questionnaireIds.add(rule.questionnaireId);
                break;
            case 'metricValue':
                metricIds.add(rule.metricId);
                break;
        }
    }

    return { questionnaireIds, metricIds };
}
