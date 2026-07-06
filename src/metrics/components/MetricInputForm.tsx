/**
 * MetricInputForm
 *
 * Dynamic form for entering metric values based on the metric definition.
 */

import { useCallback, useState } from 'react';
import {
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useAppTheme } from '@/src/theme';

import type { MetricDefinition, MetricField } from '../types';

type Props = {
    definition: MetricDefinition;
    /** Initial values (for editing) */
    initialValues?: Record<string, number>;
    /** Initial unit */
    initialUnit?: string;
    /** Called when form is submitted */
    onSubmit: (values: Record<string, number>, unit: string) => void;
    /** Called when form is cancelled */
    onCancel?: () => void;
    /** Whether submission is in progress */
    isSubmitting?: boolean;
    /** Validation errors from parent */
    errors?: Record<string, string>;
};

export function MetricInputForm({
    definition,
    initialValues,
    initialUnit,
    onSubmit,
    onCancel,
    isSubmitting = false,
    errors: externalErrors,
}: Props) {
    const { colors } = useAppTheme();

    // Initialize values from initial or empty
    const [values, setValues] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        for (const field of definition.fields) {
            if (initialValues?.[field.key] !== undefined) {
                initial[field.key] = formatInitialValue(
                    initialValues[field.key],
                    field
                );
            } else {
                initial[field.key] = '';
            }
        }
        return initial;
    });

    const [selectedUnit, setSelectedUnit] = useState(
        initialUnit ?? definition.defaultUnit
    );
    const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

    const errors = { ...localErrors, ...externalErrors };

    // Format initial value for display
    function formatInitialValue(value: number, field: MetricField): string {
        if (field.inputType === 'decimal' && field.decimalPlaces !== undefined) {
            return value.toFixed(field.decimalPlaces).replace('.', ',');
        }
        return String(value);
    }

    // Parse input value to number
    function parseValue(input: string, field: MetricField): number | null {
        if (!input.trim()) return null;

        // Replace comma with dot for parsing
        const normalized = input.replace(',', '.');
        const parsed = parseFloat(normalized);

        if (isNaN(parsed)) return null;
        return parsed;
    }

    // Handle value change
    const handleValueChange = useCallback(
        (fieldKey: string, text: string) => {
            const field = definition.fields.find((f) => f.key === fieldKey);
            if (!field) return;

            // Allow only valid number input
            let sanitized = text;

            if (field.inputType === 'integer') {
                // Only digits
                sanitized = text.replace(/[^0-9]/g, '');
            } else {
                // Digits and one comma/dot
                sanitized = text.replace(/[^0-9,\.]/g, '');
                // Replace dot with comma for display
                sanitized = sanitized.replace('.', ',');
                // Only allow one decimal separator
                const parts = sanitized.split(',');
                if (parts.length > 2) {
                    sanitized = parts[0] + ',' + parts.slice(1).join('');
                }
            }

            setValues((prev) => ({ ...prev, [fieldKey]: sanitized }));

            // Clear error when user types
            if (localErrors[fieldKey]) {
                setLocalErrors((prev) => {
                    const next = { ...prev };
                    delete next[fieldKey];
                    return next;
                });
            }
        },
        [definition.fields, localErrors]
    );

    // Validate all fields
    const validate = useCallback((): boolean => {
        const newErrors: Record<string, string> = {};

        for (const field of definition.fields) {
            const input = values[field.key];
            const value = parseValue(input, field);

            if (field.validation?.required && value === null) {
                newErrors[field.key] = `${field.label} ist erforderlich`;
                continue;
            }

            if (value !== null) {
                if (
                    field.validation?.min !== undefined &&
                    value < field.validation.min
                ) {
                    newErrors[field.key] =
                        `Mindestens ${field.validation.min}`;
                }
                if (
                    field.validation?.max !== undefined &&
                    value > field.validation.max
                ) {
                    newErrors[field.key] =
                        `Maximal ${field.validation.max}`;
                }
            }
        }

        setLocalErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [definition.fields, values]);

    // Handle form submission
    const handleSubmit = useCallback(() => {
        Keyboard.dismiss();

        if (!validate()) return;

        const parsedValues: Record<string, number> = {};
        for (const field of definition.fields) {
            const value = parseValue(values[field.key], field);
            if (value !== null) {
                parsedValues[field.key] = value;
            }
        }

        onSubmit(parsedValues, selectedUnit);
    }, [validate, definition.fields, values, selectedUnit, onSubmit]);

    // Render unit selector if multiple units available
    const renderUnitSelector = () => {
        if (!definition.availableUnits || definition.availableUnits.length <= 1) {
            return null;
        }

        return (
            <View style={styles.unitSelector}>
                {definition.availableUnits.map((unit) => (
                    <Pressable
                        key={unit.value}
                        style={[
                            styles.unitButton,
                            {
                                backgroundColor:
                                    selectedUnit === unit.value
                                        ? colors.tint
                                        : colors.listItemBackground,
                                borderColor: colors.border,
                            },
                        ]}
                        onPress={() => setSelectedUnit(unit.value)}
                    >
                        <Text
                            style={[
                                styles.unitButtonText,
                                {
                                    color:
                                        selectedUnit === unit.value
                                            ? '#FFFFFF'
                                            : colors.text,
                                },
                            ]}
                        >
                            {unit.label}
                        </Text>
                    </Pressable>
                ))}
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.form}>
                {definition.fields.map((field) => (
                    <View key={field.key} style={styles.fieldContainer}>
                        <Text
                            style={[
                                styles.fieldLabel,
                                { color: colors.text },
                            ]}
                        >
                            {field.label}
                            {field.validation?.required && (
                                <Text style={{ color: '#FF3B30' }}>
                                    {' '}
                                    *
                                </Text>
                            )}
                        </Text>

                        <View style={styles.inputRow}>
                            <TextInput
                                style={[
                                    styles.input,
                                    {
                                        backgroundColor: colors.listItemBackground,
                                        borderColor: errors[field.key]
                                            ? '#FF3B30'
                                            : colors.border,
                                        color: colors.text,
                                    },
                                ]}
                                value={values[field.key]}
                                onChangeText={(text) =>
                                    handleValueChange(field.key, text)
                                }
                                placeholder={field.placeholder}
                                placeholderTextColor={colors.textHint}
                                keyboardType={
                                    field.inputType === 'integer'
                                        ? 'number-pad'
                                        : 'decimal-pad'
                                }
                                returnKeyType="done"
                                editable={!isSubmitting}
                            />

                            <Text
                                style={[
                                    styles.inputUnit,
                                    { color: colors.textHint },
                                ]}
                            >
                                {field.unit ??
                                    (definition.availableUnits
                                        ? selectedUnit
                                        : definition.defaultUnit)}
                            </Text>
                        </View>

                        {errors[field.key] && (
                            <Text
                                style={[
                                    styles.errorText,
                                    { color: '#FF3B30' },
                                ]}
                            >
                                {errors[field.key]}
                            </Text>
                        )}
                    </View>
                ))}

                {renderUnitSelector()}
            </View>

            <View style={styles.buttonContainer}>
                {onCancel && (
                    <Pressable
                        style={[
                            styles.button,
                            styles.cancelButton,
                            { backgroundColor: colors.listItemBackground },
                        ]}
                        onPress={onCancel}
                        disabled={isSubmitting}
                    >
                        <Text style={[styles.buttonText, { color: colors.text }]}>
                            Abbrechen
                        </Text>
                    </Pressable>
                )}

                <Pressable
                    style={[
                        styles.button,
                        styles.submitButton,
                        {
                            backgroundColor: isSubmitting
                                ? colors.textHint
                                : colors.tint,
                        },
                    ]}
                    onPress={handleSubmit}
                    disabled={isSubmitting}
                >
                    <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                        {isSubmitting ? 'Speichern...' : 'Speichern'}
                    </Text>
                </Pressable>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    form: {
        padding: 16,
    },
    fieldContainer: {
        marginBottom: 20,
    },
    fieldLabel: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 8,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        height: 56,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 24,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
    inputUnit: {
        fontSize: 18,
        marginLeft: 12,
        minWidth: 50,
    },
    errorText: {
        fontSize: 14,
        marginTop: 4,
    },
    unitSelector: {
        flexDirection: 'row',
        marginTop: 8,
        gap: 8,
    },
    unitButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
    },
    unitButtonText: {
        fontSize: 14,
        fontWeight: '500',
    },
    buttonContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    button: {
        flex: 1,
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cancelButton: {},
    submitButton: {},
    buttonText: {
        fontSize: 17,
        fontWeight: '600',
    },
});
