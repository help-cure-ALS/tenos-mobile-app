# Available Metrics

This page lists every metric definition available in the TENOS ALS health app, generated from the metric definitions in `src/metrics/definitions/`.

Descriptions are the English (`en`) locale texts; each metric also ships localized texts in the other supported app languages.

## Overview

| Category | Count |
|---|---|
| Functional Status | 5 |
| Body & Weight | 3 |
| Vital Signs | 7 |
| Respiratory | 4 |
| Motor & Mobility | 11 |
| Symptoms | 9 |
| Bulbar Function | 3 |
| Nutrition | 4 |
| Digestion | 1 |
| Biomarker | 2 |
| **Total** | **49** |

**23 of 49** metrics support automatic read-only import from the device health ecosystem (Apple HealthKit on iOS, Android Health Connect). See [Health Import](#health-import) below and [../services/externalHealth](../services/externalHealth) for the import pipeline.

> Some metrics are platform-exclusive: the iOS-only mobility/gait metrics (`platforms: ['ios']`) are hidden entirely on Android, and the Android-only `hrv_rmssd` is hidden on iOS. See the per-metric tables.

---

## Functional Status

### ALS form & genetics (`als_genetic_background`)

| Property | Value |
|---|---|
| **Name** | ALS form & genetics (short: ALS form) |
| **LOINC** | `als-genetic-background` (TENOS code) |
| **App category** | Functional Status |
| **Unit** | — |
| **Range** | — |
| **Fields** | assessment / computed (dedicated screen) |
| **Health import** | manual entry only |

This metric records whether ALS is classified as sporadic, familial, or unclear, and whether a genetic finding or known mutation is documented. Genetic information is especially sensitive and is shared separately.

---

### King's Stage (`als_kings_stage`)

| Property | Value |
|---|---|
| **Name** | King's Stage (short: King's) |
| **LOINC** | `als-kings-stage` (TENOS code) |
| **App category** | Functional Status |
| **Unit** | — |
| **Range** | — |
| **Fields** | assessment / computed (dedicated screen) |
| **Health import** | manual entry only |

King's Stage describes the clinician-confirmed ALS stage based on affected regions and nutritional or respiratory involvement.

---

### Neurological exam (`als_neurological_exam`)

| Property | Value |
|---|---|
| **Name** | Neurological exam (short: Neuro exam) |
| **LOINC** | `als-neurological-motor-exam` (TENOS code) |
| **App category** | Functional Status |
| **Unit** | — |
| **Range** | — |
| **Fields** | assessment / computed (dedicated screen) |
| **Health import** | manual entry only |

The neurological exam documents the motor findings of ALS follow-up care, including strength, reflexes, tone, and motor neuron signs.

---

### ALS subtype (`als_subtype`)

| Property | Value |
|---|---|
| **Name** | ALS subtype |
| **LOINC** | `als-opm-classification` (TENOS code) |
| **App category** | Functional Status |
| **Unit** | — |
| **Range** | — |
| **Fields** | assessment / computed (dedicated screen) |
| **Health import** | manual entry only |

The ALS subtype describes the motor phenotype using ALS-OPM classification: site of onset, propagation, and motor neuron pattern.

---

### ALSFRS-R (`alsfrs-r`)

| Property | Value |
|---|---|
| **Name** | ALSFRS-R |
| **LOINC** | 67740-9 |
| **App category** | Functional Status |
| **Unit** | Punkte |
| **Range** | — |
| **Fields** | assessment / computed (dedicated screen) |
| **Health import** | manual entry only |

The ALSFRS-R (ALS Functional Rating Scale - Revised) is a validated instrument for assessing functional abilities in ALS. It covers 12 areas of daily life and enables monitoring of disease progression over time.

---

## Body & Weight

### Body Mass Index (`bmi`)

| Property | Value |
|---|---|
| **Name** | Body Mass Index (short: BMI) |
| **LOINC** | 39156-5 |
| **App category** | Body & Weight |
| **Unit** | kg/m² |
| **Range** | 10–60 |
| **Fields** | 1 (single value) |
| **Health import** | manual entry only |

The Body Mass Index (BMI) is a measure of the relationship between body weight and height. It is calculated as weight (kg) divided by height (m) squared. In ALS, a BMI in the upper normal range is often associated with a better outcome.

---

### Body Fat Percentage (`body_fat`)

| Property | Value |
|---|---|
| **Name** | Body Fat Percentage (short: Body Fat) |
| **LOINC** | 41982-0 |
| **App category** | Body & Weight |
| **Unit** | % |
| **Range** | 1–70 |
| **Fields** | 1 (single value) |
| **Health import** | Apple Health (iOS) + Health Connect (Android) · policy `daily-latest` |

Body fat percentage indicates how much of your body weight consists of fat tissue. In ALS, monitoring body fat percentage is important because a loss of muscle mass with constant weight may indicate an increased fat percentage. Regular measurements help to keep track of body composition.

