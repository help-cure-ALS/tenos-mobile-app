import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const verbose = process.argv.includes('--verbose');

const targetLanguages = ['de', 'en', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ro', 'tr', 'zh', 'ja'];
const currentlyAvailable = targetLanguages;
const appLocaleRoots = [
    'src/i18n/locales',
    'src/i18n/locales/legal/privacy',
    'src/i18n/locales/legal/imprint',
];
const definitionRoots = [
    'src/metrics/definitions',
    'src/questionnaires/definitions',
];
const intentionallySameValues = new Set([
    '',
    'OK',
    'ALSFRS-R',
    'Active',
    'FHIR',
    'GDPR',
    'ISO 9999',
    'SyncVault',
    '15. Contact',
    'D',
    'W',
    'M',
    '< 0.5',
    '0.5 – 1.0',
    '> 1.0',
    '12345',
    '1 application',
    '1 dose',
    '1 injection',
    '1 patch',
    '1 capsule',
    '1 spray',
    '1 tablet',
    'Account',
    'Biomarkers',
    'Capsule',
    'Capsule(s)',
    'Caregiver',
    'Cause',
    'Color',
    'Communication',
    'Contact',
    'Comfort',
    'Date',
    'Description',
    'Details',
    'Digestion',
    'Disclaimer',
    'Error',
    'FHIR Export',
    'Gel',
    'Health Import',
    'Injection',
    'Introduction',
    'Lotion',
    'Name',
    'No',
    'Note',
    'Notes',
    'Normal',
    'Notifications',
    'Nutrition',
    'Participants',
    'Patch',
    'Patient',
    'Platform',
    'Platform (iOS/Android)',
    'Privacy',
    'Questionnaires',
    'Simple',
    'Source',
    'Spray',
    'Start',
    'Status',
    'Symbol',
    'Tablet',
    'Total',
    'Type',
    'help cure ALS e.V.',
    'team@help-cure-als.org',
    'https://tenos.app',
    'Harald Hanek\nWredestrasse 21\n90431 Nürnberg',
    'Wredestrasse 21\n90431 Nürnberg\nGermany',
    'min. {{n}}',
    'ml',
    'ml (Milliliter)',
]);

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function flattenKeys(value, prefix = '') {
    if (Array.isArray(value)) {
        return value.flatMap((child, index) => {
            const next = prefix ? `${prefix}.${index}` : String(index);
            return flattenKeys(child, next);
        });
    }
    if (!value || typeof value !== 'object') return [prefix];

    return Object.entries(value).flatMap(([key, child]) => {
        const next = prefix ? `${prefix}.${key}` : key;
        return flattenKeys(child, next);
    });
}

function getValue(value, dottedKey) {
    return dottedKey.split('.').reduce((current, key) => current?.[key], value);
}

function getPlaceholders(value) {
    if (typeof value !== 'string') return [];
    return unique([...value.matchAll(/\{\{\s*[\w.]+\s*\}\}/g)].map((match) => match[0].replace(/\s+/g, '')));
}

function isIntentionallySameValue(value) {
    if (typeof value !== 'string') return false;
    return intentionallySameValues.has(value) || value.startsWith('Kimura F, et al.');
}

function unique(items) {
    return Array.from(new Set(items));
}

function collectLocaleFolders(relativeDir) {
    const fullDir = path.join(root, relativeDir);
    if (!fs.existsSync(fullDir)) return [];

    const entries = fs.readdirSync(fullDir, { withFileTypes: true });
    const hasEnLocale = entries.some((entry) => entry.isFile() && entry.name === 'en.json');
    const nested = entries
        .filter((entry) => entry.isDirectory())
        .flatMap((entry) => collectLocaleFolders(path.join(relativeDir, entry.name)));

    return hasEnLocale ? [relativeDir, ...nested] : nested;
}

function auditAppLocales() {
    const issues = [];

    for (const localeRoot of appLocaleRoots) {
        const enPath = path.join(root, localeRoot, 'en.json');
        const enJson = readJson(enPath);
        const enKeys = flattenKeys(enJson);

        const languagesToAudit = unique([
            ...currentlyAvailable,
            ...targetLanguages.filter((lang) => fs.existsSync(path.join(root, localeRoot, `${lang}.json`))),
        ]);

        for (const lang of languagesToAudit) {
            const langPath = path.join(root, localeRoot, `${lang}.json`);
            if (!fs.existsSync(langPath)) {
                issues.push(`${localeRoot}: missing ${lang}.json`);
                continue;
            }

            const langKeys = flattenKeys(readJson(langPath));
            const langJson = readJson(langPath);
            const missing = enKeys.filter((key) => !langKeys.includes(key));
            const extra = langKeys.filter((key) => !enKeys.includes(key));
            const untranslated = enKeys.filter((key) => {
                const enValue = getValue(enJson, key);
                const langValue = getValue(langJson, key);
                return typeof enValue === 'string'
                    && langValue === enValue
                    && lang !== 'en'
                    && !isIntentionallySameValue(enValue);
            });
            const placeholderIssues = enKeys.flatMap((key) => {
                const enValue = getValue(enJson, key);
                const langValue = getValue(langJson, key);
                if (typeof enValue !== 'string' || typeof langValue !== 'string') return [];

                const enPlaceholders = getPlaceholders(enValue);
                const langPlaceholders = getPlaceholders(langValue);
                const missingPlaceholders = enPlaceholders.filter((placeholder) => !langPlaceholders.includes(placeholder));
                const extraPlaceholders = langPlaceholders.filter((placeholder) => !enPlaceholders.includes(placeholder));

                if (missingPlaceholders.length === 0 && extraPlaceholders.length === 0) return [];
                return `${key}: placeholder mismatch`
                    + (missingPlaceholders.length > 0 ? ` missing ${missingPlaceholders.join(', ')}` : '')
                    + (extraPlaceholders.length > 0 ? ` extra ${extraPlaceholders.join(', ')}` : '');
            });

            if (missing.length > 0) issues.push(`${localeRoot}/${lang}.json: missing keys ${missing.join(', ')}`);
            if (extra.length > 0) issues.push(`${localeRoot}/${lang}.json: extra keys ${extra.join(', ')}`);
            if (untranslated.length > 0) issues.push(`${localeRoot}/${lang}.json: ${untranslated.length} untranslated strings match English`);
            if (placeholderIssues.length > 0) issues.push(`${localeRoot}/${lang}.json: ${placeholderIssues.length} placeholder issue(s)`);
        }

        for (const lang of targetLanguages.filter((code) => !currentlyAvailable.includes(code))) {
            const langPath = path.join(root, localeRoot, `${lang}.json`);
            if (!fs.existsSync(langPath)) issues.push(`${localeRoot}: target language ${lang}.json not created yet`);
        }
    }

    return issues;
}

function auditDefinitionLocales() {
    const folders = unique(definitionRoots.flatMap(collectLocaleFolders)).sort();
    const issues = [];
    const missingByLanguage = Object.fromEntries(targetLanguages.map((lang) => [lang, 0]));

    for (const folder of folders) {
        const indexPath = path.join(root, path.dirname(folder), 'index.ts');
        const indexSource = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';

        for (const lang of targetLanguages) {
            const langPath = path.join(root, folder, `${lang}.json`);
            if (!fs.existsSync(langPath)) {
                missingByLanguage[lang] += 1;
                issues.push(`${folder}: missing ${lang}.json`);
            }
            else if (!indexSource.includes(`./locales/${lang}.json`) || !indexSource.includes(`${lang}:`)) {
                issues.push(`${folder}: ${lang}.json exists but is not registered in index.ts`);
            }
        }
    }

    return { folders, issues, missingByLanguage };
}

const appIssues = auditAppLocales();
const { folders, issues: definitionIssues, missingByLanguage } = auditDefinitionLocales();

console.log(`Target languages: ${targetLanguages.join(', ')}`);
console.log(`Currently available app languages: ${currentlyAvailable.join(', ')}`);
console.log(`Definition locale folders: ${folders.length}`);

if (appIssues.length === 0 && definitionIssues.length === 0) {
    console.log('i18n audit passed.');
}
else {
    console.log(`\nOpen app/legal locale issues: ${appIssues.length}`);
    for (const issue of appIssues) console.log(`- ${issue}`);

    console.log(`\nOpen definition locale issues: ${definitionIssues.length}`);
    for (const [lang, count] of Object.entries(missingByLanguage)) {
        if (count > 0) console.log(`- ${lang}: ${count} missing definition locale files`);
    }

    if (verbose) {
        console.log('\nDefinition locale details:');
        for (const issue of definitionIssues) console.log(`- ${issue}`);
    }
    else if (definitionIssues.length > 0) {
        console.log('\nRun npm run i18n:audit -- --verbose for the full definition file list.');
    }
}
