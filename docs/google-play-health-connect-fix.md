# Google Play Health Connect Rejection — Fix Documentation

**Date:** 2026-06-27
**Issue:** Google Play rejected the app due to "Insufficient information to determine app functions for Health Connect"

---

## Root Cause Analysis

The rejection had **two causes**:

### 1. German justification texts were insufficient
Google's review team could not understand the German texts in the Play Console Health Apps declaration. Google requested "additional rationale" for ALL 10 listed data types — including types the app legitimately uses (e.g. BloodPressure, Weight, Steps).

### 2. Unused Health Connect types in compiled code
The `react-native-health-connect` library registers ALL Health Connect record types in 3 internal Kotlin maps in `HealthConnectUtils.kt` using direct `::class` references. Google's AAB static analysis detects these class references and attributes them to the app — even though the app never calls them.

**Affected unused types (6 total):**
- `Distance` — app does not use Distance
- `Height` — app does not use Height
- `SleepSession` — app does not use Sleep
- `StepsCadence` — app does not use StepsCadence (only Steps)
- `HeartRate` — app uses HeartRateVariability and RestingHeartRate, but NOT plain HeartRate
- `TotalCaloriesBurned` — app uses ActiveCaloriesBurned, but NOT TotalCaloriesBurned

---

## Changes Made

### Change 1: AndroidManifest.xml
**File:** `android/app/src/main/AndroidManifest.xml`

Added 5 `tools:node="remove"` entries to prevent these permissions from ever appearing in the merged manifest:

```xml
<uses-permission android:name="android.permission.health.READ_HEIGHT" tools:node="remove"/>
<uses-permission android:name="android.permission.health.READ_DISTANCE" tools:node="remove"/>
<uses-permission android:name="android.permission.health.READ_SLEEP" tools:node="remove"/>
<uses-permission android:name="android.permission.health.READ_HEART_RATE" tools:node="remove"/>
<uses-permission android:name="android.permission.health.READ_TOTAL_CALORIES_BURNED" tools:node="remove"/>
```

**Note:** `StepsCadence` does not have its own permission (covered by `READ_STEPS`), so no manifest entry is needed.

### Change 2: Library Patch (react-native-health-connect)
**File:** `node_modules/react-native-health-connect/android/src/main/java/dev/matinzd/healthconnect/utils/HealthConnectUtils.kt`

Removed the 6 unused record types from all 3 internal maps:

**Map 1 — `reactRecordTypeToClassMap`:** Removed:
- `"Distance" to DistanceRecord::class`
- `"Height" to HeightRecord::class`
- `"SleepSession" to SleepSessionRecord::class`
- `"StepsCadence" to StepsCadenceRecord::class`
- `"HeartRate" to HeartRateRecord::class`
- `"TotalCaloriesBurned" to TotalCaloriesBurnedRecord::class`

**Map 2 — `reactRecordTypeToReactClassMap`:** Removed:
- `"Distance" to ReactDistanceRecord::class.java`
- `"Height" to ReactHeightRecord::class.java`
- `"SleepSession" to ReactSleepSessionRecord::class.java`
- `"StepsCadence" to ReactStepsCadenceRecord::class.java`
- `"HeartRate" to ReactHeartRateRecord::class.java`
- `"TotalCaloriesBurned" to ReactTotalCaloriesBurnedRecord::class.java`

**Map 3 — `healthConnectClassToReactClassMap`:** Removed:
- `DistanceRecord::class.java to ReactDistanceRecord::class.java`
- `HeightRecord::class.java to ReactHeightRecord::class.java`
- `SleepSessionRecord::class.java to ReactSleepSessionRecord::class.java`
- `StepsCadenceRecord::class.java to ReactStepsCadenceRecord::class.java`
- `HeartRateRecord::class.java to ReactHeartRateRecord::class.java`
- `TotalCaloriesBurnedRecord::class.java to ReactTotalCaloriesBurnedRecord::class.java`

### Change 3: ProGuard Rules
**File:** `android/app/proguard-rules.pro`

Added `-assumenosideeffects` rules so R8 aggressively strips the unused wrapper classes from the final build:

```
-assumenosideeffects class dev.matinzd.healthconnect.records.ReactDistanceRecord { *; }
-assumenosideeffects class dev.matinzd.healthconnect.records.ReactHeightRecord { *; }
-assumenosideeffects class dev.matinzd.healthconnect.records.ReactSleepSessionRecord { *; }
-assumenosideeffects class dev.matinzd.healthconnect.records.ReactStepsCadenceRecord { *; }
-assumenosideeffects class dev.matinzd.healthconnect.records.ReactHeartRateRecord { *; }
-assumenosideeffects class dev.matinzd.healthconnect.records.ReactTotalCaloriesBurnedRecord { *; }
```

### Change 4: English Justification Texts
**File:** `docs/play-console-health-connect-justifications.md`

14 English justification texts for the Play Console Health Apps declaration (Step 2). Each text explains:
- What the app does with the data type
- How the data is displayed (chart type)
- Why it is relevant for ALS patients
- That the data is read-only

---

## Remaining Manual Steps

### Step 1: Generate patch file
```bash
npx patch-package react-native-health-connect
```
Creates `patches/react-native-health-connect+X.X.X.patch`. This file is automatically reapplied on every `npm install` (postinstall script is already configured).

### Step 2: Update Play Console texts
1. Play Console → Policy → App content → Health Apps → Start
2. Step 2: Replace the German text for each of the 14 data types with the English text from `docs/play-console-health-connect-justifications.md`
3. Save

### Step 3: Create new release build
```bash
eas build --platform android --profile production
```

### Step 4: Submit to Google
Upload new AAB in Play Console and submit for review.

---

## Verification (optional, before submitting)

Check the merged manifest to ensure the removed permissions do not appear in the final manifest:

```bash
cd android && ./gradlew :app:processReleaseManifest
```

Then inspect: `android/app/build/intermediates/merged_manifests/release/AndroidManifest.xml`

The following permissions must NOT appear:
- `android.permission.health.READ_HEIGHT`
- `android.permission.health.READ_DISTANCE`
- `android.permission.health.READ_SLEEP`
- `android.permission.health.READ_HEART_RATE`
- `android.permission.health.READ_TOTAL_CALORIES_BURNED`