*Health import — HealthKit: `BodyFatPercentage`; Health Connect: `BodyFat`.*

---

### Weight (`weight`)

| Property | Value |
|---|---|
| **Name** | Weight |
| **LOINC** | 29463-7 |
| **App category** | Body & Weight |
| **Unit** | kg (also: lb) |
| **Range** | 20–300 |
| **Fields** | 1 (single value) |
| **Health import** | Apple Health (iOS) + Health Connect (Android) · policy `daily-latest` |

Body weight is an important indicator of general health. In ALS, unintentional weight loss can be a sign of swallowing difficulties or increased energy expenditure. Regular weight monitoring helps to take early countermeasures.

*Health import — HealthKit: `BodyMass`; Health Connect: `Weight`.*

---

## Vital Signs

### Blood Oxygen (`blood_oxygen`)

| Property | Value |
|---|---|
| **Name** | Blood Oxygen (short: SpO2) |
| **LOINC** | 2708-6 |
| **App category** | Vital Signs |
| **Unit** | % |
| **Range** | 70–100 |
| **Fields** | 1 (single value) |
| **Health import** | Apple Health (iOS) + Health Connect (Android) · policy `daily-latest` |

Oxygen saturation (SpO2) shows what percentage of hemoglobin in the blood is loaded with oxygen. In ALS, weakening of the respiratory muscles can lead to lower oxygen levels, especially at night. Normal values are between 95% and 100%. Regular monitoring helps to detect breathing problems early.

*Health import — HealthKit: `OxygenSaturation`; Health Connect: `OxygenSaturation`.*

---

### Blood Pressure (`blood_pressure`)

| Property | Value |
|---|---|
| **Name** | Blood Pressure (short: BP) |
| **LOINC** | 85354-9 |
| **App category** | Vital Signs |
| **Unit** | mmHg |
| **Range** | (per field) |
| **Fields** | 2 (multi-value) |
| **Health import** | Apple Health (iOS) + Health Connect (Android) · policy `daily-first-and-last` |

| Field | Component LOINC |
|---|---|
| `systolic` (60–250) | 8480-6 — Systolic blood pressure |
| `diastolic` (40–150) | 8462-4 — Diastolic blood pressure |

Blood pressure measures the pressure of blood in the arteries. It is given as two values: systolic (upper value) and diastolic (lower value). Regular monitoring helps to detect cardiovascular diseases early.

*Health import — HealthKit: `BloodPressureSystolic`, `BloodPressureDiastolic`; Health Connect: `BloodPressure`.*

---

### Body Temperature (`body_temperature`)

| Property | Value |
|---|---|
| **Name** | Body Temperature (short: Temp.) |
| **LOINC** | 8310-5 |
| **App category** | Vital Signs |
| **Unit** | °C (also: °F) |
| **Range** | 34–42 |
| **Fields** | 1 (single value) |
| **Health import** | Apple Health (iOS) + Health Connect (Android) · policy `daily-latest` |

Body temperature is an important vital parameter. Normal values are between 36.0 and 37.5 °C. In ALS, thermoregulation can be impaired due to autonomic dysfunction or reduced muscle mass. Regular measurement helps to detect infections early and document changes in temperature regulation.

*Health import — HealthKit: `BodyTemperature`; Health Connect: `BodyTemperature`.*

---

### Heart Rate (`heart_rate`)

| Property | Value |
|---|---|
| **Name** | Heart Rate (short: Pulse) |
| **LOINC** | 8867-4 |
| **App category** | Vital Signs |
| **Unit** | bpm |
| **Range** | 30–250 |
| **Fields** | 1 (single value) |
| **Health import** | Apple Health (iOS) + Health Connect (Android) · policy `daily-latest` |

Heart rate indicates how many times the heart beats per minute. A normal resting pulse for adults is between 60 and 100 beats per minute. In ALS, heart rate can be affected by stress, breathing problems, or medications. Regular measurements help detect changes early.

*Health import — HealthKit: `RestingHeartRate`; Health Connect: `RestingHeartRate`.*

---

### Heart Rate Variability (`hrv_rmssd`)

| Property | Value |
|---|---|
| **Name** | Heart Rate Variability (short: HRV) |
| **LOINC** | `heart-rate-variability-rmssd` (TENOS code) |
| **App category** | Vital Signs |
| **Unit** | ms |
| **Range** | 0–300 |
| **Fields** | 1 (single value) |
| **Health import** | Health Connect (Android) only · policy `daily-average` · visible on android only |

Heart rate variability (HRV) is the variation in time between heartbeats, in milliseconds, and reflects autonomic nervous system activity. On Android it is measured as RMSSD and imported automatically from Health Connect.

*Health import — Health Connect: `HeartRateVariabilityRmssd`.*

---

### Heart Rate Variability (`hrv_sdnn`)

