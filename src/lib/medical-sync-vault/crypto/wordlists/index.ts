import { WORDLIST_EN } from './en';
import { WORDLIST_DE } from './de';
import { WORDLIST_ES } from './es';
import { WORDLIST_FR } from './fr';
import { WORDLIST_IT } from './it';
import { WORDLIST_PT } from './pt';

export type MnemonicLanguage = 'en' | 'de' | 'es' | 'fr' | 'it' | 'pt';

export const MNEMONIC_LANGUAGES: { code: MnemonicLanguage; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'de', label: 'Deutsch' },
    { code: 'es', label: 'Español' },
    { code: 'fr', label: 'Français' },
    { code: 'it', label: 'Italiano' },
    { code: 'pt', label: 'Português' },
];

const WORDLISTS: Record<MnemonicLanguage, readonly string[]> = {
    en: WORDLIST_EN,
    de: WORDLIST_DE,
    es: WORDLIST_ES,
    fr: WORDLIST_FR,
    it: WORDLIST_IT,
    pt: WORDLIST_PT,
};

export function getWordlist(lang: MnemonicLanguage): readonly string[] {
    return WORDLISTS[lang];
}
