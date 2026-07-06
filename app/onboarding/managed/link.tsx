import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import ManagedLinkFlow from '@/src/features/managed-link/ManagedLinkFlow';

export default function ManagedLinkScreen() {
    const { existingPatientIds, expectedRole } = useLocalSearchParams<{ existingPatientIds?: string; expectedRole?: string }>();

    return (
        <ManagedLinkFlow
            context="onboarding"
            expectedRole={expectedRole === 'doctor' ? 'doctor' : 'caregiver'}
            existingPatientIds={existingPatientIds ? existingPatientIds.split(',').filter(Boolean) : []}
        />
    );
}
