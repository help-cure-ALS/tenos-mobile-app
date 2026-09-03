/**
 * Todo Rule Engine
 *
 * Pure functions for evaluating todo rule sets against patient data.
 * All evaluation is synchronous after data has been pre-loaded.
 *
 * Semantics: a todo item is shown when ANY rule set applies (OR across
 * sets). A set applies when its role scope matches the active role AND all
 * of its conditions match (AND within a set). See types/todoRules.ts.
 */

import type { TodoCondition, TodoRuleSet, ComparisonOperator } from '@/src/types/todoRules';
import type { QuestionnaireEntry } from '@/src/questionnaires/types';
import type { MetricEntry } from '@/src/metrics/types';
import type { AppRole } from '@/src/types/appRole';

export type TodoRuleContext = {
    /** Latest questionnaire entry per questionnaire ID */
    questionnaireEntries: Map<string, QuestionnaireEntry>;
    /** Latest metric entry per metric ID */
    metricEntries: Map<string, MetricEntry>;
    /** Active app role for role-scoped rule sets (null while unknown) */
    role: AppRole | null;
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
 * Accept both the current rule-set shape and the LEGACY flat condition
 * list. Remote definitions authored in the research portal were stored in
 * the legacy shape — those keep evaluating as one role-agnostic set. New
 * definitions (local and portal) use TodoRuleSet[].
 */
export function normalizeTodoRules(input: unknown): TodoRuleSet[] {
    if (!Array.isArray(input) || input.length === 0) return [];

    const sets: TodoRuleSet[] = [];
    const legacyConditions: TodoCondition[] = [];

    for (const entry of input) {
        if (!entry || typeof entry !== 'object') continue;
        if (Array.isArray((entry as TodoRuleSet).conditions)) {
            sets.push(entry as TodoRuleSet);
        } else if (typeof (entry as TodoCondition).type === 'string') {
            legacyConditions.push(entry as TodoCondition);
        }
    }

    if (legacyConditions.length > 0) {
        sets.push({ conditions: legacyConditions });
    }

    return sets;
}

/**
 * Evaluate all rule sets (OR across sets, AND within a set).
 * Returns false if `ruleSets` is empty/undefined, no set matches the active
 * role, or any referenced data is missing.
 */
export function evaluateTodoRules(
    ruleSets: TodoRuleSet[] | undefined,
    ctx: TodoRuleContext
): boolean {
    const sets = normalizeTodoRules(ruleSets);
    if (sets.length === 0) return false;

    return sets.some((set) => {
        if (set.roles && (ctx.role === null || !set.roles.includes(ctx.role))) {
            return false;
        }
        if (set.conditions.length === 0) return false;
        return set.conditions.every((condition) => evaluateCondition(condition, ctx));
    });
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
 * Collect all data source IDs referenced by rule sets for pre-loading.
 */
export function collectRuleDataSources(ruleSets: TodoRuleSet[]): {
    questionnaireIds: Set<string>;
    metricIds: Set<string>;
} {
    const questionnaireIds = new Set<string>();
    const metricIds = new Set<string>();

    for (const set of normalizeTodoRules(ruleSets)) {
        for (const rule of set.conditions) {
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
    }

    return { questionnaireIds, metricIds };
}
