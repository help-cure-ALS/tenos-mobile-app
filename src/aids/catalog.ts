// ALS assistive aids catalog — 53 entries from ALS_Hilfsmittel_Katalog_International.xlsx

import type { AidCatalogEntry, AidCategory } from './types';

const CATEGORY_MAP: Record<string, AidCategory> = {
    'Mobilität': 'mobility',
    'Transfer & Lagerung': 'transfer',
    'Kommunikation': 'communication',
    'Atmung': 'respiratory',
    'Ernährung': 'nutrition',
    'Alltagshilfen': 'daily_living',
};

export const AID_CATALOG: AidCatalogEntry[] = [
    // =========================================================================
    // MOB — Mobilität (12)
    // =========================================================================
    {
        id: 'MOB-001', isoClass: '12', isoSubclass: '12.06',
        category: 'mobility', subcategory: 'Gehhilfen',
        nameDe: 'Gehstock / Unterarmgehstütze', nameEn: 'Walking cane / Forearm crutch',
        descriptionDe: 'Einfache Gehhilfe zur Stabilisierung beim Gehen',
        descriptionEn: 'Basic walking aid for stabilization during ambulation',
        alsPhase: 'Früh', alsfrsArea: 'Gehen',
        tags: 'gehstock, krücke, cane, crutch, walking aid',
        reimbursement: {
            de: { productGroup: 'PG 10', label: 'Gehhilfen', code: '10.46.01.0xxx', prescriber: 'Arzt', notes: 'Verordnung, Zuzahlung 10%' },
            at: { area: 'Behelfe und Hilfsmittel', approval: 'Nein', prescriber: 'Arzt', notes: 'Tarif lt. ÖGK-Hilfsmittelkatalog' },
        },
    },
    {
        id: 'MOB-002', isoClass: '12', isoSubclass: '12.06',
        category: 'mobility', subcategory: 'Gehhilfen',
        nameDe: 'Rollator / Gehwagen', nameEn: 'Rollator / Walker',
        descriptionDe: 'Fahrbare Gehhilfe mit Bremsen, Sitz und ggf. Korb',
        descriptionEn: 'Wheeled walking frame with brakes, seat and optional basket',
        alsPhase: 'Früh', alsfrsArea: 'Gehen',
        tags: 'rollator, walker, gehwagen, wheeled walker',
        reimbursement: {
            de: { productGroup: 'PG 10', label: 'Gehhilfen', code: '10.50.04.1xxx', prescriber: 'Arzt', notes: 'Verordnung, Zuzahlung 10%' },
        },
    },
    {
        id: 'MOB-003', isoClass: '12', isoSubclass: '12.22',
        category: 'mobility', subcategory: 'Rollstühle',
        nameDe: 'Leichtgewicht-Rollstuhl (manuell)', nameEn: 'Manual lightweight wheelchair',
        descriptionDe: 'Manueller Rollstuhl, vom Betroffenen oder Begleitperson geschoben',
        descriptionEn: 'Manual wheelchair propelled by user or attendant',
        alsPhase: 'Mittel', alsfrsArea: 'Gehen',
        tags: 'rollstuhl, wheelchair, manual, leichtgewicht',
        reimbursement: {
            de: { productGroup: 'PG 18', label: 'Krankenfahrzeuge', code: '18.50.02.0xxx', prescriber: 'Arzt', notes: 'Verordnung, individuelle Anpassung' },
            at: { area: 'Behelfe und Hilfsmittel', approval: 'Ja', prescriber: 'Arzt', notes: 'Bewilligung ÖGK erforderlich' },
            ch: { group: '10 – Rollstühle', position: '10.01', prescriber: 'Arzt', notes: 'IV oder KVG, je nach Alter' },
        },
    },
    {
        id: 'MOB-004', isoClass: '12', isoSubclass: '12.23',
        category: 'mobility', subcategory: 'Rollstühle',
        nameDe: 'Elektrorollstuhl', nameEn: 'Power wheelchair',
        descriptionDe: 'Elektrisch angetriebener Rollstuhl mit Joystick-Steuerung',
        descriptionEn: 'Electrically powered wheelchair with joystick control',
        alsPhase: 'Mittel–Spät', alsfrsArea: 'Gehen',
        tags: 'elektrorollstuhl, power wheelchair, e-rollstuhl',
        reimbursement: {
            de: { productGroup: 'PG 18', label: 'Krankenfahrzeuge', code: '18.51.05.0xxx', prescriber: 'Arzt', notes: 'Verordnung + MDK-Gutachten empf.' },
            at: { area: 'Behelfe und Hilfsmittel', approval: 'Ja', prescriber: 'Arzt', notes: 'Chef-/Kontrollärztl. Bewilligung' },
            ch: { group: '10 – Rollstühle', position: '10.02', prescriber: 'Arzt', notes: 'IV-Verfügung oder KVG-Antrag' },
        },
    },
    {
        id: 'MOB-005', isoClass: '12', isoSubclass: '12.23',
        category: 'mobility', subcategory: 'Rollstühle',
        nameDe: 'Elektrorollstuhl mit Sondersteuerung', nameEn: 'Power wheelchair w/ special controls',
        descriptionDe: 'E-Rollstuhl mit Kopf-, Kinn- oder Augensteuerung',
        descriptionEn: 'Power wheelchair with head, chin or eye-gaze control',
        alsPhase: 'Spät', alsfrsArea: 'Gehen',
        tags: 'sondersteuerung, head control, chin control, eye gaze',
        reimbursement: {
            de: { productGroup: 'PG 18', label: 'Krankenfahrzeuge', code: '18.51.05.1xxx', prescriber: 'Arzt', notes: 'Verordnung + MDK-Gutachten' },
        },
    },
    {
        id: 'MOB-006', isoClass: '12', isoSubclass: '12.22',
        category: 'mobility', subcategory: 'Rollstühle',
        nameDe: 'Pflegerollstuhl / Multifunktionsrollstuhl', nameEn: 'Tilt-in-space / Reclining wheelchair',
        descriptionDe: 'Rollstuhl mit Sitzkantelung, Rückenverstellung und Kopfstütze',
        descriptionEn: 'Wheelchair with tilt, recline and headrest function',
        alsPhase: 'Spät', alsfrsArea: 'Gehen',
        tags: 'pflegerollstuhl, tilt, reclining, multifunktion',
        reimbursement: {
            de: { productGroup: 'PG 18', label: 'Krankenfahrzeuge', code: '18.50.04.0xxx', prescriber: 'Arzt', notes: 'Verordnung + Begründung' },
        },
    },
    {
        id: 'MOB-007', isoClass: '12', isoSubclass: '12.24',
        category: 'mobility', subcategory: 'Rollstuhlzubehör',
        nameDe: 'Kopfstütze / Nackenstütze', nameEn: 'Head / Neck support',
        descriptionDe: 'Stützvorrichtung für den Kopf bei Nackenschwäche (Head-Drop)',
        descriptionEn: 'Support device for head when neck muscles are weakened (head drop)',
        alsPhase: 'Mittel', alsfrsArea: 'Gehen',
        tags: 'kopfstütze, nackenstütze, head support, head drop',
        reimbursement: {
            de: { productGroup: 'PG 18', label: 'Krankenfahrzeuge (Zubehör)', code: '18.99.01.xxx', prescriber: 'Arzt', notes: 'Als Rollstuhlzubehör verordnet' },
        },
    },
    {
        id: 'MOB-008', isoClass: '12', isoSubclass: '12.25',
        category: 'mobility', subcategory: 'Rollstuhlzubehör',
        nameDe: 'Sitzschale / Rückenschale', nameEn: 'Custom seat / Back shell',
        descriptionDe: 'Individuell angepasste Sitzeinheit für optimale Positionierung',
        descriptionEn: 'Custom-molded seating unit for optimal positioning',
        alsPhase: 'Mittel–Spät', alsfrsArea: 'Gehen',
        tags: 'sitzschale, seat shell, positioning, seating',
        reimbursement: {
            de: { productGroup: 'PG 26', label: 'Sitzschalen', code: '26.43.01.xxx', prescriber: 'Arzt', notes: 'Individuelle Anfertigung' },
        },
    },
    {
        id: 'MOB-009', isoClass: '12', isoSubclass: '12.25',
        category: 'mobility', subcategory: 'Rollstuhlzubehör',
        nameDe: 'Anti-Dekubitus-Sitzkissen', nameEn: 'Pressure relief cushion',
        descriptionDe: 'Spezialkissen zur Vermeidung von Druckgeschwüren im Rollstuhl',
        descriptionEn: 'Special cushion to prevent pressure sores in wheelchair',
        alsPhase: 'Mittel–Spät', alsfrsArea: 'Gehen',
        tags: 'dekubitus, pressure relief, sitzkissen, cushion',
        reimbursement: {
            de: { productGroup: 'PG 11', label: 'Dekubitus', code: '11.39.01.xxx', prescriber: 'Arzt', notes: 'Verordnung' },
        },
    },
    {
        id: 'MOB-010', isoClass: '18', isoSubclass: '18.24',
        category: 'mobility', subcategory: 'Rampen & Zugänge',
        nameDe: 'Mobile Rollstuhlrampe', nameEn: 'Portable wheelchair ramp',
        descriptionDe: 'Klapp- oder Teleskoprampe für Stufen und Schwellen',
        descriptionEn: 'Folding or telescopic ramp for steps and thresholds',
        alsPhase: 'Mittel', alsfrsArea: 'Gehen',
        tags: 'rampe, ramp, barrierefreiheit, accessibility',
        reimbursement: {
            de: { productGroup: 'PG 22', label: 'Mobilitätshilfen', code: '22.40.01.xxx', prescriber: 'Arzt', notes: 'Verordnung oder Wohnumfeldverbess.' },
        },
    },
    {
        id: 'MOB-011', isoClass: '18', isoSubclass: '18.30',
        category: 'mobility', subcategory: 'Treppensteighilfen',
        nameDe: 'Treppensteiger / Treppenraupe', nameEn: 'Stair climber',
        descriptionDe: 'Gerät zum Überwinden von Treppenstufen mit Rollstuhl',
        descriptionEn: 'Device for navigating stairs with wheelchair',
        alsPhase: 'Mittel', alsfrsArea: 'Gehen',
        tags: 'treppensteiger, stair climber, treppenraupe',
        reimbursement: {
            de: { productGroup: 'PG 18', label: 'Krankenfahrzeuge', code: '18.65.01.xxx', prescriber: 'Arzt', notes: 'Verordnung + Begründung' },
        },
    },
    {
        id: 'MOB-012', isoClass: '18', isoSubclass: '18.30',
        category: 'mobility', subcategory: 'Treppensteighilfen',
        nameDe: 'Treppenlift / Plattformlift', nameEn: 'Stairlift / Platform lift',
        descriptionDe: 'Fest installierter Lift für Treppe im Wohnumfeld',
        descriptionEn: 'Permanently installed lift for stairs in home environment',
        alsPhase: 'Mittel–Spät', alsfrsArea: 'Gehen',
        tags: 'treppenlift, stairlift, platform lift, aufzug',
        reimbursement: {
            de: { productGroup: '—', label: 'Nicht im GKV-Verzeichnis', code: '—', prescriber: '—', notes: 'Pflegekasse: Wohnumfeldverbesserung bis 4.000€' },
        },
    },

    // =========================================================================
    // TRA — Transfer & Lagerung (8)
    // =========================================================================
    {
        id: 'TRA-001', isoClass: '12', isoSubclass: '12.31',
        category: 'transfer', subcategory: 'Transferhilfen',
        nameDe: 'Rutschbrett / Transferbrett', nameEn: 'Transfer board / Slide board',
        descriptionDe: 'Brett zum Hinüberrutschen z.B. vom Rollstuhl ins Bett',
        descriptionEn: 'Board for sliding between wheelchair, bed, car etc.',
        alsPhase: 'Mittel', alsfrsArea: 'Bett',
        tags: 'rutschbrett, transfer board, slide board',
        reimbursement: {
            de: { productGroup: 'PG 22', label: 'Mobilitätshilfen', code: '22.40.02.xxx', prescriber: 'Arzt', notes: 'Verordnung' },
        },
    },
    {
        id: 'TRA-002', isoClass: '12', isoSubclass: '12.36',
        category: 'transfer', subcategory: 'Transferhilfen',
        nameDe: 'Patientenlifter (mobil)', nameEn: 'Mobile patient hoist',
        descriptionDe: 'Mobiler Lifter zum Umsetzen von Bett/Rollstuhl/Toilette',
        descriptionEn: 'Mobile hoist for transfers between bed, wheelchair, toilet',
        alsPhase: 'Mittel–Spät', alsfrsArea: 'Bett',
        tags: 'patientenlifter, hoist, lifter, hoyer lift',
        reimbursement: {
            de: { productGroup: 'PG 22', label: 'Mobilitätshilfen', code: '22.40.03.xxx', prescriber: 'Arzt', notes: 'Verordnung' },
        },
    },
    {
        id: 'TRA-003', isoClass: '12', isoSubclass: '12.36',
        category: 'transfer', subcategory: 'Transferhilfen',
        nameDe: 'Deckenlifter (fest installiert)', nameEn: 'Ceiling track lift',
        descriptionDe: 'Schienensystem an der Decke mit Lifter und Gurt',
        descriptionEn: 'Ceiling-mounted rail system with hoist and sling',
        alsPhase: 'Spät', alsfrsArea: 'Bett',
        tags: 'deckenlifter, ceiling lift, track hoist',
        reimbursement: {
            de: { productGroup: 'PG 22', label: 'Mobilitätshilfen', code: '22.40.03.xxx', prescriber: 'Arzt', notes: 'Verordnung + Einbau' },
        },
    },
    {
        id: 'TRA-004', isoClass: '18', isoSubclass: '18.09',
        category: 'transfer', subcategory: 'Aufstehhilfen',
        nameDe: 'Aufstehhilfe / Katapultsitz', nameEn: 'Lift chair / Rising seat',
        descriptionDe: 'Sessel oder Aufsatz mit elektrischer Aufstehhilfe',
        descriptionEn: 'Chair or seat insert with powered rising mechanism',
        alsPhase: 'Früh–Mittel', alsfrsArea: 'Bett',
        tags: 'aufstehhilfe, lift chair, rising seat, katapultsitz',
        reimbursement: {
            de: { productGroup: 'PG 26', label: 'Sitzhilfen', code: '26.46.01.xxx', prescriber: 'Arzt', notes: 'Verordnung' },
        },
    },
    {
        id: 'TRA-005', isoClass: '18', isoSubclass: '18.12',
        category: 'transfer', subcategory: 'Betten',
        nameDe: 'Pflegebett (elektrisch verstellbar)', nameEn: 'Hospital / Care bed (electric)',
        descriptionDe: 'Bett mit elektrisch verstellbarem Kopf-/Fußteil und Höhe',
        descriptionEn: 'Bed with electrically adjustable head, foot and height sections',
        alsPhase: 'Mittel–Spät', alsfrsArea: 'Bett',
        tags: 'pflegebett, hospital bed, care bed, elektrisch',
        reimbursement: {
            de: { productGroup: 'PG 19', label: 'Krankenpflegeartikel', code: '19.40.01.xxx', prescriber: 'Arzt', notes: 'Verordnung, auch Pflegekasse mögl.' },
            at: { area: 'Behelfe und Hilfsmittel', approval: 'Ja', prescriber: 'Arzt', notes: 'Bewilligung ÖGK/PVA' },
            ch: { group: 'Nicht MiGeL', position: '—', prescriber: 'Arzt', notes: 'Spitex oder Hilflosenentschädigung' },
        },
    },
    {
        id: 'TRA-006', isoClass: '18', isoSubclass: '18.12',
        category: 'transfer', subcategory: 'Betten',
        nameDe: 'Anti-Dekubitus-Matratze', nameEn: 'Pressure relief mattress',
        descriptionDe: 'Wechseldruck- oder Schaumstoffmatratze gegen Dekubitus',
        descriptionEn: 'Alternating pressure or foam mattress for pressure sore prevention',
        alsPhase: 'Mittel–Spät', alsfrsArea: 'Bett',
        tags: 'dekubitus, matratze, pressure relief, mattress',
        reimbursement: {
            de: { productGroup: 'PG 11', label: 'Dekubitus', code: '11.29.01.xxx', prescriber: 'Arzt', notes: 'Verordnung' },
        },
    },
    {
        id: 'TRA-007', isoClass: '18', isoSubclass: '18.12',
        category: 'transfer', subcategory: 'Lagerung',
        nameDe: 'Lagerungskissen / Positionierungshilfen', nameEn: 'Positioning cushions & wedges',
        descriptionDe: 'Keile und Kissen zur Lagerung im Bett oder Rollstuhl',
        descriptionEn: 'Wedges and cushions for positioning in bed or wheelchair',
        alsPhase: 'Mittel', alsfrsArea: 'Bett',
        tags: 'lagerung, positioning, keil, wedge, cushion',
        reimbursement: {
            de: { productGroup: 'PG 11', label: 'Dekubitus/Lagerung', code: '11.29.06.xxx', prescriber: 'Arzt', notes: 'Verordnung' },
        },
    },
    {
        id: 'TRA-008', isoClass: '18', isoSubclass: '18.12',
        category: 'transfer', subcategory: 'Betten',
        nameDe: 'Bettgalgen / Aufrichter', nameEn: 'Bed trapeze / Pull-up bar',
        descriptionDe: 'Griff über dem Bett zum selbstständigen Aufrichten',
        descriptionEn: 'Overhead bar/handle for self-repositioning in bed',
        alsPhase: 'Früh–Mittel', alsfrsArea: 'Bett',
        tags: 'bettgalgen, trapeze, aufrichter, pull-up bar',
        reimbursement: {
            de: { productGroup: 'PG 19', label: 'Krankenpflegeartikel', code: '19.40.04.xxx', prescriber: 'Arzt', notes: 'Verordnung' },
        },
    },

    // =========================================================================
    // KOM — Kommunikation (8)
    // =========================================================================
    {
        id: 'KOM-001', isoClass: '22', isoSubclass: '22.21',
        category: 'communication', subcategory: 'Einfache Hilfen',
        nameDe: 'Buchstabentafel / Kommunikationstafel', nameEn: 'Letter board / Communication board',
        descriptionDe: 'Tafel mit Buchstaben/Symbolen, Patient zeigt oder blinzelt',
        descriptionEn: 'Board with letters/symbols, patient points or blinks to communicate',
        alsPhase: 'Mittel', alsfrsArea: 'Sprache',
        tags: 'buchstabentafel, letter board, communication board',
        reimbursement: {
            de: { productGroup: 'PG 16', label: 'Kommunikationshilfen', code: '16.99.01.xxx', prescriber: 'Arzt/Logopäde', notes: 'Verordnung' },
        },
    },
    {
        id: 'KOM-002', isoClass: '22', isoSubclass: '22.13',
        category: 'communication', subcategory: 'Schreibhilfen',
        nameDe: 'Schreibhilfe / Stiftverdickung', nameEn: 'Writing aid / Pen grip',
        descriptionDe: 'Ergonomische Schreibhilfen bei eingeschränkter Handfunktion',
        descriptionEn: 'Ergonomic writing aids for limited hand function',
        alsPhase: 'Früh–Mittel', alsfrsArea: 'Handschrift',
        tags: 'schreibhilfe, pen grip, writing aid, stiftverdickung',
        reimbursement: {
            de: { productGroup: 'PG 02', label: 'Adaptionshilfen', code: '02.40.01.xxx', prescriber: 'Arzt/Ergo', notes: 'Verordnung' },
        },
    },
    {
        id: 'KOM-003', isoClass: '22', isoSubclass: '22.09',
        category: 'communication', subcategory: 'Sprachhilfen',
        nameDe: 'Sprachverstärker', nameEn: 'Voice amplifier',
        descriptionDe: 'Tragbares Gerät zur Verstärkung einer leisen Stimme',
        descriptionEn: 'Portable device to amplify a quiet voice',
        alsPhase: 'Früh–Mittel', alsfrsArea: 'Sprache',
        tags: 'sprachverstärker, voice amplifier',
        reimbursement: {
            de: { productGroup: 'PG 16', label: 'Kommunikationshilfen', code: '16.99.06.xxx', prescriber: 'Arzt/Logopäde', notes: 'Verordnung' },
        },
    },
    {
        id: 'KOM-004', isoClass: '22', isoSubclass: '22.21',
        category: 'communication', subcategory: 'Elektronische Hilfen',
        nameDe: 'Tablet mit Kommunikations-App (AAC)', nameEn: 'Tablet with AAC App',
        descriptionDe: 'Tablet mit spezieller Kommunikations-App (z.B. MetaTalk, GoTalk NOW)',
        descriptionEn: 'Tablet with dedicated AAC app (e.g. MetaTalk, GoTalk NOW, Proloquo2Go)',
        alsPhase: 'Mittel', alsfrsArea: 'Sprache',
        tags: 'tablet, aac, app, metatalk, proloquo, communication',
        reimbursement: {
            de: { productGroup: 'PG 16', label: 'Kommunikationshilfen', code: '16.99.09.xxx', prescriber: 'Arzt/Logopäde', notes: 'Nur App/Software erstattungsfähig' },
        },
    },
    {
        id: 'KOM-005', isoClass: '22', isoSubclass: '22.21',
        category: 'communication', subcategory: 'Elektronische Hilfen',
        nameDe: 'Sprachcomputer (SGD)', nameEn: 'Speech generating device (SGD)',
        descriptionDe: 'Dediziertes Gerät mit Sprachausgabe, Tastatur oder Touchscreen',
        descriptionEn: 'Dedicated device with speech output, keyboard or touchscreen',
        alsPhase: 'Mittel–Spät', alsfrsArea: 'Sprache',
        tags: 'sprachcomputer, sgd, speech generating device, talker',
        reimbursement: {
            de: { productGroup: 'PG 16', label: 'Kommunikationshilfen', code: '16.99.09.xxx', prescriber: 'Arzt/Logopäde', notes: 'Verordnung, Erprobung empfohlen' },
            at: { area: 'Behelfe und Hilfsmittel', approval: 'Ja', prescriber: 'Arzt + Logopäde', notes: 'Antrag bei ÖGK/SVS' },
            ch: { group: '03 – Hilfsmittel Kommunikation', position: '03.xx', prescriber: 'Arzt + Logopäde', notes: 'IV-Leistung (SHIV)' },
        },
    },
    {
        id: 'KOM-006', isoClass: '22', isoSubclass: '22.21',
        category: 'communication', subcategory: 'Elektronische Hilfen',
        nameDe: 'Augensteuerung (Eye-Tracking)', nameEn: 'Eye-tracking communication device',
        descriptionDe: 'Kamera-basiertes System, das Blickbewegungen in Text/Sprache umwandelt',
        descriptionEn: 'Camera-based system converting eye movements to text/speech',
        alsPhase: 'Spät', alsfrsArea: 'Sprache',
        tags: 'augensteuerung, eye tracking, eye gaze, tobii',
        reimbursement: {
            de: { productGroup: 'PG 16', label: 'Kommunikationshilfen', code: '16.99.09.xxx', prescriber: 'Arzt/Logopäde', notes: 'Verordnung + Erprobung + Begründung' },
            at: { area: 'Behelfe und Hilfsmittel', approval: 'Ja', prescriber: 'Arzt + Logopäde', notes: 'Einzelfallentscheidung' },
            ch: { group: '03 – Hilfsmittel Kommunikation', position: '03.xx', prescriber: 'Arzt + Logopäde', notes: 'IV-Leistung, Einzelfall' },
        },
    },
    {
        id: 'KOM-007', isoClass: '22', isoSubclass: '22.24',
        category: 'communication', subcategory: 'Umfeldsteuerung',
        nameDe: 'Umfeldsteuerung / Smart Home', nameEn: 'Environmental control unit (ECU)',
        descriptionDe: 'System zur Steuerung von Licht, TV, Türen etc. über Taster/Augensteuerung',
        descriptionEn: 'System to control lights, TV, doors etc. via switches or eye gaze',
        alsPhase: 'Mittel–Spät', alsfrsArea: 'Sprache',
        tags: 'umfeldsteuerung, ecu, smart home, environmental control',
        reimbursement: {
            de: { productGroup: 'PG 16', label: 'Kommunikationshilfen', code: '16.99.09.xxx', prescriber: 'Arzt', notes: 'Verordnung + Begründung' },
        },
    },
    {
        id: 'KOM-008', isoClass: '22', isoSubclass: '22.24',
        category: 'communication', subcategory: 'Umfeldsteuerung',
        nameDe: 'Sprachassistent (Alexa, Google Home)', nameEn: 'Voice assistant (Alexa, Google Home)',
        descriptionDe: 'Sprachgesteuerte Steuerung von Geräten und Informationsabruf',
        descriptionEn: 'Voice-controlled device management and information retrieval',
        alsPhase: 'Früh–Mittel', alsfrsArea: 'Sprache',
        tags: 'alexa, google home, sprachassistent, voice assistant',
        reimbursement: {
            de: { productGroup: '—', label: 'Nicht im GKV-Verzeichnis', code: '—', prescriber: '—', notes: 'Eigenfinanzierung' },
        },
    },

    // =========================================================================
    // ATM — Atmung (8)
    // =========================================================================
    {
        id: 'ATM-001', isoClass: '04', isoSubclass: '04.03',
        category: 'respiratory', subcategory: 'Nicht-invasive Beatmung',
        nameDe: 'NIV-Beatmungsgerät (BiPAP/CPAP)', nameEn: 'Non-invasive ventilator (BiPAP/CPAP)',
        descriptionDe: 'Maskenbeatmung zur Unterstützung der Atemmuskulatur, v.a. nachts',
        descriptionEn: 'Mask ventilation to support respiratory muscles, especially at night',
        alsPhase: 'Mittel', alsfrsArea: 'Atemnot',
        tags: 'niv, bipap, cpap, beatmung, ventilator, non-invasive',
        reimbursement: {
            de: { productGroup: 'PG 14', label: 'Inhalation/Atemtherapie', code: '14.24.12.xxx', prescriber: 'Arzt (Pneumologe)', notes: 'Verordnung + Einweisung' },
            at: { area: 'Behelfe und Hilfsmittel', approval: 'Ja', prescriber: 'Arzt (Pulmologie)', notes: 'Bewilligung + Einschulung' },
            ch: { group: '14 – Atemtherapiegeräte', position: '14.01', prescriber: 'Arzt (Pneumologe)', notes: 'MiGeL oder IV' },
        },
    },
    {
        id: 'ATM-002', isoClass: '04', isoSubclass: '04.03',
        category: 'respiratory', subcategory: 'Nicht-invasive Beatmung',
        nameDe: 'Beatmungsmaske (Nasal / Vollgesicht)', nameEn: 'Ventilation mask (nasal / full face)',
        descriptionDe: 'Passende Maske für NIV-Beatmung, verschiedene Typen',
        descriptionEn: 'Fitting mask for NIV ventilation, various types available',
        alsPhase: 'Mittel', alsfrsArea: 'Atemnot',
        tags: 'maske, mask, nasal, full face, beatmungsmaske',
        reimbursement: {
            de: { productGroup: 'PG 14', label: 'Inhalation/Atemtherapie', code: '14.24.13.xxx', prescriber: 'Arzt', notes: 'Verordnung zusammen mit NIV-Gerät' },
        },
    },
    {
        id: 'ATM-003', isoClass: '04', isoSubclass: '04.03',
        category: 'respiratory', subcategory: 'Invasive Beatmung',
        nameDe: 'Invasives Beatmungsgerät (Tracheostoma)', nameEn: 'Invasive ventilator (tracheostomy)',
        descriptionDe: 'Beatmung über Trachealkanüle bei dauerhafter Beatmungspflicht',
        descriptionEn: 'Ventilation via tracheostomy tube for permanent ventilatory support',
        alsPhase: 'Spät', alsfrsArea: 'Atemnot',
        tags: 'invasiv, tracheostoma, beatmung, ventilator, tracheostomy',
        reimbursement: {
            de: { productGroup: 'PG 14', label: 'Inhalation/Atemtherapie', code: '14.24.14.xxx', prescriber: 'Arzt (Pneumologe)', notes: 'Verordnung + 24h-Pflege oft nötig' },
        },
    },
    {
        id: 'ATM-004', isoClass: '09', isoSubclass: '09.15',
        category: 'respiratory', subcategory: 'Invasive Beatmung',
        nameDe: 'Trachealkanüle', nameEn: 'Tracheostomy tube',
        descriptionDe: 'Kanüle für den künstlichen Atemweg im Tracheostoma',
        descriptionEn: 'Cannula for artificial airway in tracheostomy',
        alsPhase: 'Spät', alsfrsArea: 'Atemnot',
        tags: 'trachealkanüle, tracheostomy tube, kanüle, cannula',
        reimbursement: {
            de: { productGroup: 'PG 12', label: 'Tracheostomie', code: '12.24.01.xxx', prescriber: 'Arzt', notes: 'Verordnung als Verbrauchsmaterial' },
        },
    },
    {
        id: 'ATM-005', isoClass: '04', isoSubclass: '04.03',
        category: 'respiratory', subcategory: 'Sekretmanagement',
        nameDe: 'Hustenassistent (Cough Assist / MI-E)', nameEn: 'Mechanical insufflation-exsufflation (MI-E)',
        descriptionDe: 'Gerät erzeugt künstlichen Hustenstoß zum Sekretlösen',
        descriptionEn: 'Device generates artificial cough to clear secretions',
        alsPhase: 'Mittel–Spät', alsfrsArea: 'Atemnot',
        tags: 'hustenassistent, cough assist, mi-e, sekret',
        reimbursement: {
            de: { productGroup: 'PG 14', label: 'Inhalation/Atemtherapie', code: '14.24.15.xxx', prescriber: 'Arzt (Pneumologe)', notes: 'Verordnung + Begründung' },
        },
    },
    {
        id: 'ATM-006', isoClass: '04', isoSubclass: '04.03',
        category: 'respiratory', subcategory: 'Sekretmanagement',
        nameDe: 'Absauggerät (tragbar)', nameEn: 'Portable suction device',
        descriptionDe: 'Tragbares Gerät zum Absaugen von Sekret aus den Atemwegen',
        descriptionEn: 'Portable device for suctioning secretions from airways',
        alsPhase: 'Mittel–Spät', alsfrsArea: 'Atemnot',
        tags: 'absauggerät, suction, absaugen, portable',
        reimbursement: {
            de: { productGroup: 'PG 01', label: 'Absauggeräte', code: '01.24.01.xxx', prescriber: 'Arzt', notes: 'Verordnung' },
        },
    },
    {
        id: 'ATM-007', isoClass: '04', isoSubclass: '04.03',
        category: 'respiratory', subcategory: 'Sekretmanagement',
        nameDe: 'Inhalationsgerät / Vernebler', nameEn: 'Nebulizer / Inhaler',
        descriptionDe: 'Gerät zur Befeuchtung und Medikamentenverneblung der Atemwege',
        descriptionEn: 'Device for airway humidification and medication nebulization',
        alsPhase: 'Mittel', alsfrsArea: 'Atemnot',
        tags: 'inhalation, vernebler, nebulizer, inhaler',
        reimbursement: {
            de: { productGroup: 'PG 14', label: 'Inhalation/Atemtherapie', code: '14.24.01.xxx', prescriber: 'Arzt', notes: 'Verordnung' },
        },
    },
    {
        id: 'ATM-008', isoClass: '04', isoSubclass: '04.24',
        category: 'respiratory', subcategory: 'Monitoring',
        nameDe: 'Pulsoximeter', nameEn: 'Pulse oximeter',
        descriptionDe: 'Fingersensor zur Messung der Sauerstoffsättigung',
        descriptionEn: 'Finger sensor to measure blood oxygen saturation',
        alsPhase: 'Mittel', alsfrsArea: 'Atemnot',
        tags: 'pulsoximeter, pulse oximeter, spo2, sauerstoff',
        reimbursement: {
            de: { productGroup: 'PG 21', label: 'Messgeräte', code: '21.43.01.xxx', prescriber: 'Arzt', notes: 'Verordnung, nicht immer erstattungsfähig' },
        },
    },

    // =========================================================================
    // ERN — Ernährung (8)
    // =========================================================================
    {
        id: 'ERN-001', isoClass: '15', isoSubclass: '15.09',
        category: 'nutrition', subcategory: 'Esshilfen',
        nameDe: 'Adaptives Besteck (verdickter Griff)', nameEn: 'Adaptive utensils (built-up grip)',
        descriptionDe: 'Besteck mit verdicktem, rutschfestem Griff',
        descriptionEn: 'Cutlery with thickened, non-slip grip',
        alsPhase: 'Früh–Mittel', alsfrsArea: 'Nahrungsaufnahme',
        tags: 'besteck, utensils, adaptive, griff, grip',
        reimbursement: {
            de: { productGroup: 'PG 02', label: 'Adaptionshilfen', code: '02.40.02.xxx', prescriber: 'Arzt/Ergo', notes: 'Verordnung' },
        },
    },
    {
        id: 'ERN-002', isoClass: '15', isoSubclass: '15.09',
        category: 'nutrition', subcategory: 'Esshilfen',
        nameDe: 'Tellerranderhöhung / Schöpfteller', nameEn: 'Plate guard / Scoop dish',
        descriptionDe: 'Hilfsmittel, die das Aufnehmen von Essen erleichtern',
        descriptionEn: 'Aid to make scooping food onto utensils easier',
        alsPhase: 'Früh–Mittel', alsfrsArea: 'Nahrungsaufnahme',
        tags: 'teller, plate guard, scoop dish, rand',
        reimbursement: {
            de: { productGroup: 'PG 02', label: 'Adaptionshilfen', code: '02.40.02.xxx', prescriber: 'Arzt/Ergo', notes: 'Verordnung' },
        },
    },
    {
        id: 'ERN-003', isoClass: '15', isoSubclass: '15.09',
        category: 'nutrition', subcategory: 'Esshilfen',
        nameDe: 'Nasenbecher / Spezialbecher', nameEn: 'Nosey cup / Adapted cup',
        descriptionDe: 'Becher mit Nasenausschnitt, kein Kopfneigen nötig',
        descriptionEn: 'Cup with nose cutout, no head tilting needed for drinking',
        alsPhase: 'Mittel', alsfrsArea: 'Nahrungsaufnahme',
        tags: 'nasenbecher, nosey cup, becher, cup, trinkhilfe',
        reimbursement: {
            de: { productGroup: 'PG 02', label: 'Adaptionshilfen', code: '02.40.02.xxx', prescriber: 'Arzt/Ergo', notes: 'Verordnung' },
        },
    },
    {
        id: 'ERN-004', isoClass: '15', isoSubclass: '15.09',
        category: 'nutrition', subcategory: 'Esshilfen',
        nameDe: 'Antirutsch-Unterlage', nameEn: 'Non-slip mat',
        descriptionDe: 'Rutschfeste Unterlage für Teller und Gläser',
        descriptionEn: 'Non-slip mat to keep plates and glasses in place',
        alsPhase: 'Früh', alsfrsArea: 'Nahrungsaufnahme',
        tags: 'antirutsch, non-slip, mat, unterlage',
        reimbursement: {
            de: { productGroup: 'PG 02', label: 'Adaptionshilfen', code: '02.40.02.xxx', prescriber: 'Arzt/Ergo', notes: 'Verordnung' },
        },
    },
    {
        id: 'ERN-005', isoClass: '15', isoSubclass: '15.03',
        category: 'nutrition', subcategory: 'Schluckhilfen',
        nameDe: 'Andickungsmittel / Verdickungspulver', nameEn: 'Thickening powder / Thickener',
        descriptionDe: 'Pulver zum Andicken von Flüssigkeiten bei Schluckstörungen',
        descriptionEn: 'Powder to thicken liquids for patients with dysphagia',
        alsPhase: 'Mittel', alsfrsArea: 'Nahrungsaufnahme',
        tags: 'andickungsmittel, thickener, dysphagie, schlucken',
        reimbursement: {
            de: { productGroup: '—', label: 'Nicht im GKV-Verzeichnis', code: '—', prescriber: 'Arzt/Logopäde', notes: 'Ggf. als Nahrungsergänzung, meist Eigenfinanzierung' },
        },
    },
    {
        id: 'ERN-006', isoClass: '04', isoSubclass: '04.19',
        category: 'nutrition', subcategory: 'Enterale Ernährung',
        nameDe: 'PEG-Sonde (perkutane Gastrostomie)', nameEn: 'PEG tube (percutaneous gastrostomy)',
        descriptionDe: 'Ernährungssonde durch die Bauchdecke in den Magen',
        descriptionEn: 'Feeding tube placed through abdominal wall into stomach',
        alsPhase: 'Mittel–Spät', alsfrsArea: 'Nahrungsaufnahme',
        tags: 'peg, sonde, gastrostomie, feeding tube',
        reimbursement: {
            de: { productGroup: 'PG 03', label: 'Applikationshilfen', code: '03.99.01.xxx', prescriber: 'Arzt (Gastro)', notes: 'Verordnung + operative Anlage' },
        },
    },
    {
        id: 'ERN-007', isoClass: '04', isoSubclass: '04.19',
        category: 'nutrition', subcategory: 'Enterale Ernährung',
        nameDe: 'Ernährungspumpe', nameEn: 'Enteral feeding pump',
        descriptionDe: 'Pumpe zur kontrollierten Zufuhr von Sondennahrung',
        descriptionEn: 'Pump for controlled delivery of tube feeding formula',
        alsPhase: 'Mittel–Spät', alsfrsArea: 'Nahrungsaufnahme',
        tags: 'ernährungspumpe, feeding pump, pumpe, enteral',
        reimbursement: {
            de: { productGroup: 'PG 03', label: 'Applikationshilfen', code: '03.99.02.xxx', prescriber: 'Arzt', notes: 'Verordnung' },
        },
    },
    {
        id: 'ERN-008', isoClass: '04', isoSubclass: '04.19',
        category: 'nutrition', subcategory: 'Enterale Ernährung',
        nameDe: 'Sondennahrung / Trinknahrung', nameEn: 'Enteral formula / Oral nutritional supplement',
        descriptionDe: 'Hochkalorische Flüssignahrung für PEG oder oral',
        descriptionEn: 'High-calorie liquid nutrition for tube feeding or oral supplementation',
        alsPhase: 'Mittel–Spät', alsfrsArea: 'Nahrungsaufnahme',
        tags: 'sondennahrung, trinknahrung, formula, supplement',
        reimbursement: {
            de: { productGroup: 'PG 03', label: 'Applikationshilfen', code: '03.99.99.xxx', prescriber: 'Arzt', notes: 'Verordnung als enterale Ernährung' },
        },
    },

    // =========================================================================
    // ALL — Alltagshilfen (9)
    // =========================================================================
    {
        id: 'ALL-001', isoClass: '09', isoSubclass: '09.12',
        category: 'daily_living', subcategory: 'Bad & Toilette',
        nameDe: 'Toilettensitzerhöhung', nameEn: 'Raised toilet seat',
        descriptionDe: 'Aufsatz zur Erhöhung des WC-Sitzes',
        descriptionEn: 'Seat raiser to increase toilet seat height',
        alsPhase: 'Früh–Mittel', alsfrsArea: 'Toilettengang',
        tags: 'toilettensitz, raised toilet seat, wc',
        reimbursement: {
            de: { productGroup: 'PG 33', label: 'Toilettenhilfen', code: '33.40.01.xxx', prescriber: 'Arzt', notes: 'Verordnung' },
        },
    },
    {
        id: 'ALL-002', isoClass: '09', isoSubclass: '09.33',
        category: 'daily_living', subcategory: 'Bad & Toilette',
        nameDe: 'Dusch-/Badewannensitz', nameEn: 'Shower chair / Bath seat',
        descriptionDe: 'Sitz für sicheres Duschen oder Baden im Sitzen',
        descriptionEn: 'Seat for safe showering or bathing while seated',
        alsPhase: 'Früh–Mittel', alsfrsArea: 'Ankleiden & Hygiene',
        tags: 'duschsitz, shower chair, bath seat, badesitz',
        reimbursement: {
            de: { productGroup: 'PG 33', label: 'Toilettenhilfen/Badehilfen', code: '33.40.04.xxx', prescriber: 'Arzt', notes: 'Verordnung' },
        },
    },
    {
        id: 'ALL-003', isoClass: '18', isoSubclass: '18.18',
        category: 'daily_living', subcategory: 'Bad & Toilette',
        nameDe: 'Haltegriffe / Stützgriffe', nameEn: 'Grab bars / Support rails',
        descriptionDe: 'Fest montierte Griffe an Wand in Bad/WC',
        descriptionEn: 'Wall-mounted grab bars in bathroom/toilet',
        alsPhase: 'Früh', alsfrsArea: 'Ankleiden & Hygiene',
        tags: 'haltegriff, grab bar, stützgriff, support rail',
        reimbursement: {
            de: { productGroup: 'PG 33', label: 'Toilettenhilfen', code: '33.40.02.xxx', prescriber: 'Arzt', notes: 'Verordnung oder Wohnumfeldverbess.' },
        },
    },
    {
        id: 'ALL-004', isoClass: '12', isoSubclass: '12.22',
        category: 'daily_living', subcategory: 'Bad & Toilette',
        nameDe: 'Duschrollstuhl / Toilettenrollstuhl', nameEn: 'Shower / Commode wheelchair',
        descriptionDe: 'Rollstuhl für Nassbereiche und als Toilettenstuhl',
        descriptionEn: 'Wheelchair for wet areas, doubles as commode chair',
        alsPhase: 'Mittel–Spät', alsfrsArea: 'Ankleiden & Hygiene',
        tags: 'duschrollstuhl, commode, shower wheelchair',
        reimbursement: {
            de: { productGroup: 'PG 18', label: 'Krankenfahrzeuge', code: '18.46.04.xxx', prescriber: 'Arzt', notes: 'Verordnung' },
        },
    },
    {
        id: 'ALL-005', isoClass: '09', isoSubclass: '09.09',
        category: 'daily_living', subcategory: 'Ankleidehilfen',
        nameDe: 'Anziehhilfe / Strumpfanzieher', nameEn: 'Dressing aid / Stocking aid',
        descriptionDe: 'Hilfsmittel zum eigenständigen An-/Ausziehen von Kleidung',
        descriptionEn: 'Aid for independent dressing and undressing',
        alsPhase: 'Früh–Mittel', alsfrsArea: 'Ankleiden & Hygiene',
        tags: 'anziehhilfe, dressing aid, strumpfanzieher, stocking',
        reimbursement: {
            de: { productGroup: 'PG 02', label: 'Adaptionshilfen', code: '02.40.01.xxx', prescriber: 'Arzt/Ergo', notes: 'Verordnung' },
        },
    },
    {
        id: 'ALL-006', isoClass: '09', isoSubclass: '09.09',
        category: 'daily_living', subcategory: 'Ankleidehilfen',
        nameDe: 'Knöpfhilfe / Reißverschlusszieher', nameEn: 'Button hook / Zipper pull',
        descriptionDe: 'Kleine Hilfen für Feinmotorik beim Ankleiden',
        descriptionEn: 'Small aids for fine motor tasks during dressing',
        alsPhase: 'Früh–Mittel', alsfrsArea: 'Ankleiden & Hygiene',
        tags: 'knöpfhilfe, button hook, zipper pull, reißverschluss',
        reimbursement: {
            de: { productGroup: 'PG 02', label: 'Adaptionshilfen', code: '02.40.01.xxx', prescriber: 'Arzt/Ergo', notes: 'Verordnung' },
        },
    },
    {
        id: 'ALL-007', isoClass: '24', isoSubclass: '24.21',
        category: 'daily_living', subcategory: 'Greifhilfen',
        nameDe: 'Greifzange / Reacher', nameEn: 'Reacher / Grabber',
        descriptionDe: 'Verlängerter Greifarm zum Aufheben von Gegenständen',
        descriptionEn: 'Extended grabber for picking up objects',
        alsPhase: 'Früh–Mittel', alsfrsArea: 'Ankleiden & Hygiene',
        tags: 'greifzange, reacher, grabber, greifhilfe',
        reimbursement: {
            de: { productGroup: 'PG 02', label: 'Adaptionshilfen', code: '02.40.01.xxx', prescriber: 'Arzt/Ergo', notes: 'Verordnung' },
        },
    },
    {
        id: 'ALL-008', isoClass: '24', isoSubclass: '24.06',
        category: 'daily_living', subcategory: 'Greifhilfen',
        nameDe: 'Flaschenöffner / Dosenöffner (adaptiv)', nameEn: 'Adaptive jar / Can opener',
        descriptionDe: 'Ergonomische Öffnungshilfen bei eingeschränkter Greifkraft',
        descriptionEn: 'Ergonomic opening aids for reduced grip strength',
        alsPhase: 'Früh', alsfrsArea: 'Nahrungsaufnahme',
        tags: 'öffner, opener, adaptiv, jar opener, flaschenöffner',
        reimbursement: {
            de: { productGroup: 'PG 02', label: 'Adaptionshilfen', code: '02.40.02.xxx', prescriber: 'Arzt/Ergo', notes: 'Verordnung' },
        },
    },
    {
        id: 'ALL-009', isoClass: '09', isoSubclass: '09.33',
        category: 'daily_living', subcategory: 'Bad & Toilette',
        nameDe: 'Handbrause mit langem Schlauch', nameEn: 'Handheld shower head (long hose)',
        descriptionDe: 'Flexible Duschbrause für das Duschen im Sitzen',
        descriptionEn: 'Flexible shower head for showering while seated',
        alsPhase: 'Früh–Mittel', alsfrsArea: 'Ankleiden & Hygiene',
        tags: 'handbrause, shower head, duschbrause',
        reimbursement: {
            de: { productGroup: '—', label: 'Nicht im GKV-Verzeichnis', code: '—', prescriber: '—', notes: 'Eigenfinanzierung / Wohnumfeldverbess.' },
        },
    },
];

// Lookup helpers

export function getCatalogEntry(id: string): AidCatalogEntry | undefined {
    return AID_CATALOG.find(e => e.id === id);
}

export function getCatalogByCategory(category: AidCategory): AidCatalogEntry[] {
    return AID_CATALOG.filter(e => e.category === category);
}

export function getCatalogName(entry: AidCatalogEntry, locale: string): string {
    return locale.startsWith('de') ? entry.nameDe : entry.nameEn;
}

export function getCatalogDescription(entry: AidCatalogEntry, locale: string): string {
    return locale.startsWith('de') ? entry.descriptionDe : entry.descriptionEn;
}

export function getReimbursementInfo(entry: AidCatalogEntry, countryCode: string) {
    const code = countryCode.toLowerCase();
    if (code === 'de' || code === 'deu') return entry.reimbursement?.de;
    if (code === 'at' || code === 'aut') return entry.reimbursement?.at;
    if (code === 'ch' || code === 'che') return entry.reimbursement?.ch;
    return undefined;
}
