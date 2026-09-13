/**
 * Shared article state — one fetch for the tab bar (visibility +
 * unread badge) and the news screen. Mounted once in app/_layout.tsx
 * next to StudiesProvider.
 */

import React, { createContext, useContext } from 'react';
import { useContent, type UseContentResult } from './useContent';

const ContentContext = createContext<UseContentResult | null>(null);

export function ContentProvider({ children }: { children: React.ReactNode }) {
    const value = useContent();
    return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContentContext(): UseContentResult {
    const ctx = useContext(ContentContext);
    if (!ctx) throw new Error('useContentContext must be used within <ContentProvider>');
    return ctx;
}
