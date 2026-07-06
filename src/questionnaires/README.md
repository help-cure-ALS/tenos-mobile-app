# Questionnaires Module

A generic system for capturing, scoring, and storing health questionnaires. Supports flexible FHIR storage strategies, scoring with interpretations, scheduling, and full internationalization.

## Directory Structure

```
src/questionnaires/
├── index.ts                     # Main export (Public API)
├── types.ts                     # TypeScript type definitions
├── README.md                    # This documentation
├── definitions/                 # Questionnaire definitions (Base + Locale pattern)
│   ├── index.ts                 # Registry & helper functions
│   ├── alsfrs-r/                # ALSFRS-R (Functional status)
│   │   ├── base.ts              # Language-neutral technical definition
│   │   ├── index.ts             # getDefinition(language) + legacy export
│   │   └── locales/
│   │       ├── de.json          # German texts
│   │       └── en.json          # English texts
│   ├── daily-check/             # Daily Symptom Check (hybrid)
│   ├── phq9/                    # PHQ-9 Depression screening
│   ├── bdi-fs/                  # BDI-FS Depression inventory
│   ├── who5/                    # WHO-5 Well-being
│   ├── pdq5/                    # PDQ-5 Quality of life
│   └── pes/                     # PES Pain Effects Scale
├── hooks/
│   └── useQuestionnaire.ts      # React hooks (data + form)
├── fhir/
│   └── questionnaireToFhir.ts   # FHIR storage & loading
└── components/
    ├── index.ts
    ├── QuestionnaireScreen.tsx   # Full-screen questionnaire UI
    ├── QuestionnaireCard.tsx     # Card display
    └── QuestionnaireCarousel.tsx # Carousel for overview
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI Layer                                │
│  ┌───────────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │QuestionnaireScreen│  │QuestionnaireCard│  │   Carousel     │ │
│  └───────────────────┘  └────────────────┘  └────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Hook Layer                                │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │   useQuestionnaire   │  │  useQuestionnaireForm │            │
│  │  (data + CRUD)       │  │  (form state)         │            │
│  └──────────────────────┘  └──────────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FHIR Layer                                 │
│  ┌──────────────────────────┐  ┌──────────────────────────┐    │
│  │ saveQuestionnaireAnswers │  │ loadQuestionnaireEntries │    │
│  │ getLatestQuestionValue   │  │ getQuestionHistory       │    │
│  └──────────────────────────┘  └──────────────────────────┘    │
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

### 1. FHIR Storage Strategies

Each questionnaire defines how answers are stored in FHIR:

| Strategy | Description | Use Case |
|---|---|---|
| `questionnaireResponse` | One FHIR QuestionnaireResponse per completion | Standard questionnaires (PHQ-9, WHO-5, ALSFRS-R) |
| `observations` | Each question as individual FHIR Observation | When each answer needs individual trending |
| `hybrid` | QuestionnaireResponse + selected questions as Observations | Daily check: full response + individual symptoms for trending |

**Hybrid Strategy in Detail:**

With `hybrid`, each question individually decides whether it's also stored as an Observation:

```typescript
// base.ts
questions: [{
    id: 'pain',
    storeAsObservation: true,   // → Also stored as individual Observation
    fhirCode: { system: 'http://loinc.org', code: '54834-7', display: 'Pain severity' },
    fhirUnit: '/4',             // Compatibility with metrics system
}, {
    id: 'mood',
    storeAsObservation: false,  // → Only in QuestionnaireResponse
}]
```

Questions with `storeAsObservation: true` appear in the metrics trend chart (same LOINC code). The `fhirUnit` field ensures compatibility with the metrics system.

### 2. Base + Locale Pattern

Like the metrics module, definitions are split into language-neutral and language-specific parts:

**`base.ts`** — Technical configuration:
```typescript
const base: QuestionnaireBaseDefinition = {
    id: 'daily-check',
    sortOrder: 1,
    icon: 'waveform.badge.checkmark',
    iconColor: '#8956d6',
    fhir: {
        storageStrategy: 'hybrid',
        questionnaireUrl: 'https://example.org/questionnaire/daily-symptom-check',
        observationCategory: 'survey',
    },
    scoring: {
        maxScore: 34,
        higherIsBetter: false,
        calculateDomainScores: true,
        interpretations: [
            { minScore: 0, maxScore: 7, color: '#34C759' },
            { minScore: 8, maxScore: 14, color: '#5856D6' },
            // ...
        ],
    },
    domains: [{
        id: 'symptoms',
        questions: [{
            id: 'pain',
            linkId: '1',
            optionValues: [0, 1, 2, 3, 4],
            inputType: 'list',
            storeAsObservation: true,
            fhirCode: { system: 'http://loinc.org', code: '54834-7', display: 'Pain severity' },
            fhirUnit: '/4',
        }],
    }],
    estimatedMinutes: 1,
    schedule: { frequencyDays: 1, enforced: false },
    highlighted: true,
};
```

**`locales/de.json`** — German texts:
```json
{
    "name": "Täglicher Symptom-Check",
    "description": "Ein kurzer täglicher Check-in...",
    "intro": {
        "title": "Täglicher Symptom-Check",
        "description": "Ein schneller Überblick über deinen aktuellen Zustand.",
        "buttonText": "Starten"
    },
    "domains": {
        "symptoms": "Symptome",
        "sleep": "Schlaf",
        "mood": "Stimmung"
    },
    "questions": {
        "pain": {
            "text": "Wie stark sind deine Schmerzen heute?",
            "options": {
                "0": { "label": "Kein Schmerz", "description": "Keine Beschwerden" },
                "1": { "label": "Leichter Schmerz", "description": "Kaum spürbar" }
            }
        }
    },
    "scoring": {
        "interpretations": [
            { "label": "Guter Tag", "description": "Du fühlst dich heute relativ gut." },
            { "label": "Okay", "description": "Ein durchschnittlicher Tag." }
        ]
    }
}
```

**`index.ts`** — Merged via `mergeDefinition()`:
```typescript
export function getDefinition(language: string): QuestionnaireDefinition {
    const locale = locales[language] ?? locales.en;
    return mergeDefinition(base, locale);
}
```

### 3. QuestionnaireDefinition

The complete structure of a questionnaire:

```typescript
type QuestionnaireDefinition = {
    id: string;                  // Unique ID (e.g. 'alsfrs-r', 'phq9')
    name: string;                // Official name (e.g. 'ALSFRS-R')
    displayName?: string;        // User-friendly name (e.g. 'Functional Status')
    shortName?: string;          // Short name
    icon: string;                // SF Symbol name
    iconColor: string;           // Hex color code
    description: string;         // Description text
    intro?: QuestionnaireIntro;  // Intro page before questions

    fhir: QuestionnaireFhirConfig;       // FHIR storage configuration
    domains: QuestionnaireDomain[];      // Questions grouped by domain
    scoring: QuestionnaireScoringConfig; // Scoring configuration

    estimatedMinutes?: number;           // Estimated duration
    schedule?: QuestionnaireSchedule;    // Schedule (frequency, availability)
    highlighted?: boolean;               // Show in carousel
    sortOrder?: number;                  // Sort order
    displayMode?: 'scroll' | 'paged';   // Display: scroll or page-by-page
    todoByDefault?: boolean;             // Show in todo list by default (default: true)
    todoRules?: TodoCondition[];          // Conditional rules for todo visibility
};
```

### 4. Domains and Questions

Questions are grouped into domains:

```typescript
type QuestionnaireDomain = {
    id: string;                       // e.g. 'bulbar', 'motor'
    name: string;                     // Display name (language-dependent)
    questions: QuestionDefinition[];  // Questions in this domain
    maxScore?: number;                // Maximum score (calculated if not set)
};

