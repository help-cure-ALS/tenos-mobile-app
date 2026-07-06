import type { ExternalHealthImportResult } from './types';

let inFlightImport: Promise<ExternalHealthImportResult> | null = null;

export function isExternalHealthImportInFlight(): boolean {
    return inFlightImport !== null;
}

export function runExternalHealthImportExclusive(
    run: () => Promise<ExternalHealthImportResult>
): Promise<ExternalHealthImportResult> {
    if (inFlightImport) {
        return inFlightImport;
    }

    const current = run().finally(() => {
        if (inFlightImport === current) {
            inFlightImport = null;
        }
    });
    inFlightImport = current;
    return current;
}
