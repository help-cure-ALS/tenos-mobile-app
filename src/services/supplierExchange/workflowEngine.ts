// Workflow engine for policy-based status transitions
// All transition rules come from the WorkflowPolicy - no hardcoded role gates

import type { AidItem, AidStatus, AidTransitionRecord } from '@/src/aids/types';
import type { WorkflowPolicy } from './types';

type WorkflowRole = 'patient' | 'caregiver' | 'doctor';

function isWorkflowRole(role: string): role is WorkflowRole {
    return role === 'patient' || role === 'caregiver' || role === 'doctor';
}

export function canTransition(
    policy: WorkflowPolicy,
    fromStatus: AidStatus,
    toStatus: AidStatus,
    role: string,
): boolean {
    if (!isWorkflowRole(role)) return false;
    return policy.transitions.some(
        t => t.from === fromStatus && t.to === toStatus && t.allowed_roles.includes(role),
    );
}

export function getAvailableTransitions(
    policy: WorkflowPolicy,
    fromStatus: AidStatus,
    role: string,
): AidStatus[] {
    if (!isWorkflowRole(role)) return [];
    return policy.transitions
        .filter(t => t.from === fromStatus && t.allowed_roles.includes(role))
        .map(t => t.to);
}

export function executeTransition(
    aid: AidItem,
    toStatus: AidStatus,
    actor: { role: string; deviceId: string },
): AidItem {
    const record: AidTransitionRecord = {
        from: aid.status,
        to: toStatus,
        role: actor.role,
        deviceId: actor.deviceId,
        timestamp: new Date().toISOString(),
    };

    return {
        ...aid,
        status: toStatus,
        updatedAt: new Date().toISOString(),
        transitions: [...(aid.transitions ?? []), record],
    };
}

export function shouldNotifyProvider(policy: WorkflowPolicy, toStatus: AidStatus): boolean {
    return policy.notify_provider_on.includes(toStatus);
}

export function buildTransitionTicket(
    integrationId: string,
    proposalId: string | undefined,
    aidId: string,
    transition: AidTransitionRecord,
): unknown {
    return {
        integration_id: integrationId,
        proposal_id: proposalId,
        aid_id: aidId,
        from: transition.from,
        to: transition.to,
        role: transition.role,
        device_id: transition.deviceId,
        timestamp: transition.timestamp,
    };
}