type QuestionDefinition = {
    id: string;                 // e.g. 'speech', 'pain'
    linkId?: string;            // FHIR QuestionnaireResponse linkId
    text: string;               // Question text (language-dependent)
    options: QuestionOption[];  // Answer options with value + label
    fhirCode?: FhirCoding;     // LOINC code (for Observation storage)
    storeAsObservation?: boolean; // Hybrid: also store as Observation?
    fhirUnit?: string;         // Unit (e.g. '/10') for metrics compatibility
    inputType?: 'list' | 'slider' | 'chips'; // Display type
    defaultValue?: number;     // Pre-selected value
    helpText?: string;         // Help text below the question
};
```

**Input Types:**
- `list` — Checkbox list with descriptions (default for <=5 options)
- `slider` — Slider with value display (default for >5 options)
- `chips` — Horizontal chip buttons (compact, no descriptions)

### 5. Scoring

```typescript
type QuestionnaireScoringConfig = {
    maxScore: number;
    higherIsBetter?: boolean;  // true = higher is better (e.g. ALSFRS-R, WHO-5)
    interpretations?: ScoreInterpretation[];  // Color + label per score range
    calculateScore?: (answers: Record<string, number>) => number; // Custom calculation
    calculateDomainScores?: boolean;  // Calculate domain subscores?
};
```

### 6. Schedule

```typescript
type QuestionnaireSchedule = {
    frequencyDays: number;       // 1 = daily, 7 = weekly, 30 = monthly
    enforced: boolean;           // true = locked until next due date
    gracePeriodDays?: number;    // Available X days before due date
    showForDays?: number;        // Display window per cycle (hides after X days)
    availableFrom?: string;      // ISO date: not available before
    availableUntil?: string;     // ISO date: not available after
    startAfterDays?: number;     // Delay before first appearance (relative to account creation)
};
```

**`showForDays`** controls how long a due item stays visible in the todo list before hiding until the next cycle. Example with `frequencyDays: 7, showForDays: 3`: the item is visible for 3 days after becoming due, then hidden for 4 days, then visible again for the next cycle.

Helper functions:
- `getQuestionnaireAvailability(definition, lastCompletedAt)` — Checks if questionnaire can be started now
- `getNextDueDate(definition, lastCompletedAt)` — Next due date

### 7. Todo Rules (Conditional Todo Visibility)

Questionnaires with `todoByDefault: false` can use `todoRules` to appear conditionally based on patient data. This works identically to the metrics module — see [Metrics README: Todo Rules](../metrics/README.md#8-todo-rules-conditional-todo-visibility) for full documentation.

```typescript
{
    schedule: { frequencyDays: 30, enforced: false },
    todoByDefault: false,
    todoRules: [
        {
            type: 'metricValue',
            metricId: 'blood_oxygen',
            fieldKey: 'value',
            operator: 'lt',
            value: 92,   // Show questionnaire when SpO2 drops below 92%
        },
    ],
}
```

**Condition types:** `questionnaireDomainScore`, `questionnaireTotalScore`, `metricValue`
**Logic:** AND — all conditions must match. Missing data → `false` → hidden.

### 8. Staggered Start (startAfterDays)

Questionnaires with `startAfterDays` on their schedule are hidden from the todo list until enough days have passed since account creation. This prevents overwhelming new users.

```typescript
schedule: { frequencyDays: 14, enforced: true, showForDays: 3, startAfterDays: 14 },
```

Current staggering:

| Questionnaire | startAfterDays | First appearance |
|---|---|---|
| Daily Check | — | Day 1 |
| ALSFRS-R | — | Day 1 |
| PES | 7 | After 1 week |
| PDQ-5 | 7 | After 1 week |
| BDI-FS | 14 | After 2 weeks |
| WHO-5 | 14 | After 2 weeks |
| PHQ-9 | — | Controlled by `availableFrom`/`availableUntil` |

See [Metrics README: Staggered Start](../metrics/README.md#9-staggered-start-startafterdays) for details on the reference date (`PatientPreferences.createdAt`).

### 9. QuestionnaireEntry

A completed questionnaire:

```typescript
type QuestionnaireEntry = {
    id: string;                        // FHIR Resource ID
    questionnaireId: string;           // e.g. 'alsfrs-r'
    answers: Record<string, number>;   // { speech: 3, handwriting: 2, ... }
    totalScore: number;                // Total score
    domainScores?: Record<string, number>; // { bulbar: 10, motor: 8, ... }
    completedAt: Date;                 // Completion timestamp
    recordedByRole?: string;           // patient | caregiver | doctor
};
```

## Registry API

### Dynamic API (recommended)

```typescript
import {
    getQuestionnaireDefinition,
    getAllQuestionnaireDefinitions,
    getLocalizedQuestionnaireDefinition,
    getAllLocalizedQuestionnaireDefinitions,
} from '@/src/questionnaires';

