import type { FhirBundle } from '../../fhir-export/types';

function getExtensionValue(extensions: any[] | undefined, url: string): string | undefined {
    if (!Array.isArray(extensions)) return undefined;
    const ext = extensions.find((e: any) => e.url === url);
    return ext?.valueString ?? ext?.valueCode ?? ext?.valueCoding?.display;
}

export function buildPatientSection(bundle: FhirBundle, isDE: boolean): string {
    const patient = bundle.entry.find(e => e.resource.resourceType === 'Patient')?.resource;
    if (!patient) return '';

    const rows: Array<{ label: string; value: string }> = [];

    // Birth date (month + year only)
    if (patient.birthDate) {
        const date = new Date(patient.birthDate);
        const formatted = date.toLocaleDateString(isDE ? 'de-DE' : 'en-US', {
            year: 'numeric',
            month: 'long',
        });
        rows.push({ label: isDE ? 'Geburtsdatum' : 'Date of birth', value: formatted });
    }

    // Gender
    if (patient.gender) {
        const genderMap: Record<string, string> = isDE
            ? { male: 'Männlich', female: 'Weiblich', other: 'Divers', unknown: 'Unbekannt' }
            : { male: 'Male', female: 'Female', other: 'Other', unknown: 'Unknown' };
        rows.push({ label: isDE ? 'Geschlecht' : 'Gender', value: genderMap[patient.gender] ?? patient.gender });
    }

    // Country from address
    if (patient.address?.[0]?.country) {
        rows.push({ label: isDE ? 'Land' : 'Country', value: patient.address[0].country });
    }

    // Extensions (ALS-specific patient data)
    const extensions = patient.extension;
    const height = getExtensionValue(extensions, 'urn:medical-sync-vault:height');
    if (height) {
        rows.push({ label: isDE ? 'Größe' : 'Height', value: `${height} cm` });
    }

    const firstSymptoms = getExtensionValue(extensions, 'urn:medical-sync-vault:first-symptoms-date');
    if (firstSymptoms) {
        const date = new Date(firstSymptoms);
        const formatted = date.toLocaleDateString(isDE ? 'de-DE' : 'en-US', {
            year: 'numeric',
            month: 'long',
        });
        rows.push({ label: isDE ? 'Erste Symptome' : 'First symptoms', value: formatted });
    }

    const diagnosisDate = getExtensionValue(extensions, 'urn:medical-sync-vault:diagnosis-date');
    if (diagnosisDate) {
        const date = new Date(diagnosisDate);
        const formatted = date.toLocaleDateString(isDE ? 'de-DE' : 'en-US', {
            year: 'numeric',
            month: 'long',
        });
        rows.push({ label: isDE ? 'Diagnose' : 'Diagnosis', value: formatted });
    }

    const cause = getExtensionValue(extensions, 'urn:medical-sync-vault:als-cause');
    if (cause) {
        rows.push({ label: isDE ? 'ALS-Ursache' : 'ALS cause', value: cause });
    }

    const onset = getExtensionValue(extensions, 'urn:medical-sync-vault:onset-region');
    if (onset) {
        rows.push({ label: isDE ? 'Onset-Region' : 'Onset region', value: onset });
    }

    const motorNeuron = getExtensionValue(extensions, 'urn:medical-sync-vault:motor-neuron');
    if (motorNeuron) {
        rows.push({ label: isDE ? 'Motorneuron' : 'Motor neuron', value: motorNeuron });
    }

    if (rows.length === 0) return '';

    const title = isDE ? 'Patientendaten' : 'Patient Data';

    const rowsHtml = rows.map(r => `
        <div class="patient-row">
            <span class="patient-label">${r.label}</span>
            <span class="patient-value">${r.value}</span>
        </div>
    `).join('');

    // Split into two columns
    const mid = Math.ceil(rows.length / 2);
    const leftRows = rows.slice(0, mid);
    const rightRows = rows.slice(mid);

    const leftHtml = leftRows.map(r => `
        <div class="patient-row">
            <span class="patient-label">${r.label}</span>
            <span class="patient-value">${r.value}</span>
        </div>
    `).join('');

    const rightHtml = rightRows.map(r => `
        <div class="patient-row">
            <span class="patient-label">${r.label}</span>
            <span class="patient-value">${r.value}</span>
        </div>
    `).join('');

    return `
        <div class="page-section avoid-break">
            <div class="section-title">${title}</div>
            <div class="patient-grid">
                <div>${leftHtml}</div>
                <div>${rightHtml}</div>
            </div>
        </div>
    `;
}