| Property | Value |
|---|---|
| **Name** | Heart Rate Variability (short: HRV) |
| **LOINC** | `heart-rate-variability-sdnn` (TENOS code) |
| **App category** | Vital Signs |
| **Unit** | ms |
| **Range** | 0–300 |
| **Fields** | 1 (single value) |
| **Health import** | Apple Health (iOS) only · policy `daily-average` · visible on ios only |

Heart rate variability (HRV) is the variation in time between heartbeats, in milliseconds, and reflects autonomic nervous system activity. On iPhone it is measured as SDNN and imported automatically from Apple Health.

*Health import — HealthKit: `HeartRateVariabilitySDNN`.*

---

### Nocturnal Oxygen Saturation (`nocturnal_spo2`)

| Property | Value |
|---|---|
| **Name** | Nocturnal Oxygen Saturation (short: Night SpO2) |
| **LOINC** | 59408-5 |
| **App category** | Vital Signs |
| **Unit** | % |
| **Range** | 60–100 |
| **Fields** | 1 (single value) |
| **Health import** | manual entry only |

Nocturnal oxygen saturation shows how well the body is supplied with oxygen during sleep. In ALS, nocturnal hypoventilation (shallow breathing) can occur before daytime symptoms become noticeable. Values below 90% during sleep may indicate early respiratory weakness. The measurement is ideally done with a pulse oximeter overnight.

---

## Respiratory

### Forced Vital Capacity (`fvc`)

| Property | Value |
|---|---|
| **Name** | Forced Vital Capacity (short: FVC) |
| **LOINC** | 19868-9 |
| **App category** | Respiratory |
| **Unit** | L |
| **Range** | 0.5–8.0 |
| **Fields** | 1 (single value) |
| **Health import** | Apple Health (iOS) only · policy `daily-latest` |

Forced vital capacity (FVC) measures the maximum volume of air that can be exhaled after a deep breath. In ALS, FVC is one of the most important indicators of respiratory function and disease progression. A drop below 50% of the predicted value may indicate the need for respiratory support.

*Health import — HealthKit: `ForcedVitalCapacity`.*

---

### FVC % of Predicted (`fvc_percent`)

| Property | Value |
|---|---|
| **Name** | FVC % of Predicted (short: FVC %) |
| **LOINC** | 19870-5 |
| **App category** | Respiratory |
| **Unit** | % |
| **Range** | 10–150 |
| **Fields** | 1 (single value) |
| **Health import** | manual entry only |

FVC as a percentage of predicted compares your measured forced vital capacity with the expected value for your age, sex, and height. Values above 80% are considered normal. In ALS, a drop below 50% is considered critical and may require initiation of non-invasive ventilation.

---

### Peak Cough Flow (`peak_cough_flow`)

| Property | Value |
|---|---|
| **Name** | Peak Cough Flow (short: PCF) |
| **LOINC** | 33452-4 |
| **App category** | Respiratory |
| **Unit** | L/min |
| **Range** | 50–720 |
| **Fields** | 1 (single value) |
| **Health import** | manual entry only |

Peak Cough Flow (PCF) measures the maximum air velocity during a cough. It shows how effectively you can clear secretions from your airways. Values below 270 L/min increase the risk of respiratory infections. Below 160 L/min, coughing is often no longer effective.

---

### Respiratory Rate (`respiratory_rate`)

| Property | Value |
|---|---|
| **Name** | Respiratory Rate (short: Resp. Rate) |
| **LOINC** | 9279-1 |
| **App category** | Respiratory |
| **Unit** | count/min |
| **Range** | 4–60 |
| **Fields** | 1 (single value) |
| **Health import** | Apple Health (iOS) + Health Connect (Android) · policy `daily-average` |

The respiratory rate is the number of breaths per minute. In ALS, respiratory function is a key measure; a rising resting respiratory rate can be an early sign of respiratory muscle weakness. This value is imported automatically from Apple Health or Health Connect (often measured during sleep) and shown as a daily average.

*Health import — HealthKit: `RespiratoryRate`; Health Connect: `RespiratoryRate`.*

---

## Motor & Mobility

### Falls (`falls`)

| Property | Value |
|---|---|
| **Name** | Falls |
| **LOINC** | 52552-7 |
| **App category** | Motor & Mobility |
| **Unit** | — |
| **Range** | 0–50 |
| **Fields** | 1 (single value) |
| **Health import** | Apple Health (iOS) only · policy `daily-sum` |

Tracking falls helps assess fall risk and take preventive measures. In ALS, increasing muscle weakness significantly increases the risk of falls. Document each fall to discuss appropriate aids or environmental modifications with your care team.

*Health import — HealthKit: `NumberOfTimesFallen`.*

---

### Flights Climbed (`flights_climbed`)