// Single questionnaire (current app language)
const alsfrs = getQuestionnaireDefinition('alsfrs-r');

// Single questionnaire in specific language
const alsfrsEn = getQuestionnaireDefinition('alsfrs-r', 'en');

// All questionnaires sorted (current language)
const all = getAllQuestionnaireDefinitions();

// Convenience: explicit current language
const localized = getLocalizedQuestionnaireDefinition('phq9');
```

### Legacy API (deprecated)

```typescript
// Static arrays in German — DO NOT use for new code
import { questionnaireDefinitions, questionnaireRegistry, alsfrsr } from '@/src/questionnaires';
```

## Hooks

### useQuestionnaire

Loads and saves questionnaire data:

```typescript
const {
    definition,     // QuestionnaireDefinition (language-dependent)
    entries,        // QuestionnaireEntry[] (sorted, newest first)
    latestEntry,    // Latest entry or null
    isLoading,      // Loading state

    save,           // Save answers
    reload,         // Reload data
} = useQuestionnaire({ questionnaireId: 'alsfrs-r' });

// Save
await save(answers);                    // With current date
await save(answers, customDate);        // With custom date
```

The hook subscribes to `fhir:changed` events for automatic updates.

### useQuestionnaireForm

Manages form state while filling out a questionnaire:

```typescript
const {
    answers,        // Record<string, number> — Current answers
    setAnswer,      // (questionId, value) => void
    clearAnswers,   // () => void — Reset form

    answeredCount,  // Number of answered questions
    totalQuestions,  // Total number of questions
    isComplete,     // All questions answered?

    totalScore,     // Computed total score
    domainScores,   // Computed domain scores
    interpretation, // Score interpretation (label + color)
} = useQuestionnaireForm({ definition, initialAnswers });
```

## FHIR Storage

### Saving Answers

```typescript
import { saveQuestionnaireAnswers } from '@/src/questionnaires';

