import type { FhirBundle } from '../../fhir-export/types';

export function buildCoverSection(bundle: FhirBundle, isDE: boolean): string {
    const title = isDE ? 'Gesundheitsdaten' : 'Health Data';
    const now = new Date();
    const dateStr = now.toLocaleDateString(isDE ? 'de-DE' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
    const resourceCount = bundle.entry.length;
    const resourceLabel = isDE
        ? `${resourceCount} Ressource${resourceCount !== 1 ? 'n' : ''} exportiert`
        : `${resourceCount} resource${resourceCount !== 1 ? 's' : ''} exported`;

    return `
        <div class="cover">
            <div class="cover-title">${title}</div>
            <div class="cover-date">${dateStr}</div>
            <div class="cover-meta">${resourceLabel}</div>
        </div>
    `;
}