| Property | Value |
|---|---|
| **Name** | Flights Climbed (short: Flights) |
| **LOINC** | `flights-climbed` (TENOS code) |
| **App category** | Motor & Mobility |
| **Unit** | count |
| **Range** | 0–1000 |
| **Fields** | 1 (single value) |
| **Health import** | Apple Health (iOS) + Health Connect (Android) · policy `daily-sum` |

The number of floors climbed per day reflects lower-limb strength and endurance during everyday activity. In ALS, a downward trend can indicate progressing leg weakness. This value is imported automatically from Apple Health or Health Connect; no manual entry is needed.

*Health import — HealthKit: `FlightsClimbed`; Health Connect: `FloorsClimbed`.*

---

### Grip Strength (`grip_strength`)

| Property | Value |
|---|---|
| **Name** | Grip Strength (short: Grip) |
| **LOINC** | 83193-4 |
| **App category** | Motor & Mobility |
| **Unit** | kg (also: lb) |
| **Range** | (per field) |
| **Fields** | 2 (multi-value) |
| **Health import** | manual entry only |

| Field | Component LOINC |
|---|---|
| `left` (0–100) | 83191-8 — Grip strength Hand - left Dynamometer |
| `right` (0–100) | 83189-2 — Grip strength Hand - right Dynamometer |

Grip strength measures the maximum force that can be exerted with the hand. It is measured with a hand dynamometer and is an objective indicator of muscle strength. In ALS, grip strength can help document the progression of muscle weakness. Normal values vary by age and sex (men: 30-55 kg, women: 20-35 kg).

---

### Stair Descent Speed (`stair_descent_speed`)

| Property | Value |
|---|---|
| **Name** | Stair Descent Speed (short: Stair Down) |
| **LOINC** | `stair-descent-speed` (TENOS code) |
| **App category** | Motor & Mobility |
| **Unit** | m/s |
| **Range** | 0–3 |
| **Fields** | 1 (single value) |
| **Health import** | Apple Health (iOS) only · policy `daily-average` · visible on ios only |

Stair descent speed is how fast you walk down stairs, in metres per second. Descending stairs is demanding for balance and leg control, so a downward trend can be an early sign of declining lower-limb function in ALS. This value is imported automatically from Apple Health on iPhone.

*Health import — HealthKit: `StairDescentSpeed`.*

---

### Steps (`step_count`)

| Property | Value |
|---|---|
| **Name** | Steps |
| **LOINC** | 55423-8 |
| **App category** | Motor & Mobility |
| **Unit** | count |
| **Range** | 0–100000 |
| **Fields** | 1 (single value) |
| **Health import** | Apple Health (iOS) + Health Connect (Android) · policy `daily-sum` |

The daily step count is a simple measure of overall daily activity. In ALS, a downward trend can reflect declining mobility. Steps are imported automatically from Apple Health or Health Connect; no manual entry is needed.

*Health import — HealthKit: `StepCount`; Health Connect: `Steps`.*

---

### Walking Asymmetry (`walking_asymmetry`)

| Property | Value |
|---|---|
| **Name** | Walking Asymmetry (short: Asymmetry) |
| **LOINC** | `walking-asymmetry` (TENOS code) |
| **App category** | Motor & Mobility |
| **Unit** | % |
| **Range** | 0–100 |
| **Fields** | 1 (single value) |
| **Health import** | Apple Health (iOS) only · policy `daily-average` · visible on ios only |

Walking asymmetry is the percentage of time that one foot moves at a different pace than the other. A higher value means a more uneven gait. In ALS, this can help track asymmetric leg weakness. This value is imported automatically from Apple Health on iPhone.

*Health import — HealthKit: `WalkingAsymmetryPercentage`.*

---

### Walking Distance (`walking_distance`)

| Property | Value |
|---|---|
| **Name** | Walking Distance (short: 6MWT) |
| **LOINC** | 64098-7 |
| **App category** | Motor & Mobility |
| **Unit** | m (also: ft) |
| **Range** | 0–1000 |
| **Fields** | 1 (single value) |
| **Health import** | Apple Health (iOS) only · policy `daily-latest` |

The 6-Minute Walk Test (6MWT) measures the distance that can be covered in 6 minutes on flat ground. It is a standardized test for assessing functional exercise capacity. In ALS, it can help document the progression of walking ability. Normal values for adults are between 400 and 700 meters.

*Health import — HealthKit: `SixMinuteWalkTestDistance`.*

---

### Double Support Time (`walking_double_support`)

| Property | Value |
|---|---|
| **Name** | Double Support Time (short: Double Support) |
| **LOINC** | `walking-double-support` (TENOS code) |
| **App category** | Motor & Mobility |
| **Unit** | % |
| **Range** | 0–100 |
| **Fields** | 1 (single value) |
| **Health import** | Apple Health (iOS) only · policy `daily-average` · visible on ios only |

Double support time is the percentage of the walking cycle during which both feet are on the ground. A higher value often indicates a more cautious, less stable gait and a higher fall risk. In ALS, this can help track balance changes. This value is imported automatically from Apple Health on iPhone.