await saveQuestionnaireAnswers(definition, answers, fhirRepo, patientRef);
// Stores as QuestionnaireResponse and/or Observations depending on storageStrategy
```

### Loading Entries

```typescript
import { loadQuestionnaireEntries } from '@/src/questionnaires';

const entries = await loadQuestionnaireEntries(definition, fhirRepo);
```

### Querying Individual Questions (for Hybrid)

```typescript
import { getLatestQuestionValue, getQuestionHistory } from '@/src/questionnaires';

// Latest value of a specific question (via Observation)
const latestPain = await getLatestQuestionValue('pain', definition, fhirRepo);

// History of a question
const painHistory = await getQuestionHistory('pain', definition, fhirRepo);
```

## Components

### QuestionnaireScreen

Full-screen questionnaire UI with intro page, questions, and result:

```tsx
<QuestionnaireScreen
    questionnaireId="alsfrs-r"
    onComplete={() => router.back()}
/>
```

Supports two `displayMode` variants:
- `scroll` — All questions in a scrollable list
- `paged` — One question per page with navigation

### QuestionnaireCard

Card display for overview:

```tsx
<QuestionnaireCard
    definition={definition}
    latestEntry={latestEntry}
    onPress={() => router.push(`/questionnaire/${id}`)}
/>
```

### QuestionnaireCarousel

Carousel for highlighted questionnaires (only `highlighted: true`):

```tsx
<QuestionnaireCarousel onPress={(id) => router.push(`/questionnaire/${id}`)} />
```

## Helper Functions

```typescript
import {
    getAllQuestions,
    calculateTotalScore,
    calculateDomainScores,
    getScoreInterpretation,
    isQuestionnaireComplete,
    getDomainMaxScore,
    getQuestionnaireAvailability,
    getNextDueDate,
} from '@/src/questionnaires';

