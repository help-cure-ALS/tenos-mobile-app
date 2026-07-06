import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { PdfExportOptions } from './types';
import { buildPdfHtml } from './buildPdfHtml';

export async function exportPdfToShareSheet(options: PdfExportOptions): Promise<void> {
    const html = buildPdfHtml(options);
    const { uri } = await Print.printToFileAsync({
        html,
        width: 595,   // A4 width in points
        height: 842,  // A4 height in points
    });
    await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
    });
}