*Health import — HealthKit: `WalkingDoubleSupportPercentage`.*

---

### Walking Speed (`walking_speed`)

| Property | Value |
|---|---|
| **Name** | Walking Speed (short: Walk Speed) |
| **LOINC** | `walking-speed` (TENOS code) |
| **App category** | Motor & Mobility |
| **Unit** | m/s |
| **Range** | 0–3 |
| **Fields** | 1 (single value) |
| **Health import** | Apple Health (iOS) + Health Connect (Android) · policy `daily-average` |

Walking speed is the average pace at which you walk, in metres per second. In ALS, a downward trend can reflect progressing leg weakness and reduced mobility. This value is imported automatically from Apple Health or Health Connect and shown as a daily average.

*Health import — HealthKit: `WalkingSpeed`; Health Connect: `Speed`.*

---

### Walking Steadiness (`walking_steadiness`)

| Property | Value |
|---|---|
| **Name** | Walking Steadiness (short: Steadiness) |
| **LOINC** | `apple-walking-steadiness` (TENOS code) |
| **App category** | Motor & Mobility |
| **Unit** | % |
| **Range** | 0–100 |
| **Fields** | 1 (single value) |
| **Health import** | Apple Health (iOS) only · policy `daily-latest` · visible on ios only |

Apple Walking Steadiness estimates how stable and balanced your walking is, as a percentage. A downward trend indicates a higher risk of falling. In ALS, this can help track changes in gait and balance. This value is imported automatically from Apple Health on iPhone.

*Health import — HealthKit: `AppleWalkingSteadiness`.*

---

### Step Length (`walking_step_length`)

| Property | Value |
|---|---|
| **Name** | Step Length |
| **LOINC** | `walking-step-length` (TENOS code) |
| **App category** | Motor & Mobility |
| **Unit** | m |
| **Range** | 0–2 |
| **Fields** | 1 (single value) |
| **Health import** | Apple Health (iOS) only · policy `daily-average` · visible on ios only |

Step length is the average distance between consecutive steps, in metres. In ALS, a shortening step length can reflect changes in gait. This value is imported automatically from Apple Health on iPhone.

*Health import — HealthKit: `WalkingStepLength`.*

---

## Symptoms

### Cold Sensitivity (`cold_sensitivity`)

| Property | Value |
|---|---|
| **Name** | Cold Sensitivity (short: Cold) |
| **LOINC** | `cold-sensitivity` (TENOS code) |
| **App category** | Symptoms |
| **Unit** | /3 |
| **Range** | 0–3 |
| **Fields** | 1 (single value) |
| **Health import** | manual entry only |

| Value | Meaning |
|---|---|
| 0 | None |
| 1 | Mild |
| 2 | Moderate |
| 3 | Severe |

Cold sensitivity is a common symptom in ALS. It can be caused by reduced muscle mass, autonomic dysfunction, or decreased physical activity. Tracking helps to identify patterns and adjust measures such as warmer clothing or room temperature. (0 = None, 1 = Mild, 2 = Moderate, 3 = Severe)

---

### Muscle Cramps (`cramps`)

| Property | Value |
|---|---|
| **Name** | Muscle Cramps (short: Cramps) |
| **LOINC** | 80323-0 |
| **App category** | Symptoms |
| **Unit** | /Tag |
| **Range** | 0–100 |
| **Fields** | 1 (single value) |
| **Health import** | manual entry only |

Muscle cramps are painful, sustained, and involuntary muscle contractions. They differ from fasciculations (brief twitches), which are recorded separately. Cramps are common in ALS, especially at night, and can disrupt sleep. Record the number of cramps per day to identify patterns.

---

### Fasciculations (`fasciculations`)

| Property | Value |
|---|---|
| **Name** | Fasciculations (short: Fascic.) |
| **LOINC** | 89261-2 |
| **App category** | Symptoms |
| **Unit** | /3 |
| **Range** | 0–3 |
| **Fields** | 1 (single value) |
| **Health import** | manual entry only |

| Value | Meaning |
|---|---|
| 0 | None |
| 1 | Rare |
| 2 | Frequent |
| 3 | Very frequent |

Fasciculations are brief, involuntary twitches of individual muscle fibers that may be visible under the skin. They are a typical symptom of ALS and differ from muscle cramps, which are painful and persistent. Tracking helps to identify patterns and document disease progression. (0 = None, 1 = Rare, 2 = Frequent, 3 = Very frequent)

---

### Fatigue (`fatigue`)

| Property | Value |
|---|---|
| **Name** | Fatigue |
| **LOINC** | 68858-0 |
| **App category** | Symptoms |
| **Unit** | /10 |
| **Range** | 0–10 |
| **Fields** | 1 (single value) |
| **Health import** | manual entry only |