// All questions (flat, without domain grouping)
const questions = getAllQuestions(definition);

// Calculate score
const score = calculateTotalScore(definition, answers);

// Calculate domain scores
const domainScores = calculateDomainScores(definition, answers);

// Interpretation for a score
const interp = getScoreInterpretation(definition, 32);
// → { minScore: 25, maxScore: 36, label: 'Moderate limitation', color: '#FF9500' }

// Check completeness
const complete = isQuestionnaireComplete(definition, answers);

// Max score of a domain
const maxScore = getDomainMaxScore(definition.domains[0]);

// Check availability
const availability = getQuestionnaireAvailability(definition, lastCompletedAt);
// → { available: true, dueInDays: 3, daysUntilEnd: undefined }

// Next due date
const nextDue = getNextDueDate(definition, lastCompletedAt);
```

## Adding a New Questionnaire

### 1. Create Directory

```
definitions/myQuestionnaire/
├── base.ts
├── index.ts
└── locales/
    ├── de.json
    └── en.json
```

### 2. Base Definition (`base.ts`)

```typescript
import type { QuestionnaireBaseDefinition } from '../../types';

export const base: QuestionnaireBaseDefinition = {
    id: 'my-questionnaire',
    icon: 'checklist',
    iconColor: '#007AFF',
    sortOrder: 10,
    fhir: {
        storageStrategy: 'questionnaireResponse',
        questionnaireUrl: 'https://example.org/questionnaire/my-questionnaire',
        observationCategory: 'survey',
    },
    scoring: {
        maxScore: 20,
        higherIsBetter: true,
        calculateDomainScores: true,
        interpretations: [
            { minScore: 0, maxScore: 5, color: '#FF3B30' },
            { minScore: 6, maxScore: 10, color: '#FF9500' },
            { minScore: 11, maxScore: 15, color: '#5856D6' },
            { minScore: 16, maxScore: 20, color: '#34C759' },
        ],
    },
    domains: [{
        id: 'general',
        questions: [
            {
                id: 'q1',
                linkId: '1',
                optionValues: [0, 1, 2, 3, 4],
                inputType: 'list',
            },
            {
                id: 'q2',
                linkId: '2',
                optionValues: [0, 1, 2, 3, 4],
                inputType: 'list',
            },
        ],
    }],
    estimatedMinutes: 5,
    schedule: { frequencyDays: 30, enforced: false, showForDays: 5 },
    highlighted: false,
    todoByDefault: true,
    // Optional: conditional todo rules (see "Todo Rules" section above)
    // todoRules: [{ type: 'questionnaireTotalScore', questionnaireId: '...', operator: 'gte', value: 10 }],
};
```

### 3. Locale Files (`locales/en.json`)

```json
{
    "name": "My Questionnaire",
    "displayName": "Self-Assessment",
    "description": "Description of the questionnaire...",
    "intro": {
        "title": "My Questionnaire",
        "description": "Please answer the following questions.",
        "buttonText": "Start"
    },
    "domains": {
        "general": "General"
    },
    "questions": {
        "q1": {
            "text": "How are you feeling?",
            "options": {
                "0": { "label": "Very bad", "description": "..." },
                "1": { "label": "Bad" },
                "2": { "label": "Okay" },
                "3": { "label": "Good" },
                "4": { "label": "Very good", "description": "..." }
            }
        },
        "q2": {
            "text": "Second question?",
            "options": {
                "0": { "label": "Option A" },
                "1": { "label": "Option B" },
                "2": { "label": "Option C" },
                "3": { "label": "Option D" },
                "4": { "label": "Option E" }
            }
        }
    },
    "scoring": {
        "interpretations": [
            { "label": "Poor", "description": "..." },
            { "label": "Fair", "description": "..." },
            { "label": "Good", "description": "..." },
            { "label": "Very good", "description": "..." }
        ]
    }
}
```

### 4. Index File (`index.ts`)

```typescript
import type { QuestionnaireDefinition, QuestionnaireLocale } from '../../types';
import { mergeDefinition } from '../../types';
import { base } from './base';
import deLocale from './locales/de.json';
import enLocale from './locales/en.json';

