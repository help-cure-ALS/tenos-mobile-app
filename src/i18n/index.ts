import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Main translations
import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import it from './locales/it.json';
import pt from './locales/pt.json';
import nl from './locales/nl.json';
import pl from './locales/pl.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';
import ro from './locales/ro.json';
import tr from './locales/tr.json';

// Legal documents
import legalPrivacyDe from './locales/legal/privacy/de.json';
import legalPrivacyEn from './locales/legal/privacy/en.json';
import legalPrivacyFr from './locales/legal/privacy/fr.json';
import legalPrivacyEs from './locales/legal/privacy/es.json';
import legalPrivacyIt from './locales/legal/privacy/it.json';
import legalPrivacyPt from './locales/legal/privacy/pt.json';
import legalPrivacyNl from './locales/legal/privacy/nl.json';
import legalPrivacyPl from './locales/legal/privacy/pl.json';
import legalPrivacyJa from './locales/legal/privacy/ja.json';
import legalPrivacyZh from './locales/legal/privacy/zh.json';
import legalPrivacyRo from './locales/legal/privacy/ro.json';
import legalPrivacyTr from './locales/legal/privacy/tr.json';
import legalImprintDe from './locales/legal/imprint/de.json';
import legalImprintEn from './locales/legal/imprint/en.json';
import legalImprintFr from './locales/legal/imprint/fr.json';
import legalImprintEs from './locales/legal/imprint/es.json';
import legalImprintIt from './locales/legal/imprint/it.json';
import legalImprintPt from './locales/legal/imprint/pt.json';
import legalImprintNl from './locales/legal/imprint/nl.json';
import legalImprintPl from './locales/legal/imprint/pl.json';
import legalImprintJa from './locales/legal/imprint/ja.json';
import legalImprintZh from './locales/legal/imprint/zh.json';
import legalImprintRo from './locales/legal/imprint/ro.json';
import legalImprintTr from './locales/legal/imprint/tr.json';

const LANGUAGE_STORAGE_KEY = '@app_language';

export const resources = {
    en: {
        translation: en,
        'legal-privacy': legalPrivacyEn,
        'legal-imprint': legalImprintEn
    },
    de: {
        translation: de,
        'legal-privacy': legalPrivacyDe,
        'legal-imprint': legalImprintDe
    },
    fr: {
        translation: fr,
        'legal-privacy': legalPrivacyFr,
        'legal-imprint': legalImprintFr
    },
    es: {
        translation: es,
        'legal-privacy': legalPrivacyEs,
        'legal-imprint': legalImprintEs
    },
    it: {
        translation: it,
        'legal-privacy': legalPrivacyIt,
        'legal-imprint': legalImprintIt
    },
    pt: {
        translation: pt,
        'legal-privacy': legalPrivacyPt,
        'legal-imprint': legalImprintPt
    },
    nl: {
        translation: nl,
        'legal-privacy': legalPrivacyNl,
        'legal-imprint': legalImprintNl
    },
    pl: {
        translation: pl,
        'legal-privacy': legalPrivacyPl,
        'legal-imprint': legalImprintPl
    },
    ja: {
        translation: ja,
        'legal-privacy': legalPrivacyJa,
        'legal-imprint': legalImprintJa
    },
    zh: {
        translation: zh,
        'legal-privacy': legalPrivacyZh,
        'legal-imprint': legalImprintZh
    },
    ro: {
        translation: ro,
        'legal-privacy': legalPrivacyRo,
        'legal-imprint': legalImprintRo
    },
    tr: {
        translation: tr,
        'legal-privacy': legalPrivacyTr,
        'legal-imprint': legalImprintTr
    }
} as const;

export type LanguageCode = keyof typeof resources;

export const targetLanguages = [
    { code: 'de', name: 'German', nativeName: 'Deutsch' },
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'es', name: 'Spanish', nativeName: 'Español' },
    { code: 'fr', name: 'French', nativeName: 'Français' },
    { code: 'it', name: 'Italian', nativeName: 'Italiano' },
    { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
    { code: 'pl', name: 'Polish', nativeName: 'Polski' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
    { code: 'ro', name: 'Romanian', nativeName: 'Română' },
    { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
    { code: 'zh', name: 'Chinese', nativeName: '中文' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語' }
] as const;

export const supportedLanguages = [
    { code: 'de' as const, name: 'German', nativeName: 'Deutsch' },
    { code: 'en' as const, name: 'English', nativeName: 'English' },
    { code: 'es' as const, name: 'Spanish', nativeName: 'Español' },
    { code: 'fr' as const, name: 'French', nativeName: 'Français' },
    { code: 'it' as const, name: 'Italian', nativeName: 'Italiano' },
    { code: 'nl' as const, name: 'Dutch', nativeName: 'Nederlands' },
    { code: 'pl' as const, name: 'Polish', nativeName: 'Polski' },
    { code: 'pt' as const, name: 'Portuguese', nativeName: 'Português' },
    { code: 'ro' as const, name: 'Romanian', nativeName: 'Română' },
    { code: 'tr' as const, name: 'Turkish', nativeName: 'Türkçe' },
    { code: 'zh' as const, name: 'Chinese', nativeName: '中文' },
    { code: 'ja' as const, name: 'Japanese', nativeName: '日本語' }
] as const;

const getDeviceLanguage = (): LanguageCode => {
    const locale = Localization.getLocales()[0];
    const languageCode = locale?.languageCode || 'en';
    const supported = supportedLanguages.find((l) => l.code === languageCode);
    return supported ? (languageCode as LanguageCode) : 'en';
};

export const initI18n = async () => {
    try {
        const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        const language = (savedLanguage as LanguageCode) || getDeviceLanguage();

        await i18n.use(initReactI18next).init({
            showSupportNotice: false,
            resources,
            lng: language,
            fallbackLng: 'en',
            ns: ['translation', 'legal-privacy', 'legal-imprint'],
            defaultNS: 'translation',
            interpolation: {
                escapeValue: false
            },
            react: {
                useSuspense: false
            }
        });
    }
    catch (error) {
        console.warn('Failed to initialize i18n:', error);
        // Fallback initialization
        await i18n.use(initReactI18next).init({
            showSupportNotice: false,
            resources,
            lng: getDeviceLanguage(),
            fallbackLng: 'en',
            ns: ['translation', 'legal-privacy', 'legal-imprint'],
            defaultNS: 'translation',
            interpolation: {
                escapeValue: false
            },
            react: {
                useSuspense: false
            }
        });
    }
};

export const changeLanguage = async (languageCode: LanguageCode) => {
    try {
        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
        await i18n.changeLanguage(languageCode);
    }
    catch (error) {
        console.warn('Failed to change language:', error);
    }
};

export const getCurrentLanguage = (): LanguageCode => {
    return (i18n.language as LanguageCode) || 'en';
};

// Initialize immediately for backwards compatibility
i18n.use(initReactI18next).init({
    showSupportNotice: false,
    resources,
    lng: getDeviceLanguage(),
    fallbackLng: 'en',
    ns: ['translation', 'legal-privacy', 'legal-imprint'],
    defaultNS: 'translation',
    interpolation: {
        escapeValue: false
    },
    react: {
        useSuspense: false
    }
});

export default i18n;