| Value | Meaning |
|---|---|
| 0 | None |
| 1 | Mild |
| 2 | Mild |
| 3 | Mild |
| 4 | Moderate |
| 5 | Moderate |
| 6 | Moderate |
| 7 | Severe |
| 8 | Severe |
| 9 | Severe |
| 10 | Extreme |

Fatigue is assessed on a scale from 0 (no fatigue) to 10 (extreme exhaustion). In ALS, fatigue is a common symptom that can be caused by increased energy expenditure for daily activities, breathing problems, or sleep disturbances. Documentation helps identify patterns and adjust daily planning.

---

### Pain Level (`pain_level`)

| Property | Value |
|---|---|
| **Name** | Pain Level (short: Pain) |
| **LOINC** | 54834-7 |
| **App category** | Symptoms |
| **Unit** | /4 |
| **Range** | 0–4 |
| **Fields** | 1 (single value) |
| **Health import** | manual entry only |

| Value | Meaning |
|---|---|
| 0 | No pain |
| 1 | Mild pain |
| 2 | Moderate pain |
| 3 | Severe pain |
| 4 | Very severe pain |

Pain level is assessed using a verbal descriptor scale (VRS). In ALS, pain can result from muscle tension, cramps, immobility, or pressure sores. Regular documentation helps identify pain patterns and adjust treatment.

---

### Pain -> Mobility (`pain_mobility`)

| Property | Value |
|---|---|
| **Name** | Pain -> Mobility (short: Mobility) |
| **LOINC** | 75262-2 |
| **App category** | Symptoms |
| **Unit** | /10 |
| **Range** | 0–10 |
| **Fields** | 1 (single value) |
| **Health import** | manual entry only |

| Value | Meaning |
|---|---|
| 0 | None |
| 1 | Minimal |
| 2 | Minimal |
| 3 | Slight |
| 4 | Moderate |
| 5 | Moderate |
| 6 | Moderate |
| 7 | Severe |
| 8 | Severe |
| 9 | Very severe |
| 10 | Extreme |

Records how much pain affects your mobility and physical activity. On a scale from 0 (no impact) to 10 (extreme impact). Limited mobility due to pain can lead to further health problems.

---

### Pain -> Mood (`pain_mood`)

| Property | Value |
|---|---|
| **Name** | Pain -> Mood (short: Mood) |
| **LOINC** | 75263-0 |
| **App category** | Symptoms |
| **Unit** | /10 |
| **Range** | 0–10 |
| **Fields** | 1 (single value) |
| **Health import** | manual entry only |

| Value | Meaning |
|---|---|
| 0 | None |
| 1 | Minimal |
| 2 | Minimal |
| 3 | Slight |
| 4 | Moderate |
| 5 | Moderate |
| 6 | Moderate |
| 7 | Severe |
| 8 | Severe |
| 9 | Very severe |
| 10 | Extreme |

Records how much pain affects your mood. On a scale from 0 (no impact) to 10 (extreme impact). Chronic pain can have significant effects on mental health.

---

### Pain -> Sleep (`pain_sleep`)

| Property | Value |
|---|---|
| **Name** | Pain -> Sleep (short: Sleep) |
| **LOINC** | 75261-4 |
| **App category** | Symptoms |
| **Unit** | /10 |
| **Range** | 0–10 |
| **Fields** | 1 (single value) |
| **Health import** | manual entry only |

| Value | Meaning |
|---|---|
| 0 | None |
| 1 | Minimal |
| 2 | Minimal |
| 3 | Slight |
| 4 | Moderate |
| 5 | Moderate |
| 6 | Moderate |
| 7 | Severe |
| 8 | Severe |
| 9 | Very severe |
| 10 | Extreme |

Records how much pain affects your sleep. On a scale from 0 (no impact) to 10 (extreme impact). Sleep disturbances due to pain can significantly affect quality of life.

---

### Suicidality (PHQ-9 Item 9) (`suicidality`)

| Property | Value |
|---|---|
| **Name** | Suicidality (PHQ-9 Item 9) (short: Suicidality) |
| **LOINC** | 44260-8 |
| **App category** | Symptoms |
| **Unit** | /3 |
| **Range** | 0–3 |
| **Fields** | 1 (single value) |
| **Health import** | manual entry only |

| Value | Meaning |
|---|---|
| 0 | Not at all |
| 1 | Several days |
| 2 | More than half the days |
| 3 | Nearly every day |

This metric captures the response to question 9 of the PHQ-9 questionnaire: "Thoughts that you would be better off dead or of hurting yourself". Values > 0 require special clinical attention. This metric is for early detection and should always be evaluated in clinical context.

---

## Bulbar Function

### Sialorrhea (`sialorrhea`)

| Property | Value |
|---|---|
| **Name** | Sialorrhea (short: Saliva) |
| **LOINC** | 67535-5 |
| **App category** | Bulbar Function |
| **Unit** | /10 |
| **Range** | 0–10 |
| **Fields** | 1 (single value) |
| **Health import** | manual entry only |

