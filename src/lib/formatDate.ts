/**
 * Fast date formatters for Hermes/React Native.
 *
 * Hermes has no native Intl — toLocaleDateString() falls back to a
 * JS polyfill that is ~100x slower than manual string formatting.
 * These functions produce identical output with zero overhead.
 */

const WEEKDAYS_SHORT_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const WEEKDAYS_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG_DE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const WEEKDAYS_LONG_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_SHORT_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONTHS_SHORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTHS_LONG_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const APP_LOCALES: Record<string, string> = {
    de: 'de-DE',
    en: 'en-US',
    es: 'es-ES',
    fr: 'fr-FR',
    it: 'it-IT',
    nl: 'nl-NL',
    pl: 'pl-PL',
    pt: 'pt-PT',
    ro: 'ro-RO',
    tr: 'tr-TR',
    zh: 'zh-CN',
    ja: 'ja-JP',
};

const TWELVE_HOUR_LANGUAGES = new Set(['en']);

function pad2(n: number): string {
    return n < 10 ? '0' + n : String(n);
}

function languageCode(language?: string | null): string {
    return (language ?? 'en').split('-')[0]?.toLowerCase() || 'en';
}

export function getAppLocale(language?: string | null): string {
    return APP_LOCALES[languageCode(language)] ?? APP_LOCALES.en;
}

export function uses24HourClock(language?: string | null): boolean {
    return !TWELVE_HOUR_LANGUAGES.has(languageCode(language));
}

/** "01.03.2026, 14:05" / "03/01/2026, 14:05" */
export function fmtDateTime(date: Date, isDE: boolean): string {
    const d = pad2(date.getDate());
    const m = pad2(date.getMonth() + 1);
    const y = date.getFullYear();
    const h = pad2(date.getHours());
    const min = pad2(date.getMinutes());
    return isDE
        ? `${d}.${m}.${y}, ${h}:${min}`
        : `${m}/${d}/${y}, ${h}:${min}`;
}

/** "01.03.2026" / "03/01/2026" */
export function fmtDate(date: Date, isDE: boolean): string {
    const d = pad2(date.getDate());
    const m = pad2(date.getMonth() + 1);
    const y = date.getFullYear();
    return isDE ? `${d}.${m}.${y}` : `${m}/${d}/${y}`;
}

/** "01.03." / "03/01" */
export function fmtDateShort(date: Date, isDE: boolean): string {
    const d = pad2(date.getDate());
    const m = pad2(date.getMonth() + 1);
    return isDE ? `${d}.${m}.` : `${m}/${d}`;
}

/** "5. März" / "March 5" */
export function fmtDayMonthLong(date: Date, isDE: boolean): string {
    const d = date.getDate();
    const months = isDE ? MONTHS_LONG_DE : MONTHS_LONG_EN;
    return isDE ? `${d}. ${months[date.getMonth()]}` : `${months[date.getMonth()]} ${d}`;
}

/** "5. Mär" / "Mar 5" */
export function fmtDayMonthShort(date: Date, isDE: boolean): string {
    const d = date.getDate();
    const months = isDE ? MONTHS_SHORT_DE : MONTHS_SHORT_EN;
    return isDE ? `${d}. ${months[date.getMonth()]}` : `${months[date.getMonth()]} ${d}`;
}

/** "Mär" / "Mar" */
export function fmtMonthShort(date: Date, isDE: boolean): string {
    return (isDE ? MONTHS_SHORT_DE : MONTHS_SHORT_EN)[date.getMonth()];
}

/** "Mär 26" / "Mar 26" */
export function fmtMonthYear(date: Date, isDE: boolean): string {
    const months = isDE ? MONTHS_SHORT_DE : MONTHS_SHORT_EN;
    const y = String(date.getFullYear()).slice(2);
    return `${months[date.getMonth()]} ${y}`;
}

/** "Mo" / "Mon" */
export function fmtWeekdayShort(date: Date, isDE: boolean): string {
    return (isDE ? WEEKDAYS_SHORT_DE : WEEKDAYS_SHORT_EN)[date.getDay()];
}

/** "Montag" / "Monday" */
export function fmtWeekdayLong(date: Date, isDE: boolean): string {
    return (isDE ? WEEKDAYS_LONG_DE : WEEKDAYS_LONG_EN)[date.getDay()];
}

/** "01.03.2026, 14:05:30" / "03/01/2026, 14:05:30" */
export function fmtDateTimeSec(date: Date, isDE: boolean): string {
    const d = pad2(date.getDate());
    const m = pad2(date.getMonth() + 1);
    const y = date.getFullYear();
    const h = pad2(date.getHours());
    const min = pad2(date.getMinutes());
    const sec = pad2(date.getSeconds());
    return isDE
        ? `${d}.${m}.${y}, ${h}:${min}:${sec}`
        : `${m}/${d}/${y}, ${h}:${min}:${sec}`;
}

/** "14:05" */
export function fmtTime(date: Date): string {
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** "9. Juni – 9. Juli 2026" / "Jun 9 – Jul 9, 2026" */
export function fmtDateRangeLong(from: Date, to: Date, isDE: boolean): string {
    const months = isDE ? MONTHS_LONG_DE : MONTHS_LONG_EN;
    const fromMonth = months[from.getMonth()];
    const toMonth = months[to.getMonth()];
    const toYear = to.getFullYear();

    if (isDE) {
        // Same month & year → "9. – 15. Juni 2026"
        if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
            return `${from.getDate()}. – ${to.getDate()}. ${toMonth} ${toYear}`;
        }
        // Same year → "9. Juni – 9. Juli 2026"
        if (from.getFullYear() === toYear) {
            return `${from.getDate()}. ${fromMonth} – ${to.getDate()}. ${toMonth} ${toYear}`;
        }
        // Different year → "9. Dezember 2025 – 9. Januar 2026"
        return `${from.getDate()}. ${fromMonth} ${from.getFullYear()} – ${to.getDate()}. ${toMonth} ${toYear}`;
    }

    // English
    if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
        return `${fromMonth} ${from.getDate()} – ${to.getDate()}, ${toYear}`;
    }
    if (from.getFullYear() === toYear) {
        return `${fromMonth} ${from.getDate()} – ${toMonth} ${to.getDate()}, ${toYear}`;
    }
    return `${fromMonth} ${from.getDate()}, ${from.getFullYear()} – ${toMonth} ${to.getDate()}, ${toYear}`;
}
