export interface Country {
    code: string;
    name: string;
    flag: string;
}

// ISO 3166-1 country list (alphabetically sorted by name)
export const countries: Country[] = [
    { code: "EG", name: "Ägypten", flag: "🇪🇬" },
    { code: "AL", name: "Albanien", flag: "🇦🇱" },
    { code: "AR", name: "Argentinien", flag: "🇦🇷" },
    { code: "AU", name: "Australien", flag: "🇦🇺" },
    { code: "BD", name: "Bangladesch", flag: "🇧🇩" },
    { code: "BY", name: "Belarus", flag: "🇧🇾" },
    { code: "BE", name: "Belgien", flag: "🇧🇪" },
    { code: "BA", name: "Bosnien und Herzegowina", flag: "🇧🇦" },
    { code: "BR", name: "Brasilien", flag: "🇧🇷" },
    { code: "BG", name: "Bulgarien", flag: "🇧🇬" },
    { code: "CL", name: "Chile", flag: "🇨🇱" },
    { code: "CN", name: "China", flag: "🇨🇳" },
    { code: "DK", name: "Dänemark", flag: "🇩🇰" },
    { code: "DE", name: "Deutschland", flag: "🇩🇪" },
    { code: "EE", name: "Estland", flag: "🇪🇪" },
    { code: "FI", name: "Finnland", flag: "🇫🇮" },
    { code: "FR", name: "Frankreich", flag: "🇫🇷" },
    { code: "GR", name: "Griechenland", flag: "🇬🇷" },
    { code: "HK", name: "Hongkong", flag: "🇭🇰" },
    { code: "IN", name: "Indien", flag: "🇮🇳" },
    { code: "ID", name: "Indonesien", flag: "🇮🇩" },
    { code: "IE", name: "Irland", flag: "🇮🇪" },
    { code: "IS", name: "Island", flag: "🇮🇸" },
    { code: "IL", name: "Israel", flag: "🇮🇱" },
    { code: "IT", name: "Italien", flag: "🇮🇹" },
    { code: "JP", name: "Japan", flag: "🇯🇵" },
    { code: "CA", name: "Kanada", flag: "🇨🇦" },
    { code: "KE", name: "Kenia", flag: "🇰🇪" },
    { code: "CO", name: "Kolumbien", flag: "🇨🇴" },
    { code: "HR", name: "Kroatien", flag: "🇭🇷" },
    { code: "LV", name: "Lettland", flag: "🇱🇻" },
    { code: "LI", name: "Liechtenstein", flag: "🇱🇮" },
    { code: "LT", name: "Litauen", flag: "🇱🇹" },
    { code: "LU", name: "Luxemburg", flag: "🇱🇺" },
    { code: "MY", name: "Malaysia", flag: "🇲🇾" },
    { code: "MT", name: "Malta", flag: "🇲🇹" },
    { code: "MA", name: "Marokko", flag: "🇲🇦" },
    { code: "MX", name: "Mexiko", flag: "🇲🇽" },
    { code: "MD", name: "Moldawien", flag: "🇲🇩" },
    { code: "ME", name: "Montenegro", flag: "🇲🇪" },
    { code: "NZ", name: "Neuseeland", flag: "🇳🇿" },
    { code: "NL", name: "Niederlande", flag: "🇳🇱" },
    { code: "NG", name: "Nigeria", flag: "🇳🇬" },
    { code: "MK", name: "Nordmazedonien", flag: "🇲🇰" },
    { code: "NO", name: "Norwegen", flag: "🇳🇴" },
    { code: "AT", name: "Österreich", flag: "🇦🇹" },
    { code: "PK", name: "Pakistan", flag: "🇵🇰" },
    { code: "PE", name: "Peru", flag: "🇵🇪" },
    { code: "PH", name: "Philippinen", flag: "🇵🇭" },
    { code: "PL", name: "Polen", flag: "🇵🇱" },
    { code: "PT", name: "Portugal", flag: "🇵🇹" },
    { code: "RO", name: "Rumänien", flag: "🇷🇴" },
    { code: "RU", name: "Russland", flag: "🇷🇺" },
    { code: "SA", name: "Saudi-Arabien", flag: "🇸🇦" },
    { code: "SE", name: "Schweden", flag: "🇸🇪" },
    { code: "CH", name: "Schweiz", flag: "🇨🇭" },
    { code: "RS", name: "Serbien", flag: "🇷🇸" },
    { code: "SG", name: "Singapur", flag: "🇸🇬" },
    { code: "SK", name: "Slowakei", flag: "🇸🇰" },
    { code: "SI", name: "Slowenien", flag: "🇸🇮" },
    { code: "ES", name: "Spanien", flag: "🇪🇸" },
    { code: "ZA", name: "Südafrika", flag: "🇿🇦" },
    { code: "KR", name: "Südkorea", flag: "🇰🇷" },
    { code: "TW", name: "Taiwan", flag: "🇹🇼" },
    { code: "TH", name: "Thailand", flag: "🇹🇭" },
    { code: "CZ", name: "Tschechien", flag: "🇨🇿" },
    { code: "TR", name: "Türkei", flag: "🇹🇷" },
    { code: "UA", name: "Ukraine", flag: "🇺🇦" },
    { code: "HU", name: "Ungarn", flag: "🇭🇺" },
    { code: "US", name: "USA", flag: "🇺🇸" },
    { code: "AE", name: "Vereinigte Arabische Emirate", flag: "🇦🇪" },
    { code: "GB", name: "Vereinigtes Königreich", flag: "🇬🇧" },
    { code: "VN", name: "Vietnam", flag: "🇻🇳" },
    { code: "CY", name: "Zypern", flag: "🇨🇾" },
];

// Language-based priority: countries where the language is primarily spoken
const priorityCountriesByLanguage: Record<string, string[]> = {
    de: ['DE', 'AT', 'CH', 'LI', 'LU'],
    en: ['GB', 'US', 'IE', 'AU', 'NZ', 'CA'],
    fr: ['FR', 'BE', 'CH', 'LU', 'CA', 'MA'],
};

export function getSortedCountries(options?: { prioritizeForLanguage?: string }): {
    priority: Country[];
    rest: Country[];
} {
    const lang = options?.prioritizeForLanguage;
    if (!lang) return { priority: [], rest: countries };

    const priorityCodes = priorityCountriesByLanguage[lang];
    if (!priorityCodes?.length) return { priority: [], rest: countries };

    const priority = countries.filter(c => priorityCodes.includes(c.code));
    const rest = countries.filter(c => !priorityCodes.includes(c.code));
    return { priority, rest };
}

export function getCountryByCode(code: string): Country | undefined {
    return countries.find(c => c.code === code);
}

export function getCountryLabel(code: string): string {
    const country = getCountryByCode(code);
    return country ? `${country.flag} ${country.name}` : code;
}
