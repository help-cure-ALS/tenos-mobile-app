import type { AppRole } from '@/src/types/appRole';
import { useAppRole } from '@/src/context/AppRoleProvider';

export type SharingCategory = 'medications' | 'aids' | 'questionnaires';

export const ALL_SHARING_CATEGORIES: readonly SharingCategory[] = ['medications', 'aids', 'questionnaires'];

const FEATURE_MODE = (process.env.EXPO_PUBLIC_FEATURE_AIDS ?? 'demo').trim().toLowerCase();

export function isAssistiveAidsEnabledForRole(role?: AppRole | null): boolean {
    if (FEATURE_MODE === 'on' || FEATURE_MODE === '1' || FEATURE_MODE === 'true') {
        return true;
    }
    if (FEATURE_MODE === 'off' || FEATURE_MODE === '0' || FEATURE_MODE === 'false') {
        return false;
    }
    return role === 'demo';
}

export function isSharingCategoryEnabled(category: SharingCategory, role?: AppRole | null): boolean {
    return category !== 'aids' || isAssistiveAidsEnabledForRole(role);
}

export function getEnabledSharingCategories(role?: AppRole | null): SharingCategory[] {
    return ALL_SHARING_CATEGORIES.filter((category) => isSharingCategoryEnabled(category, role));
}

export function withEnabledSharingCategories<T extends { key: SharingCategory }>(
    categories: readonly T[],
    role?: AppRole | null,
): T[] {
    return categories.filter((category) => isSharingCategoryEnabled(category.key, role));
}

export function useAssistiveAidsFeature(): { isAssistiveAidsEnabled: boolean; isLoading: boolean } {
    const { role, isLoading } = useAppRole();
    return {
        isAssistiveAidsEnabled: isAssistiveAidsEnabledForRole(role),
        isLoading,
    };
}
