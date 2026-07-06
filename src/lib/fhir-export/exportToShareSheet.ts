import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { FhirBundle } from './types';

export async function exportBundleToShareSheet(bundle: FhirBundle): Promise<void> {
    const json = JSON.stringify(bundle, null, 2);
    const fileName = `health-export-${new Date().toISOString().slice(0, 10)}.json`;

    const file = new File(Paths.cache, fileName);
    file.write(json);

    await Sharing.shareAsync(file.uri, {
        mimeType: 'application/fhir+json',
        UTI: 'public.json',
    });
}
