/**
 * Safe Router - Prevents double-tap navigation issues
 *
 * Uses a GLOBAL lock to prevent any navigation while one is in progress.
 *
 * Two ways to use:
 *
 * 1. Hook (in components):
 *    import { useSafeRouter } from '@/src/hooks/useSafeRouter';
 *    const router = useSafeRouter();
 *    router.push('/some-route');
 *
 * 2. Imperative (outside components or in callbacks):
 *    import { safeRouter } from '@/src/hooks/useSafeRouter';
 *    safeRouter.push('/some-route');
 */

import { useRouter, router as expoRouter } from 'expo-router';
import { useCallback } from 'react';
import type { ImperativeRouter } from 'expo-router';

// =============================================================================
// GLOBAL Navigation Lock (shared across all hook instances)
// =============================================================================

let lastNavigationTime = 0;
const NAVIGATION_COOLDOWN_MS = 600; // covers iOS push animation (~500ms)

function canNavigate(): boolean {
    return Date.now() - lastNavigationTime >= NAVIGATION_COOLDOWN_MS;
}

function lockNavigation(): void {
    lastNavigationTime = Date.now();
}

// =============================================================================
// Hook
// =============================================================================

export function useSafeRouter(): ImperativeRouter {
    const router = useRouter();

    const push = useCallback(
        (...args: Parameters<ImperativeRouter['push']>) => {
            if (!canNavigate()) return;
            lockNavigation();
            router.push(...args);
        },
        [router]
    );

    const replace = useCallback(
        (...args: Parameters<ImperativeRouter['replace']>) => {
            if (!canNavigate()) return;
            lockNavigation();
            router.replace(...args);
        },
        [router]
    );

    const navigate = useCallback(
        (...args: Parameters<ImperativeRouter['navigate']>) => {
            if (!canNavigate()) return;
            lockNavigation();
            router.navigate(...args);
        },
        [router]
    );

    const back = useCallback(() => {
        if (!canNavigate()) return;
        lockNavigation();
        router.back();
    }, [router]);

    const dismiss = useCallback(
        (...args: Parameters<ImperativeRouter['dismiss']>) => {
            if (!canNavigate()) return;
            lockNavigation();
            router.dismiss(...args);
        },
        [router]
    );

    const dismissAll = useCallback(() => {
        if (!canNavigate()) return;
        lockNavigation();
        router.dismissAll();
    }, [router]);

    return {
        ...router,
        push,
        replace,
        navigate,
        back,
        dismiss,
        dismissAll,
    };
}

/**
 * Manually reset the navigation lock.
 * Use this if navigation gets stuck (e.g., after an error).
 */
export function resetNavigationLock(): void {
    lastNavigationTime = 0;
}

// =============================================================================
// Imperative API (for use outside components)
// =============================================================================

/**
 * Safe router for imperative navigation (outside of components).
 *
 * Usage:
 *   import { safeRouter } from '@/src/hooks/useSafeRouter';
 *   safeRouter.push('/some-route');
 */
export const safeRouter = {
    push: (...args: Parameters<ImperativeRouter['push']>) => {
        if (!canNavigate()) return;
        lockNavigation();
        expoRouter.push(...args);
    },

    replace: (...args: Parameters<ImperativeRouter['replace']>) => {
        if (!canNavigate()) return;
        lockNavigation();
        expoRouter.replace(...args);
    },

    navigate: (...args: Parameters<ImperativeRouter['navigate']>) => {
        if (!canNavigate()) return;
        lockNavigation();
        expoRouter.navigate(...args);
    },

    back: () => {
        if (!canNavigate()) return;
        lockNavigation();
        expoRouter.back();
    },

    dismiss: (...args: Parameters<ImperativeRouter['dismiss']>) => {
        if (!canNavigate()) return;
        lockNavigation();
        expoRouter.dismiss(...args);
    },

    dismissAll: () => {
        if (!canNavigate()) return;
        lockNavigation();
        expoRouter.dismissAll();
    },

    canGoBack: () => expoRouter.canGoBack(),
    canDismiss: () => expoRouter.canDismiss(),
    setParams: (...args: Parameters<ImperativeRouter['setParams']>) => expoRouter.setParams(...args),
};
