# Metrics Module

A generic system for capturing, storing, and displaying health metrics. Supports FHIR-compliant data storage, flexible metric definitions, and full internationalization.

## Directory Structure

```
src/metrics/
├── index.ts                 # Main export (Public API)
├── types.ts                 # TypeScript type definitions
├── README.md                # This documentation
├── METRICS.md               # List of all available metrics
├── definitions/             # Metric definitions (Base + Locale pattern)
│   ├── index.ts             # Registry & helper functions
│   ├── weight/              # Example metric
│   │   ├── base.ts          # Language-neutral technical definition
│   │   ├── index.ts         # getDefinition(language) + legacy export
│   │   └── locales/
│   │       ├── de.json      # German texts
│   │       ├── en.json      # English texts
│   │       └── ...          # one JSON per supported app language (12)
│   ├── bloodPressure/       # Multi-value metric
│   │   ├── base.ts
│   │   ├── index.ts
│   │   └── locales/
│   └── ...                  # 49 metrics total
├── platformAvailability.ts  # isMetricAvailableOnPlatform() helper (ios/android gating)
├── hooks/
│   ├── useMetric.ts         # React hook for CRUD operations
│   └── useTDEE.ts           # Computed energy expenditure (TDEE)
├── fhir/
│   └── metricToFhir.ts      # FHIR conversion
└── components/
    ├── index.ts
    ├── MetricCard.tsx        # Card display
    ├── MetricValueDisplay.tsx # Value display
    └── MetricInputForm.tsx   # Input form
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI Layer                                │
│  ┌─────────────┐  ┌──────────────────┐  ┌───────────────────┐  │
│  │ MetricCard  │  │ MetricValueDisplay│  │ MetricInputForm   │  │
│  └─────────────┘  └──────────────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Hook Layer                                │
│            ┌─────────────┐    ┌──────────┐                     │
│            │  useMetric  │    │  useTDEE │                     │
│            └─────────────┘    └──────────┘                     │
│                   │                                             │
│      ┌────────────┼────────────┐                               │
│      ▼            ▼            ▼                               │
│ addEntry    updateEntry   deleteEntry                          │
│ getEntry    loadEntries   setUnitPreference                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FHIR Layer                                 │
│  ┌────────────────────┐    ┌────────────────────┐              │
│  │ metricEntryToFhir  │    │  fhirToMetricEntry │              │
│  └────────────────────┘    └────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Storage Layer                                 │
│                    ┌─────────────┐                              │
│                    │ useFhirRepo │ → SQLite + Sync              │
│                    └─────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Base + Locale Pattern

Each metric definition is split into language-neutral and language-specific parts:

**`base.ts`** — Technical configuration (FHIR codes, validation, chart, etc.):
```typescript
const base: MetricBaseDefinition = {
    id: 'weight',
    icon: 'scalemass.fill',
    iconColor: '#FF6B9D',
    fhir: {
        code: { system: 'http://loinc.org', code: '29463-7', display: 'Body weight' },
        category: 'vital-signs',
    },
    fields: [{
        key: 'value',
        inputType: 'decimal',
        decimalPlaces: 1,
        placeholder: '0,0',
        validation: { min: 20, max: 300, required: true },
    }],
    defaultUnit: 'kg',
    availableUnits: [
        { value: 'kg', label: 'Kilogramm' },
        { value: 'lb', label: 'Pfund', conversionFactor: 2.20462 },
    ],
    chart: { type: 'line', yAxis: { padding: 1 } },
    canPin: true,
    defaultPinned: true,
    defaultPinnedOrder: 10,
    sortOrder: 10,
    category: 'body',
};
```

**`locales/de.json`** — German texts:
```json
{
    "name": "Gewicht",
    "shortName": "Gewicht",
    "descriptionTitle": "Über Körpergewicht",
    "description": "Das Körpergewicht ist ein wichtiger Indikator...",
    "fields": {
        "value": { "label": "Gewicht" }
    }
}
```

**`locales/en.json`** — English texts:
```json
{
    "name": "Weight",
    "shortName": "Weight",
    "descriptionTitle": "About Body Weight",
    "description": "Body weight is an important indicator...",
    "fields": {
        "value": { "label": "Weight" }
    }
}
```

**`index.ts`** — Merged via `mergeMetricDefinition()`:
```typescript
export function getDefinition(language: string): MetricDefinition {
    const locale = locales[language] ?? locales.en;
    return mergeMetricDefinition(base, locale);
}
```

### 2. MetricDefinition

A `MetricDefinition` fully describes how a metric is captured, stored, and displayed:

```typescript
type MetricDefinition = {
    id: string;              // Unique ID (e.g. 'weight', 'blood_pressure')
    name: string;            // Display name (language-dependent)
    shortName?: string;      // Short name for compact display
    icon: string;            // SF Symbol name
    iconColor: string;       // Hex color code
    description: string;     // Description text (language-dependent)
    descriptionTitle?: string;

    fhir: {
        code: FhirCoding;    // LOINC code for FHIR
        category: ObservationCategory;  // vital-signs | laboratory | survey | activity
    };

    fields: MetricField[];   // Input fields (1 or more)
    defaultUnit: string;     // Default unit
    showUnit?: boolean;      // Show unit in UI (default: true)
    availableUnits?: UnitOption[]; // Alternative units with conversion factor

    chart: MetricChartConfig;
    canPin?: boolean;        // Can be pinned to home overview
    defaultPinned?: boolean; // Pinned by default for new users
    defaultPinnedOrder?: number;
    sortOrder?: number;      // Sort order in lists
    category: MetricCategory; // App category (body, vital-signs, etc.)
    computed?: boolean;      // Computed metric without stored entries (e.g. TDEE)

    /** OSes on which this metric is available at all. Absent = all platforms.
     *  Set ONLY for metrics fed exclusively by a platform-specific passive source
     *  with no manual entry (e.g. iOS mobility/gait metrics, Android-only hrv_rmssd). */
    platforms?: Array<'ios' | 'android'>;

    /** Read-only import mapping from the device health store (HealthKit / Health
     *  Connect). Absent = manual entry only. See "External Health Import" below. */
    externalHealth?: ExternalHealthMapping;

    schedule?: {
        frequencyDays: number;   // Interval in days
        showForDays?: number;    // Display window per cycle (hides after X days)
        startAfterDays?: number; // Delay before first appearance (relative to account creation)
    };
    todoByDefault?: boolean; // Show in todo list by default (default: true)
    todoRules?: TodoCondition[]; // Conditional rules for todo visibility (see below)
};
```

### 3. Single-Value vs. Multi-Value Metrics

**Single-value metric** (e.g. weight):
```typescript
fields: [{
    key: 'value',
    inputType: 'decimal',
    decimalPlaces: 1,
    validation: { min: 20, max: 300, required: true }
}]
```

**Multi-value metric** (e.g. blood pressure):
```typescript
fields: [
    {
        key: 'systolic',
        fhirComponentCode: { system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' },
        inputType: 'integer',
        validation: { min: 60, max: 250, required: true }
    },
    {
        key: 'diastolic',
        fhirComponentCode: { system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' },
        inputType: 'integer',
        validation: { min: 40, max: 150, required: true }
    }
]
```

For multi-value metrics, each field is stored as a FHIR Component. Each field requires its own `fhirComponentCode`.

### 4. Discrete Scales with Value Labels

For metrics with a limited value range (e.g. fasciculations 0-3):

```typescript
// base.ts
fields: [{
    key: 'value',
    inputType: 'integer',
    valueLabels: [{ value: 0 }, { value: 1 }, { value: 2 }, { value: 3 }],
    validation: { min: 0, max: 3, required: true },
}]

// de.json
"fields": {
    "value": {
        "label": "Häufigkeit",
        "valueLabels": {
            "0": "Keine",
            "1": "Selten",
            "2": "Häufig",
            "3": "Sehr häufig"
        }
    }
}
```

### 5. MetricEntry

A `MetricEntry` represents a single measurement:

```typescript
type MetricEntry = {
    id: string;                      // FHIR Resource ID
    values: Record<string, number>;  // { systolic: 120, diastolic: 80 }
    date: Date;                      // Measurement timestamp
    unit: string;                    // Unit used
    source?: string;                 // Source (e.g. 'app', 'Apple Health')
    addedAt?: Date;                  // When added to system
    recordedByRole?: string;         // Role (patient, caregiver, doctor)
};
```

### 6. App Categories

Metrics are grouped into 10 UI categories:

| Category | ID | Icon | Color |
|---|---|---|---|
| Functional Status | `assessment` | `waveform.path.ecg` | #5856D6 |
| Body & Weight | `body` | `figure` | #5856D6 |
| Vital Signs | `vital-signs` | `heart.fill` | #FF2D55 |
| Respiratory | `respiratory` | `lungs.fill` | #00C7BE |
| Motor & Strength | `motor` | `figure.walk` | #FF9500 |
| Symptoms | `symptoms` | `list.clipboard.fill` | #AF52DE |
| Bulbar Function | `bulbar` | `mouth.fill` | #FF3B30 |
| Nutrition | `nutrition` | `fork.knife` | #34C759 |
| Digestion | `digestion` | `toilet.fill` | #FF9500 |
| Biomarker | `biomarker` | `drop.fill` | #007AFF |

### 7. Computed Metrics

Metrics with `computed: true` have no stored entries but are calculated live. Example: TDEE (Total Daily Energy Expenditure) is calculated from patient data + ALSFRS-R score.

### 8. Todo Rules (Conditional Todo Visibility)

Metrics with `todoByDefault: false` are normally hidden from the todo list. With `todoRules`, they can appear conditionally based on patient data — for example, showing FVC measurement only when respiratory function is declining.

**Types** (`src/types/todoRules.ts`):

```typescript
type ComparisonOperator = 'lt' | 'lte' | 'gt' | 'gte';

type TodoCondition =
    | { type: 'questionnaireDomainScore'; questionnaireId: string; domainId: string; operator: ComparisonOperator; value: number }
    | { type: 'questionnaireTotalScore'; questionnaireId: string; operator: ComparisonOperator; value: number }
    | { type: 'metricValue'; metricId: string; fieldKey: string; operator: ComparisonOperator; value: number };
```

**Condition Types:**

| Type | Description | Example |
|---|---|---|
| `questionnaireDomainScore` | Domain subscore of a questionnaire | ALSFRS-R respiratory domain < 8 |
| `questionnaireTotalScore` | Total score of a questionnaire | PHQ-9 total score >= 10 |
| `metricValue` | Value of a specific metric field | SpO2 value < 92 |

**Evaluation Logic:**
- Rules use AND-logic: **all** conditions must match for the item to appear
- If referenced data doesn't exist (questionnaire/metric never completed), the condition evaluates to `false` → item stays hidden
- Rules are only evaluated when `todoByDefault: false` and the user hasn't explicitly configured the item
- `schedule` and `isDue` checks still apply after rules match

**Semantics:**

| `todoByDefault` | `todoRules` | User config | Result |
|---|---|---|---|
| `true` (default) | ignored | — | Always shown (when due) |
| `false` | none/empty | — | Hidden |
| `false` | match | — | Shown (when due) |
| `false` | match | `enabled: false` | Hidden (user override) |
| `false` | no match | `enabled: true` | Shown (user override) |

**Example: FVC conditional on respiratory function:**

```typescript
// definitions/fvc/base.ts
{
    schedule: { frequencyDays: 7, showForDays: 3 },
    todoByDefault: false,
    todoRules: [
        {
            type: 'questionnaireDomainScore',
            questionnaireId: 'alsfrs-r',
            domainId: 'respiratory',
            operator: 'lt',
            value: 8,    // FVC appears when respiratory domain < 8 (of max 12)
        },
    ],
}
```

**Rule Engine** (`src/hooks/todoRuleEngine.ts`):
- `evaluateTodoRules(rules, ctx)` → `boolean` — Evaluates all conditions (AND-logic)
- `collectRuleDataSources(rules)` → `{ questionnaireIds, metricIds }` — Collects IDs for pre-loading
- `compare(actual, operator, threshold)` → `boolean` — Comparison helper

The `useTodoItems` hook pre-loads all referenced questionnaire and metric data before evaluating rules synchronously.

### 9. Staggered Start (startAfterDays)

Metrics (and questionnaires) with `startAfterDays` on their schedule are hidden from the todo list until the specified number of days after account creation. This prevents overwhelming new users with all items on day one.

```typescript
schedule: {
    frequencyDays: 7,
    showForDays: 3,
    startAfterDays: 14,  // Hidden for first 2 weeks after account creation
},
```

The reference date is `PatientPreferences.createdAt` (set once on first account creation, synced across devices). For existing patients without `createdAt`, it is backfilled from `updatedAt`.

### 10. External Health Import (`externalHealth`)

A metric can be populated automatically and **read-only** from the device health store — Apple HealthKit on iOS and Android Health Connect. This is opt-in per metric: a metric is importable only if its `base.ts` declares an `externalHealth` mapping. TENOS never writes back to Apple Health or Health Connect.

```typescript
// definitions/stepCount/base.ts
externalHealth: {
    aggregation: 'daily-sum',
    importPolicy: { mode: 'daily-sum' },
    appleHealthKit: {
        read: [{ quantityType: 'HKQuantityTypeIdentifierStepCount', unit: 'count', field: 'value' }],
    },
    healthConnect: {
        read: [{ recordType: 'Steps', fieldPath: 'count', unit: 'count', field: 'value' }],
    },
},
```

**Import policies** (`importPolicy.mode`):

| Mode | Behaviour | Example metric |
|---|---|---|
| `all` | every sample becomes an entry | — |
| `latest` | only the single most recent sample | — |
| `daily-latest` | last reading of each day | `weight`, `heart_rate` |
| `daily-first-and-last` | first and last reading of each day | `blood_pressure` |
| `daily-sum` | sum per day (cumulative metrics) | `step_count`, `flights_climbed` |
| `daily-average` | mean per day (rate-like metrics) | `walking_speed`, `respiratory_rate` |

Each imported observation carries a stable per-day external ID (e.g. `daily-sum:<metricId>:<day>`) so re-importing is idempotent — no duplicate entries.

**HealthKit category types** are supported via a `categoryType` mapping variant with a dedicated category-query branch in the adapter. (Note: `NumberOfTimesFallen` is a *quantity* type, not a category, so `falls` uses the quantity path; the category path is reserved for true category types such as sleep analysis.) **Health Connect series records** (e.g. `Speed`) are expanded sample-by-sample by the adapter.

**Platform asymmetry.** Apple's mobility/gait types and spirometry (FVC) have no Health Connect equivalent → those metrics import on iOS only. Where a metric is *exclusively* fed by a platform-specific passive source and has no manual entry, set `platforms` (§ above) so it is hidden entirely on the unsupported OS (e.g. `walking_step_length` is `['ios']`, `hrv_rmssd` is `['android']`). Metrics that stay manually enterable on both OSes (e.g. `falls`, `fvc`) do **not** set `platforms`; only their import is platform-gated.

The import pipeline (adapters, registry, dedupe, import service, auto-import) lives in [`src/services/externalHealth`](../services/externalHealth). New Android-importable metrics must also be added to the Health Connect read-permission list in `registry.ts`, or the import silently fails. See [METRICS.md](./METRICS.md#health-import) for the full per-metric import table.

## Registry API

### Dynamic API (recommended)

```typescript
import {
    getMetricDefinition,
    getAllMetricDefinitions,
    getSortedMetricDefinitions,
    getMetricsByCategory,
    getMetricsByAppCategory,
    getPinnableMetrics,
    getDefaultPinnedMetrics,
} from '@/src/metrics';

// Single metric (current app language)
const weight = getMetricDefinition('weight');

// Single metric in specific language
const weightEn = getMetricDefinition('weight', 'en');

// All metrics sorted
const all = getSortedMetricDefinitions();

// Filter by FHIR category
const vitalSigns = getMetricsByCategory('vital-signs');

// Filter by app category
const bodyMetrics = getMetricsByAppCategory('body');

// Pinnable metrics for selection UI
const pinnable = getPinnableMetrics();
```

### Legacy API (deprecated)

```typescript
// Static arrays in German — DO NOT use for new code
import { metricDefinitions, metricRegistry, weightMetric } from '@/src/metrics';
```

## useMetric Hook

The `useMetric` hook is the central interface for all metric operations:

```typescript
const {
    // Data
    definition,      // MetricDefinition (language-dependent)
    entries,         // MetricEntry[] (sorted, newest first)
    latestEntry,     // Latest entry or null
    stats,           // Computed statistics

    // Status
    isLoading,
    error,

    // Units
    preferredUnit,
    setUnitPreference,

    // CRUD Operations
    getEntry,        // Load single entry
    addEntry,        // Create new entry
    updateEntry,     // Update entry
    deleteEntry,     // Delete entry

    // Utilities
    validate,        // Validate values
    refresh,         // Reload data
} = useMetric({ metricId: 'weight' });
```

### Example: Creating a New Entry

```typescript
const { addEntry, validate } = useMetric({ metricId: 'blood_pressure' });

const handleSave = async () => {
    const values = { systolic: 120, diastolic: 80 };
    const { valid, errors } = validate(values);
    if (!valid) return;

    await addEntry(values, 'mmHg', new Date());
};
```

### Statistics

The hook automatically computes statistics:

```typescript
type MetricStats = {
    count: number;
    average: number | null;
    min: number | null;
    max: number | null;
    trend: 'up' | 'down' | 'stable' | null;
    changeFromPrevious: number | null;
    percentChangeFromPrevious: number | null;
};
```

### Shared Cache

All `useMetric` instances share a common observations cache. This prevents duplicate DB queries. The cache is invalidated via the `fhir:changed` event bus.

## useTDEE Hook

Calculates the total daily energy expenditure using the Kasarskis formula:

```typescript
const {
    calories,           // kcal/day
    waterLiters,        // L/day
    breakdown,          // { bmr, activityFactor, alsAdjustment, tdee }
    patientData,        // weight, height, age, gender
    alsfrs6,            // 6-question subset from ALSFRS-R
    missingPatientData, // true if data is missing
    missingDataFields,  // which fields are missing
} = useTDEE();
```

ALSFRS-6 questions: swallowing (Q3), handwriting (Q4), dressing (Q6), turning_in_bed (Q7), walking (Q8), dyspnea (Q10). Max: 24 points.

## FHIR Conversion

### MetricEntry → FHIR Observation

```typescript
import { metricEntryToFhir } from '@/src/metrics';

const fhir = metricEntryToFhir(entry, bloodPressureDefinition, 'Patient/patient-123');
// Creates FHIR Observation with Components for multi-value metrics
```

### FHIR Observation → MetricEntry

```typescript
import { fhirToMetricEntry } from '@/src/metrics';

const entry = fhirToMetricEntry(fhirObservation, bloodPressureDefinition);
```

### Unit Conversion

```typescript
import { convertUnit } from '@/src/metrics';

const lbs = convertUnit(70, 'kg', 'lb', weightDefinition);
// → 154.32
```

## Components

### MetricCard

Displays a metric as a card with the current value:

```tsx
<MetricCard
    definition={weightDefinition}
    latestEntry={latestEntry}
    trend="down"
    changeFromPrevious={-0.5}
    entryCount={12}
    onPress={() => navigateToDetail()}
/>
```

### MetricValueDisplay

Displays the value of a metric:

```tsx
<MetricValueDisplay
    definition={definition}
    entry={entry}
    showTrend={true}
    trend="stable"
    compact={false}
/>
```

### MetricInputForm

Dynamic input form based on definition:

```tsx
<MetricInputForm
    definition={definition}
    initialValues={{ systolic: 120, diastolic: 80 }}
    onSubmit={(values, unit) => handleSave(values, unit)}
    onCancel={() => goBack()}
    isSubmitting={isLoading}
    errors={validationErrors}
/>
```

## Event System

The module uses an event bus for reactive updates:

```typescript
import { emit, on } from '@/src/lib/bus';

// Register listener
const off = on('fhir:changed', () => {
    // Reload data
});

// Emit event (done automatically on CRUD operations)
emit('fhir:changed');
```

## Role Tracking

Each entry automatically stores the role of the recorder:

```typescript
{
    meta: {
        extension: [{
            url: 'urn:medical-sync-vault:recorded-by-role',
            valueCode: 'caregiver'  // patient | caregiver | doctor
        }]
    }
}
```

## Adding a New Metric

### 1. Create Directory

```
definitions/myMetric/
├── base.ts
├── index.ts
└── locales/
    ├── de.json
    └── en.json
```

### 2. Base Definition (`base.ts`)

```typescript
import type { MetricBaseDefinition } from '../../types';

const base: MetricBaseDefinition = {
    id: 'my_metric',
    icon: 'thermometer',
    iconColor: '#FF6B6B',
    fhir: {
        code: { system: 'http://loinc.org', code: '8310-5', display: 'Body temperature' },
        category: 'vital-signs',
    },
    fields: [{
        key: 'value',
        inputType: 'decimal',
        decimalPlaces: 1,
        placeholder: '36,5',
        validation: { min: 34, max: 42, required: true },
    }],
    defaultUnit: '°C',
    availableUnits: [
        { value: '°C', label: 'Celsius' },
        { value: '°F', label: 'Fahrenheit', conversionFactor: 1.8 },
    ],
    chart: { type: 'line' },
    canPin: true,
    sortOrder: 50,
    category: 'vital-signs',
    schedule: { frequencyDays: 7, showForDays: 3 },
    todoByDefault: true,
    // Optional: conditional todo rules (see "Todo Rules" section above)
    // todoRules: [{ type: 'questionnaireDomainScore', questionnaireId: '...', domainId: '...', operator: 'lt', value: 8 }],
};

export default base;
```

### 3. Locale Files (`locales/de.json`, `locales/en.json`)

```json
{
    "name": "Body Temperature",
    "shortName": "Temp.",
    "descriptionTitle": "About Body Temperature",
    "description": "Body temperature is an important vital parameter...",
    "fields": {
        "value": { "label": "Temperature" }
    }
}
```

### 4. Index File (`index.ts`)

```typescript
import type { MetricDefinition, MetricLocale } from '../../types';
import { mergeMetricDefinition } from '../../types';
import base from './base';
import deLocale from './locales/de.json';
import enLocale from './locales/en.json';

const locales: Record<string, MetricLocale> = {
    de: deLocale as MetricLocale,
    en: enLocale as MetricLocale,
};

export function getDefinition(language: string): MetricDefinition {
    const locale = locales[language] ?? locales.en;
    return mergeMetricDefinition(base, locale);
}

/** @deprecated Use getDefinition(language) instead */
export const myMetricMetric = getDefinition('de');
```

### 5. Register in Registry (`definitions/index.ts`)

```typescript
import { getDefinition as getMyMetricDef, myMetricMetric } from './myMetric';

// Add to definitionGetters:
const definitionGetters = {
    // ...
    'my_metric': getMyMetricDef,
};

// Add to metricIds:
const metricIds = [
    // ...
    'my_metric',
];

// Add to legacy array:
export const metricDefinitions = [
    // ...
    myMetricMetric,
];
```

### 6. Finding a LOINC Code

Valid LOINC codes: https://loinc.org/search/

FHIR categories:
- `vital-signs` — Vital signs (heart rate, blood pressure, temperature, SpO2, etc.)
- `laboratory` — Lab values (NFL, creatinine, etc.)
- `survey` — Questionnaires/self-assessments (pain, fatigue, etc.)
- `activity` — Activity data (steps, walking distance, etc.)

## Chart Configuration

```typescript
chart: {
    type: 'line' | 'bar' | 'scatter',
    primaryField?: string,     // For multi-value: primary field in chart
    secondaryField?: string,   // For multi-value: secondary field
    showChart?: boolean,       // false for very limited scales (0-3)
    showAverage?: boolean,     // false for counts or discrete scales
    yAxis?: {
        min?: number,          // Fixed minimum
        max?: number,          // Fixed maximum (e.g. 100 for %)
        padding?: number,      // Padding as fraction (0-1), default: 0.15
    },
    referenceLine?: {
        value: number,
        label: string,
    },
}
```

## All Available Metrics (49)

Metrics marked ⬇︎ support read-only health-store import (see [External Health Import](#10-external-health-import-externalhealth)).

| Category | Metrics |
|---|---|
| Functional Status | `als_genetic_background`, `als_kings_stage`, `als_neurological_exam`, `als_subtype`, `alsfrs-r` |
| Body & Weight | `bmi`, `body_fat` ⬇︎, `weight` ⬇︎ |
| Vital Signs | `blood_oxygen` ⬇︎, `blood_pressure` ⬇︎, `body_temperature` ⬇︎, `heart_rate` ⬇︎, `hrv_rmssd` ⬇︎, `hrv_sdnn` ⬇︎, `nocturnal_spo2` |
| Respiratory | `fvc` ⬇︎, `fvc_percent`, `peak_cough_flow`, `respiratory_rate` ⬇︎ |
| Motor & Mobility | `falls` ⬇︎, `flights_climbed` ⬇︎, `grip_strength`, `stair_descent_speed` ⬇︎, `step_count` ⬇︎, `walking_asymmetry` ⬇︎, `walking_distance` ⬇︎, `walking_double_support` ⬇︎, `walking_speed` ⬇︎, `walking_steadiness` ⬇︎, `walking_step_length` ⬇︎ |
| Symptoms | `cold_sensitivity`, `cramps`, `fasciculations`, `fatigue`, `pain_level`, `pain_mobility`, `pain_mood`, `pain_sleep`, `suicidality` |
| Bulbar Function | `sialorrhea`, `speech_rate`, `swallowing_time` |
| Nutrition | `active_energy` ⬇︎, `caloric_intake` ⬇︎, `fluid_intake` ⬇︎, `tdee` (computed) |
| Digestion | `bristol_stool_scale` |
| Biomarker | `nfl`, `nfl_csf` |

The iOS-only mobility metrics (`stair_descent_speed`, `walking_asymmetry`, `walking_double_support`, `walking_steadiness`, `walking_step_length`) and `hrv_sdnn` are hidden on Android; `hrv_rmssd` is hidden on iOS.

Details for each metric: [METRICS.md](./METRICS.md)

## See Also

- [METRICS.md](./METRICS.md) — List of all available metrics with LOINC codes
- [useFhirRepo](../hooks/useFhirRepo.ts) — FHIR data access
- [AppRoleProvider](../context/AppRoleProvider.tsx) — Role management
- [Questionnaires](../questionnaires/README.md) — Questionnaire system
