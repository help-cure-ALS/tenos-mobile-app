import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useAssistiveAidsFeature } from '@/src/features/assistiveAidsFeature';

export function useAssistiveAidsRouteGuard(fallback: Href = '/(tabs)/(metric)') {
    const router = useRouter();
    const { isAssistiveAidsEnabled, isLoading } = useAssistiveAidsFeature();

    useFocusEffect(
        useCallback(() => {
            if (!isLoading && !isAssistiveAidsEnabled) {
                router.dismissTo(fallback);
            }
        }, [fallback, isAssistiveAidsEnabled, isLoading, router])
    );

    return {
        isAllowed: !isLoading && isAssistiveAidsEnabled,
        isLoading,
    };
}