Excessive saliva flow (sialorrhea) is a common symptom in ALS, caused by swallowing difficulties rather than increased saliva production. Record the severity on a scale from 0 (normal) to 10 (very severe). Documentation helps to assess the effectiveness of treatments.

---

### Speech Rate (`speech_rate`)

| Property | Value |
|---|---|
| **Name** | Speech Rate (short: Speech) |
| **LOINC** | 89016-0 |
| **App category** | Bulbar Function |
| **Unit** | wpm |
| **Range** | 10–250 |
| **Fields** | 1 (single value) |
| **Health import** | manual entry only |

Speech rate measures how many words can be spoken per minute. In ALS, bulbar involvement can lead to slowed and slurred speech (dysarthria). Normal speech rate is about 120-150 words per minute. Regular measurement helps to detect changes early.

---

### Swallowing Time (`swallowing_time`)

| Property | Value |
|---|---|
| **Name** | Swallowing Time (short: Swallowing) |
| **LOINC** | 72106-8 |
| **App category** | Bulbar Function |
| **Unit** | sek |
| **Range** | 1–300 |
| **Fields** | 1 (single value) |
| **Health import** | manual entry only |

Swallowing time measures how long it takes to swallow a defined amount (e.g., 150ml of water). In ALS, dysphagia (swallowing difficulty) can make food intake difficult and increase aspiration risk. Prolonged swallowing time may indicate progressive bulbar symptoms. Normal values are under 20 seconds for 150ml of water.

---

## Nutrition

### Active Energy (`active_energy`)

| Property | Value |
|---|---|
| **Name** | Active Energy |
| **LOINC** | `active-energy-burned` (TENOS code) |
| **App category** | Nutrition |
| **Unit** | kcal |
| **Range** | 0–10000 |
| **Fields** | 1 (single value) |
| **Health import** | Apple Health (iOS) + Health Connect (Android) · policy `daily-sum` |

Active energy is the number of calories burned through movement and activity per day (excluding resting metabolism). In ALS, a downward trend can reflect reduced physical activity as mobility changes. This value is imported automatically from Apple Health or Health Connect.

*Health import — HealthKit: `ActiveEnergyBurned`; Health Connect: `ActiveCaloriesBurned`.*

---

### Caloric Intake (`caloric_intake`)

| Property | Value |
|---|---|
| **Name** | Caloric Intake (short: Calories) |
| **LOINC** | 9052-2 |
| **App category** | Nutrition |
| **Unit** | kcal |
| **Range** | 0–6000 |
| **Fields** | 1 (single value) |
| **Health import** | Apple Health (iOS) + Health Connect (Android) · policy `daily-sum` |

Daily caloric intake is especially important in ALS, as the body often has increased energy needs due to the disease. At the same time, swallowing difficulties can make eating more difficult. Adequate calorie intake can positively influence disease progression. Discuss your target values with a doctor or nutritionist.

*Health import — HealthKit: `DietaryEnergyConsumed`; Health Connect: `Nutrition`.*

---

### Fluid Intake (`fluid_intake`)

| Property | Value |
|---|---|
| **Name** | Fluid Intake (short: Fluids) |
| **LOINC** | 8999-5 |
| **App category** | Nutrition |
| **Unit** | ml |
| **Range** | 0–5000 |
| **Fields** | 1 (single value) |
| **Health import** | Apple Health (iOS) + Health Connect (Android) · policy `daily-sum` |

Daily fluid intake is important for overall health. In ALS, swallowing difficulties can lead to reduced drinking, which can cause dehydration. About 1.5-2 liters per day is recommended. Documentation helps ensure adequate hydration.

*Health import — HealthKit: `DietaryWater`; Health Connect: `Hydration`.*

---

### Energy Needs (`tdee`)

| Property | Value |
|---|---|
| **Name** | Energy Needs (short: TDEE) |
| **LOINC** | `tdee` (TENOS code) |
| **App category** | Nutrition |
| **Unit** | kcal |
| **Range** | — |
| **Fields** | assessment / computed (dedicated screen) |
| **Health import** | manual entry only |

The Total Daily Energy Expenditure (TDEE) is calculated using the Kasarskis formula, specifically developed for ALS patients. The calculation considers your basal metabolic rate, activity level (based on ALSFRS-6), and ALS-specific adjustments.

---

## Digestion

### Stool Consistency (`bristol_stool_scale`)

| Property | Value |
|---|---|
| **Name** | Stool Consistency (short: Stool) |
| **LOINC** | 11029-8 |
| **App category** | Digestion |
| **Unit** | /7 |
| **Range** | 1–7 |
| **Fields** | 1 (single value) |
| **Health import** | manual entry only |