const locales: Record<string, QuestionnaireLocale> = {
    de: deLocale as QuestionnaireLocale,
    en: enLocale as QuestionnaireLocale,
};

export function getDefinition(language: string): QuestionnaireDefinition {
    const locale = locales[language] ?? locales.en;
    return mergeDefinition(base, locale);
}

/** @deprecated Use getDefinition(language) instead */
export const myQuestionnaire = getDefinition('de');
```

### 5. Register in Registry (`definitions/index.ts`)

```typescript
import { getDefinition as getMyQuestionnaireDef, myQuestionnaire } from './myQuestionnaire';

// Add to definitionGetters:
const definitionGetters = {
    // ...
    'my-questionnaire': getMyQuestionnaireDef,
};

// Add to questionnaireIds:
const questionnaireIds = [
    // ...
    'my-questionnaire',
];

// Add to legacy array:
export const questionnaireDefinitions = [
    // ...
    myQuestionnaire,
];
```

## All Available Questionnaires (7)

| ID | Name | Strategy | Questions | Max | Direction | Frequency |
|---|---|---|---|---|---|---|
| `alsfrs-r` | ALSFRS-R | questionnaireResponse | 12 | 48 | Higher = better | monthly |
| `bdi-fs` | BDI-FS | questionnaireResponse | 7 | 21 | Lower = better | monthly |
| `daily-check` | Daily Symptom Check | hybrid | 4 | 34 | Lower = better | daily |
| `pdq5` | PDQ-5 | questionnaireResponse | 5 | 20 | Lower = better | monthly |
| `pes` | MOS Pain Effects Scale | questionnaireResponse | 6 | 30 | Lower = better | monthly |
| `phq9` | PHQ-9 | questionnaireResponse | 9 | 27 | Lower = better | biweekly |
| `who5` | WHO-5 | questionnaireResponse | 5 | 25 | Higher = better | biweekly |

## Event System

The module uses the same event bus as the metrics module:

```typescript
import { on } from '@/src/lib/bus';

// Reacts to FHIR changes (e.g. after sync)
on('fhir:changed', () => {
    // useQuestionnaire reloads automatically
});
```

## Interplay with the Metrics Module

With the `hybrid` strategy, selected questions are stored as FHIR Observations. These can be read by the metrics module when they use the same LOINC code:

```
Daily Check (question "pain")
    → fhirCode: 54834-7 (Pain severity)
    → storeAsObservation: true
    → fhirUnit: '/4'
    ↓
FHIR Observation (code: 54834-7, valueQuantity: { value: 2, unit: '/4' })
    ↓
Metric "pain_level" (fhirCode: 54834-7)
    → Can display the value in trend chart
```

## See Also

- [Metrics Module](../metrics/README.md) — Health metrics system
- [useFhirRepo](../hooks/useFhirRepo.ts) — FHIR data access
- [DisplayModeProvider](../context/DisplayModeProvider.tsx) — Display mode (Clinical/Comfort)
