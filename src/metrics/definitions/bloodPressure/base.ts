import type { MetricBaseDefinition } from '../../types';

export const base: MetricBaseDefinition = {
    id: 'blood_pressure',
    icon: 'blood.pressure.cuff.fill',
    iconColor: '#FF3B30',
    fhir: {
        code: {
            system: 'http://loinc.org',
            code: '85354-9',
            display: 'Blood pressure panel with all children optional',
        },
        category: 'vital-signs',
    },
    fields: [
        {
            key: 'systolic',
            unit: 'mmHg',
            inputType: 'integer',
            placeholder: '120',
            fhirComponentCode: {
                system: 'http://loinc.org',
                code: '8480-6',
                display: 'Systolic blood pressure',
            },
            validation: {
                min: 60,
                max: 250,
                required: true,
            },
        },
        {
            key: 'diastolic',
            unit: 'mmHg',
            inputType: 'integer',
            placeholder: '80',
            fhirComponentCode: {
                system: 'http://loinc.org',
                code: '8462-4',
                display: 'Diastolic blood pressure',
            },
            validation: {
                min: 40,
                max: 150,
                required: true,
            },
        },
    ],
    defaultUnit: 'mmHg',
    externalHealth: {
        aggregation: 'sample',
        importPolicy: { mode: 'daily-first-and-last' },
        appleHealthKit: {
            read: [
                {
                    correlationType: 'HKCorrelationTypeIdentifierBloodPressure',
                    quantityType: 'HKQuantityTypeIdentifierBloodPressureSystolic',
                    unit: 'mmHg',
                    field: 'systolic',
                },
                {
                    correlationType: 'HKCorrelationTypeIdentifierBloodPressure',
                    quantityType: 'HKQuantityTypeIdentifierBloodPressureDiastolic',
                    unit: 'mmHg',
                    field: 'diastolic',
                },
            ],
        },
        healthConnect: {
            read: [
                {
                    recordType: 'BloodPressure',
                    fieldPath: 'systolic.inMillimetersOfMercury',
                    unit: 'mmHg',
                    field: 'systolic',
                },
                {
                    recordType: 'BloodPressure',
                    fieldPath: 'diastolic.inMillimetersOfMercury',
                    unit: 'mmHg',
                    field: 'diastolic',
                },
            ],
        },
    },
    chart: {
        type: 'scatter',
        primaryField: 'systolic',
        secondaryField: 'diastolic',
        yAxis: {
            min: 40,
            max: 180,
            padding: 0.1,
        },
    },
    canPin: true,
    defaultPinned: false,
    defaultPinnedOrder: 30,
    sortOrder: 20,
    category: 'vital-signs',
};