| Value | Meaning |
|---|---|
| 1 | Type 1 - Separate hard lumps |
| 2 | Type 2 - Sausage-shaped, lumpy |
| 3 | Type 3 - Sausage with cracks |
| 4 | Type 4 - Smooth and soft (ideal) |
| 5 | Type 5 - Soft blobs |
| 6 | Type 6 - Mushy, fluffy pieces |
| 7 | Type 7 - Watery, liquid |

The Bristol Stool Scale is a clinical tool for assessing stool consistency. In ALS, constipation is common due to reduced mobility, weakened abdominal muscles, or medications. Type 3-4 is considered ideal. Type 1-2 indicates constipation, Type 6-7 indicates diarrhea. (1 = Hard/lumpy, 4 = Ideal, 7 = Watery)

---

## Biomarker

### NFL in Serum (`nfl`)

| Property | Value |
|---|---|
| **Name** | NFL in Serum (short: NFL) |
| **LOINC** | 94505-5 |
| **App category** | Biomarker |
| **Unit** | pg/ml |
| **Range** | 0–10000 |
| **Fields** | 1 (single value) |
| **Health import** | manual entry only |

Neurofilament Light Chain (NFL) is a biomarker released into the blood when nerve cells are damaged. Elevated NFL levels may indicate active neurodegeneration. In ALS, NFL is used for monitoring disease progression and as a prognostic marker.

---

### NFL in CSF (`nfl_csf`)

| Property | Value |
|---|---|
| **Name** | NFL in CSF (short: NFL (CSF)) |
| **LOINC** | 94677-2 |
| **App category** | Biomarker |
| **Unit** | pg/ml |
| **Range** | 0–50000 |
| **Fields** | 1 (single value) |
| **Health import** | manual entry only |

Neurofilament Light Chain (NFL) in cerebrospinal fluid (CSF) is a sensitive biomarker for nerve cell damage. CSF measurement often provides earlier and more accurate values than blood measurement. In ALS, elevated NFL levels in CSF are associated with faster disease progression. The sample is obtained through a lumbar puncture.

---

## Health Import

TENOS can populate metrics automatically and read-only from the device's health store (introduced in T-001, expanded in T-002). The import is definition-driven: each importable metric carries an `externalHealth` mapping in its `base.ts`. No data is ever written back to Apple Health or Health Connect.

| Metric | Source | Policy | Platform visibility |
|---|---|---|---|
| `active_energy` | Apple Health (iOS) + Health Connect (Android) | `daily-sum` | all |
| `blood_oxygen` | Apple Health (iOS) + Health Connect (Android) | `daily-latest` | all |
| `blood_pressure` | Apple Health (iOS) + Health Connect (Android) | `daily-first-and-last` | all |
| `body_fat` | Apple Health (iOS) + Health Connect (Android) | `daily-latest` | all |
| `body_temperature` | Apple Health (iOS) + Health Connect (Android) | `daily-latest` | all |
| `caloric_intake` | Apple Health (iOS) + Health Connect (Android) | `daily-sum` | all |
| `falls` | Apple Health (iOS) only | `daily-sum` | all |
| `flights_climbed` | Apple Health (iOS) + Health Connect (Android) | `daily-sum` | all |
| `fluid_intake` | Apple Health (iOS) + Health Connect (Android) | `daily-sum` | all |
| `fvc` | Apple Health (iOS) only | `daily-latest` | all |
| `heart_rate` | Apple Health (iOS) + Health Connect (Android) | `daily-latest` | all |
| `hrv_rmssd` | Health Connect (Android) only | `daily-average` | android only |
| `hrv_sdnn` | Apple Health (iOS) only | `daily-average` | ios only |
| `respiratory_rate` | Apple Health (iOS) + Health Connect (Android) | `daily-average` | all |
| `stair_descent_speed` | Apple Health (iOS) only | `daily-average` | ios only |
| `step_count` | Apple Health (iOS) + Health Connect (Android) | `daily-sum` | all |
| `walking_asymmetry` | Apple Health (iOS) only | `daily-average` | ios only |
| `walking_distance` | Apple Health (iOS) only | `daily-latest` | all |
| `walking_double_support` | Apple Health (iOS) only | `daily-average` | ios only |
| `walking_speed` | Apple Health (iOS) + Health Connect (Android) | `daily-average` | all |
| `walking_steadiness` | Apple Health (iOS) only | `daily-latest` | ios only |
| `walking_step_length` | Apple Health (iOS) only | `daily-average` | ios only |
| `weight` | Apple Health (iOS) + Health Connect (Android) | `daily-latest` | all |

Import policies: `daily-latest` (last reading of each day), `daily-first-and-last` (e.g. blood pressure), `daily-sum` (cumulative totals like steps), `daily-average` (rate-like values like walking speed). Each imported observation gets a stable per-day external ID for idempotent re-import.

See [src/metrics/README.md](./README.md) for the definition format and [src/services/externalHealth](../services/externalHealth) for the adapters (`appleHealthKit.ts`, `healthConnect.ts`), registry, and import service.
