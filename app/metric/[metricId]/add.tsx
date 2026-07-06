/**
 * Metric Input Screen
 *
 * Form sheet for entering a new metric measurement.
 * Uses List.Section and List.Item for native iOS form styling.
 * For scale metrics with valueLabels:
 * - ≤5 options: Chip buttons showing all labels
 * - >5 options: Slider with min/max labels
 */

import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { List, useTheme } from 'react-native-nice-ui';
import Slider from '@react-native-community/slider';

import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { AppDateTimePicker } from '@/src/components/ui/AppDateTimePicker';
import { useMetric, getValueLabel } from '@/src/metrics';
import type { MetricField } from '@/src/metrics';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';
import { HeaderButton } from "@/src/components/ui/navigation/HeaderButton";
import { useSharingFilter } from '@/src/hooks/useSharingFilter';

/**
 * Check if a field should use scale input (has valueLabels)
 */
function hasScaleInput(field: MetricField): boolean {
    return Boolean(field.valueLabels && field.valueLabels.length > 0);
}

/**
 * Chip button component for scale selection
 */
function ChipButton({
                        label,
                        selected,
                        onPress,
                        colors
                    }: {
    label: string;
    selected: boolean;
    onPress: () => void;
    colors: any;
}) {
    return (
        <TouchableOpacity
            style={ [
                styles.chip,
                {
                    backgroundColor: selected ? colors.tint : colors.listItemBackground,
                    borderColor: selected ? colors.tint : colors.border
                }
            ] }
            onPress={ onPress }
            activeOpacity={ 0.7 }
        >
            <Text
                style={ [
                    styles.chipText,
                    { color: selected ? '#FFFFFF' : colors.textPrimary }
                ] }
            >
                { label }
            </Text>
        </TouchableOpacity>
    );
}

/**
 * Scale input with chips for ≤5 options
 */
function ChipScaleInput({
                            field,
                            value,
                            onChange,
                            colors
                        }: {
    field: MetricField;
    value: number | null;
    onChange: (value: number) => void;
    colors: any;
}) {
    const valueLabels = field.valueLabels ?? [];

    return (
        <View style={ styles.chipContainer }>
            { valueLabels.map((vl) => (
                <ChipButton
                    key={ vl.value }
                    label={ vl.label }
                    selected={ value === vl.value }
                    onPress={ () => onChange(vl.value) }
                    colors={ colors }
                />
            )) }
        </View>
    );
}

/**
 * Scale input with slider for >5 options
 */
function SliderScaleInput({
                              field,
                              value,
                              onChange,
                              colors
                          }: {
    field: MetricField;
    value: number | null;
    onChange: (value: number) => void;
    colors: any;
}) {
    const valueLabels = field.valueLabels ?? [];
    const min = field.validation?.min ?? 0;
    const max = field.validation?.max ?? 10;

    // Get current label
    const currentLabel = value !== null ? getValueLabel(field, value) : null;

    // Get min/max labels
    const minLabel = valueLabels.find((vl) => vl.value === min)?.label ?? String(min);
    const maxLabel = valueLabels.find((vl) => vl.value === max)?.label ?? String(max);

    return (
        <View style={ styles.sliderContainer }>
            {/* Current value display */ }
            <View style={ styles.sliderValueContainer }>
                <Text style={ [styles.sliderValue, { color: colors.textPrimary }] }>
                    { value !== null ? value : '–' }
                </Text>
                { currentLabel && (
                    <Text style={ [styles.sliderLabel, { color: colors.textSecondary }] }>
                        { currentLabel }
                    </Text>
                ) }
            </View>

            {/* Slider */ }
            <Slider
                style={ styles.slider }
                value={ value ?? min }
                minimumValue={ min }
                maximumValue={ max }
                step={ 1 }
                onValueChange={ onChange }
                minimumTrackTintColor={ colors.tint }
                maximumTrackTintColor={ colors.border }
                thumbTintColor={ colors.tint }
            />

            {/* Min/Max labels */ }
            <View style={ styles.sliderLabelsRow }>
                <Text style={ [styles.sliderRangeLabel, { color: colors.textHint }] }>
                    { minLabel }
                </Text>
                <Text style={ [styles.sliderRangeLabel, { color: colors.textHint }] }>
                    { maxLabel }
                </Text>
            </View>
        </View>
    );
}

export default function MetricAdd() {
    const { t, i18n } = useTranslation();
    const { colors, isDark } = useTheme();
    const { metricId, effectiveDate } = useLocalSearchParams<{ metricId: string; effectiveDate?: string }>();
    const router = useSafeRouter();
    const { isFiltering, isLoaded: sharingLoaded, canSeeMetric } = useSharingFilter();

    const { definition, displayDefinition, displayUnit, addEntry, validate } = useMetric({ metricId });

    // Form state - text input values (string) and scale values (number)
    const [date, setDate] = useState(() => {
        if (effectiveDate) {
            const parsed = new Date(effectiveDate);
            if (!isNaN(parsed.getTime())) return parsed;
        }
        return new Date();
    });
    const [textValues, setTextValues] = useState<Record<string, string>>({});
    const [scaleValues, setScaleValues] = useState<Record<string, number | null>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [initialized, setInitialized] = useState(false);

    // Initialize form values when definition is loaded
    useEffect(() => {
        if (definition && !initialized) {
            const initialText: Record<string, string> = {};
            const initialScale: Record<string, number | null> = {};
            for (const field of definition.fields) {
                if (hasScaleInput(field)) {
                    initialScale[field.key] = null;
                } else {
                    initialText[field.key] = '';
                }
            }
            setTextValues(initialText);
            setScaleValues(initialScale);
            setInitialized(true);
        }
    }, [definition, initialized]);

    // Check if form has values
    const hasValues = definition?.fields.some((field) => {
        if (hasScaleInput(field)) {
            return scaleValues[field.key] !== null;
        }
        return textValues[field.key]?.trim();
    }) ?? false;

    // Handle save
    const handleSave = useCallback(async () => {
        if (!definition || isSubmitting) {
            return;
        }

        // Parse values from both text inputs and scale inputs
        const parsedValues: Record<string, number> = {};
        for (const field of definition.fields) {
            if (hasScaleInput(field)) {
                // Scale input value
                const scaleValue = scaleValues[field.key];
                if (scaleValue === null) {
                    Alert.alert(t('common.error'), t('metric.fieldRequired', { field: field.label }));
                    return;
                }
                parsedValues[field.key] = scaleValue;
            } else {
                // Text input value
                const input = textValues[field.key];
                if (!input?.trim()) {
                    Alert.alert(t('common.error'), t('metric.fieldRequired', { field: field.label }));
                    return;
                }
                const normalized = input.replace(',', '.');
                const parsed = parseFloat(normalized);
                if (isNaN(parsed)) {
                    Alert.alert(t('common.error'), t('metric.fieldInvalidNumber', { field: field.label }));
                    return;
                }
                parsedValues[field.key] = parsed;
            }
        }

        // Validate
        const inputUnit = displayUnit ?? definition.defaultUnit;
        const validation = validate(parsedValues, inputUnit);
        if (!validation.valid) {
            const firstError = Object.values(validation.errors)[0];
            Alert.alert(t('common.error'), firstError);
            return;
        }

        setIsSubmitting(true);

        try {
            await addEntry(parsedValues, inputUnit, date);
            router.back();
        }
        catch (error) {
            Alert.alert(
                t('common.error'),
                error instanceof Error
                    ? error.message
                    : t('metric.saveError')
            );
        }
        finally {
            setIsSubmitting(false);
        }
    }, [definition, displayUnit, textValues, scaleValues, date, addEntry, validate, isSubmitting, router, t]);

    // Handle close
    const handleClose = useCallback(() => {
        router.back();
    }, []);

    if (!sharingLoaded || (isFiltering && !canSeeMetric(metricId))) {
        if (isFiltering && sharingLoaded) router.back();
        return null;
    }

    if (!definition || !displayDefinition) {
        return null;
    }

    return (
        <KeyboardAvoidingView
            style={ [styles.container, { backgroundColor: colors.background }] }
            behavior={ Platform.OS === 'ios' ? 'padding' : 'height' }
            keyboardVerticalOffset={ 20 }
        >
            {
                Platform.OS === 'android' ? (
                    <Stack.Screen
                        options={ {
                            animation: 'slide_from_bottom',
                            headerShown: true,
                            headerTransparent: false,
                            headerBackVisible: false,
                            headerTitle: definition.name,
                            headerRight: () => (
                                <HeaderButton
                                    onPress={ handleSave }
                                    icon="checkmark"
                                    variant="done"
                                    disabled={!hasValues || isSubmitting}
                                />
                            )
                        } }
                    />
                ) : (
                    <Stack.Screen>
                        <Stack.Screen.Title></Stack.Screen.Title>
                        <Stack.Toolbar placement="left">
                            <Stack.Toolbar.Button icon="xmark" onPress={ handleClose } />
                        </Stack.Toolbar>
                        <Stack.Toolbar placement="right">
                            <Stack.Toolbar.Button icon="checkmark" onPress={ handleSave } disabled={!hasValues || isSubmitting} />
                        </Stack.Toolbar>
                    </Stack.Screen>
                )
            }

            <ScrollView
                style={ { backgroundColor: colors.background } }
                contentContainerStyle={ styles.scrollView }
                contentInsetAdjustmentBehavior="automatic"
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
            >
                <ScrollViewContent>
                    <ScreenHeader
                        icon={ displayDefinition.icon }
                        iconTintColor={ displayDefinition.iconColor }
                        title={ displayDefinition.name }
                    />

                    <List.Section rounded>
                        {/* Date picker */ }
                        <List.Item
                            title={ t('metric.date') }
                            hideChevron
                            rightCmp={
                                <AppDateTimePicker
                                    value={ date }
                                    mode="date"
                                    maximumDate={ new Date() }
                                    onChange={ (selectedDate) => setDate(selectedDate) }
                                />
                            }
                        />

                        {/* Time picker */}
                        <List.Item
                            title={ t('metric.time') }
                            hideChevron
                            rightCmp={
                                <AppDateTimePicker
                                    value={ date }
                                    mode="time"
                                    onChange={ (selectedDate) => setDate(selectedDate) }
                                />
                            }
                        />

                        {/* Value input fields - text inputs only */ }
                        { displayDefinition.fields.map((field, index) => {
                            // Skip fields with scale input - they're rendered separately
                            if (hasScaleInput(field)) {
                                return null;
                            }

                            // Get unit to display (from field or definition)
                            const unit = field.unit ?? displayDefinition.defaultUnit;
                            // Don't show unit for scale metrics (they have showUnit: false)
                            const showUnit = definition.showUnit !== false && unit;

                            return (
                                <List.InputItem
                                    key={ field.key }
                                    label={ field.label }
                                    value={ textValues[field.key] }
                                    onChangeText={ (text) => {
                                        // Sanitize input
                                        let sanitized = text;
                                        if (field.inputType === 'integer') {
                                            sanitized = text.replace(/[^0-9]/g, '');
                                        } else {
                                            sanitized = text.replace(/[^0-9,\\.]/g, '');
                                            sanitized = sanitized.replace('.', ',');
                                        }
                                        setTextValues((prev) => ({
                                            ...prev,
                                            [field.key]: sanitized
                                        }));
                                    } }
                                    placeholder={ field.placeholder ?? '0' }
                                    keyboardType={
                                        field.inputType === 'integer'
                                            ? 'number-pad'
                                            : 'decimal-pad'
                                    }
                                    rightLabel={ showUnit ? unit : undefined }
                                    inline
                                    lastItem={ index === displayDefinition.fields.length - 1 }
                                />
                            );
                        }) }


                        {/* Scale inputs - rendered as separate sections */ }
                        { displayDefinition.fields.map((field) => {
                            if (!hasScaleInput(field)) {
                                return null;
                            }

                            const valueLabels = field.valueLabels ?? [];
                            const useChips = valueLabels.length <= 5;

                            return (

                                <View
                                    style={ [styles.scaleInputWrapper, { backgroundColor: colors.listItemBackground }] }>
                                    { useChips ? (
                                        <ChipScaleInput
                                            field={ field }
                                            value={ scaleValues[field.key] }
                                            onChange={ (value) =>
                                                setScaleValues((prev) => ({
                                                    ...prev,
                                                    [field.key]: value
                                                }))
                                            }
                                            colors={ colors }
                                        />
                                    ) : (
                                        <SliderScaleInput
                                            field={ field }
                                            value={ scaleValues[field.key] }
                                            onChange={ (value) =>
                                                setScaleValues((prev) => ({
                                                    ...prev,
                                                    [field.key]: value
                                                }))
                                            }
                                            colors={ colors }
                                        />
                                    ) }
                                </View>

                            );
                        }) }

                    </List.Section>
                </ScrollViewContent>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    container: {
        flex: 1
    },
    content: {
        paddingTop: 60
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '600'
    },
    scaleInputWrapper: {
        padding: 16
    },
    // Chip styles
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8
    },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1
    },
    chipText: {
        fontSize: 15,
        fontWeight: '500'
    },
    // Slider styles
    sliderContainer: {
        paddingVertical: 0
    },
    sliderValueContainer: {
        alignItems: 'center',
        marginBottom: 8
    },
    sliderValue: {
        fontSize: 32,
        fontWeight: '700',
        fontVariant: ['tabular-nums']
    },
    sliderLabel: {
        fontSize: 17,
        fontWeight: '500'
    },
    slider: {
        width: '100%',
        height: 32
    },
    sliderLabelsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4
    },
    sliderRangeLabel: {
        fontSize: 13,
    },
});
