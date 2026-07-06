import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    LayoutChangeEvent, Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Stack } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, List, useTheme } from 'react-native-nice-ui';
import Slider from '@react-native-community/slider';
import { useTranslation } from 'react-i18next';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { CloseButton } from '@/src/components/ui/navigation/CloseButton';
import { fmtDate } from '@/src/lib/formatDate';
import type {
    QuestionnaireDefinition,
    QuestionnaireIntro,
    QuestionnaireAvailability,
    QuestionDefinition,
    QuestionOption,
    QuestionnaireEntry
} from '../types';
import {
    getAllQuestions,
    getScoreInterpretation,
    getDomainMaxScore,
    getQuestionnaireAvailability
} from '../types';

/**
 * Get translated option label, falling back to direct label if no key.
 */
function getOptionLabel(option: QuestionOption, t: (key: string) => string): string {
    if (option.labelKey) {
        return t(option.labelKey);
    }
    return option.label;
}

/**
 * Get translated option description, falling back to direct description if no key.
 */
function getOptionDescription(option: QuestionOption, t: (key: string) => string): string | undefined {
    if (option.descriptionKey) {
        return t(option.descriptionKey);
    }
    return option.description;
}

type QuestionSliderProps = {
    question: QuestionDefinition;
    value: number | undefined;
    onChange: (value: number) => void;
};

/**
 * Slider input for questions with many options
 */
function QuestionSlider({ question, value, onChange }: QuestionSliderProps) {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const options = question.options;

    // Get min/max from options
    const values = options.map(o => o.value);
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Use defaultValue from question definition if set and no value yet
    React.useEffect(() => {
        if (value === undefined && question.defaultValue !== undefined) {
            onChange(question.defaultValue);
        }
    }, []);

    // Find label for current value
    const currentOption = value !== undefined ? options.find(o => o.value === value) : undefined;
    const currentLabel = currentOption
        ? (getOptionLabel(currentOption, t) ?? getOptionDescription(currentOption, t))
        : undefined;

    // Get min/max labels
    const minOption = options.find(o => o.value === min);
    const maxOption = options.find(o => o.value === max);
    const minLabel = minOption ? getOptionLabel(minOption, t) : String(min);
    const maxLabel = maxOption ? getOptionLabel(maxOption, t) : String(max);

    return (
        <View style={ [sliderStyles.container, { backgroundColor: colors.listItemBackground }] }>
            {/* Current value display */ }
            <View style={ sliderStyles.valueContainer }>
                <Text style={ [sliderStyles.value, { color: colors.textPrimary }] }>
                    { value !== undefined ? value : '–' }
                </Text>
                { currentLabel && (
                    <Text style={ [sliderStyles.label, { color: colors.textSecondary }] }>
                        { currentLabel }
                    </Text>
                ) }
            </View>

            {/* Slider */ }
            <Slider
                style={ sliderStyles.slider }
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
            <View style={ sliderStyles.labelsRow }>
                <Text style={ [sliderStyles.rangeLabel, { color: colors.textHint }] }>
                    { minLabel }
                </Text>
                <Text style={ [sliderStyles.rangeLabel, { color: colors.textHint }] }>
                    { maxLabel }
                </Text>
            </View>
        </View>
    );
}

const sliderStyles = StyleSheet.create({
    container: {
        padding: 16,
        paddingTop: 8
    },
    valueContainer: {
        minHeight: 58,
        alignItems: 'center',
        marginBottom: 6
    },
    value: {
        fontSize: 30,
        fontWeight: '700',
        fontVariant: ['tabular-nums']
    },
    label: {
        fontSize: 16,
        fontWeight: '500'
    },
    slider: {
        width: '100%',
        height: 32
    },
    labelsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4
    },
    rangeLabel: {
        fontSize: 13
    }
});

/**
 * Chip buttons for compact selection
 */
function QuestionChips({ question, value, onChange }: QuestionSliderProps) {
    const { t } = useTranslation();
    const { colors } = useTheme();

    // Use defaultValue from question definition if set and no value yet
    React.useEffect(() => {
        if (value === undefined && question.defaultValue !== undefined) {
            onChange(question.defaultValue);
        }
    }, []);

    return (
        <View style={ [chipStyles.container, { backgroundColor: colors.listItemBackground }] }>
            { question.options.map((option) => {
                const isSelected = value === option.value;
                return (
                    <TouchableOpacity
                        key={ option.value }
                        style={ [
                            chipStyles.chip,
                            {
                                backgroundColor: isSelected ? colors.tint : colors.listItemBackground,
                                borderColor: isSelected ? colors.tint : colors.border
                            }
                        ] }
                        onPress={ () => onChange(option.value) }
                        activeOpacity={ 0.7 }
                    >
                        <Text
                            style={ [
                                chipStyles.chipText,
                                { color: isSelected ? '#FFFFFF' : colors.textPrimary }
                            ] }
                        >
                            { getOptionLabel(option, t) }
                        </Text>
                    </TouchableOpacity>
                );
            }) }
        </View>
    );
}

const chipStyles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        padding: 16
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
    }
});

import { useQuestionnaireForm, useQuestionnaire } from '../hooks/useQuestionnaire';
import { HeaderButton } from "@/src/components/ui/navigation/HeaderButton";

// =============================================================================
// Types
// =============================================================================

export type QuestionnaireScreenProps = {
    /** The questionnaire definition */
    definition: QuestionnaireDefinition;
    /** Entry for readonly review mode */
    entry?: QuestionnaireEntry;
    /** Override effective date for backfill entries (e.g., "yesterday") */
    effectiveDate?: Date;
    /** Called when questionnaire is completed and saved */
    onComplete?: () => void;
    /** Called when user cancels */
    onCancel?: () => void;
};

type Phase = 'intro' | 'questions' | 'result';

// =============================================================================
// Helper Functions
// =============================================================================

function toRgba(color: string, alpha = 1) {
    if (color.startsWith('#')) {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const a = hex.length === 8
            ? parseInt(hex.substring(6, 8), 16) / 255
            : alpha;
        return `rgba(${ r }, ${ g }, ${ b }, ${ a })`;
    }
    if (color.startsWith('rgba')) {
        return color.replace(
            /rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/,
            `rgba($1, $2, $3, ${ alpha })`
        );
    }
    if (color.startsWith('rgb')) {
        return color.replace(
            /rgb\((\d+),\s*(\d+),\s*(\d+)\)/,
            `rgba($1, $2, $3, ${ alpha })`
        );
    }
    return color;
}

// =============================================================================
// Component
// =============================================================================

export function QuestionnaireScreen({
                                        definition,
                                        entry,
                                        effectiveDate,
                                        onComplete,
                                        onCancel
                                    }: QuestionnaireScreenProps) {
    const { t } = useTranslation();
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();

    const readonly = !!entry;

    const [phase, setPhase] = useState<Phase>(
        readonly ? 'intro' : (definition.intro ? 'intro' : 'questions')
    );
    const [isSaving, setIsSaving] = useState(false);

    const { save, latestEntry } = useQuestionnaire({ questionnaireId: definition.id });
    const form = useQuestionnaireForm({ definition, initialAnswers: entry?.answers });

    const availability = useMemo(
        () => getQuestionnaireAvailability(definition, latestEntry?.completedAt ?? null),
        [definition, latestEntry]
    );

    const allQuestions = useMemo(() => getAllQuestions(definition), [definition]);

    // Pre-fill answers from previous response for questions with prefillFromPreviousResponse
    useEffect(() => {
        if (readonly || !latestEntry) return;
        for (const question of allQuestions) {
            if (
                question.prefillFromPreviousResponse &&
                latestEntry.answers[question.id] !== undefined &&
                form.answers[question.id] === undefined
            ) {
                form.setAnswer(question.id, latestEntry.answers[question.id]);
            }
        }
    }, [latestEntry]);

    const displayMode = definition.displayMode ?? 'scroll';
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

    const BASECOLOR = colors.background;

    // Refs for auto-scroll
    const scrollViewRef = useRef<ScrollView>(null);
    const questionPositions = useRef<number[]>([]);

    const handleQuestionLayout = useCallback((index: number, event: LayoutChangeEvent) => {
        questionPositions.current[index] = event.nativeEvent.layout.y;
    }, []);

    const scrollToQuestion = useCallback((index: number) => {
        const position = questionPositions.current[index];
        if (position !== undefined && scrollViewRef.current) {
            scrollViewRef.current.scrollTo({
                y: position - 20,
                animated: true
            });
        }
    }, []);

    const handleAnswer = useCallback((questionId: string, value: number, questionIndex: number, autoScroll = true) => {
        form.setAnswer(questionId, value);

        // Auto-scroll to next question (disabled for sliders)
        if (autoScroll && questionIndex < allQuestions.length - 1) {
            setTimeout(() => {
                scrollToQuestion(questionIndex + 1);
            }, 300);
        }
    }, [form, allQuestions.length, scrollToQuestion]);

    const handleNext = useCallback(() => {
        if (currentQuestionIndex < allQuestions.length - 1) {
            setCurrentQuestionIndex(i => i + 1);
        }
    }, [currentQuestionIndex, allQuestions.length]);

    const handlePrevious = useCallback(() => {
        if (currentQuestionIndex > 0) {
            setCurrentQuestionIndex(i => i - 1);
        } else if (definition.intro) {
            setPhase('intro');
        }
    }, [currentQuestionIndex, definition.intro]);

    const handleSubmit = useCallback(async () => {
        if (!form.isComplete) {
            Alert.alert(
                t('questionnaire.incomplete'),
                t('questionnaire.incompleteMessage')
            );
            return;
        }

        setIsSaving(true);
        const result = await save(form.answers, effectiveDate);
        setIsSaving(false);

        if (result.success) {
            setPhase('result');
        } else {
            Alert.alert(t('common.error'), result.error ?? t('questionnaire.saveFailed'));
        }
    }, [form.isComplete, form.answers, save, effectiveDate, t]);

    const handleClose = useCallback(() => {
        if (!readonly && form.answeredCount > 0 && phase === 'questions') {
            Alert.alert(
                t('questionnaire.cancelTitle'),
                t('questionnaire.cancelMessage'),
                [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                        text: t('questionnaire.quit'),
                        style: 'destructive',
                        onPress: () => {
                            onCancel?.();
                            router.back();
                        }
                    }
                ]
            );
        } else {
            onCancel?.();
            router.back();
        }
    }, [readonly, form.answeredCount, phase, onCancel, router, t]);

    const handleFinish = useCallback(() => {
        onComplete?.();
        router.back();
    }, [onComplete, router]);

    const BOTTOM_BAR_HEIGHT = (displayMode === 'paged' ? 74 : 64) + insets.bottom;

    const handleStartQuestionnaire = useCallback(() => {
        if (displayMode === 'paged') {
            setCurrentQuestionIndex(0);
        }
        setPhase('questions');
    }, [displayMode]);

    const headerSubtitle = readonly
        ? t('questionnaire.review')
        : phase === 'intro'
            ? t('questionnaire.introduction')
            : phase === 'questions'
                ? displayMode === 'paged'
                    ? `${ currentQuestionIndex + 1 } / ${ allQuestions.length }`
                    : t('questionnaire.answeredOf', { answered: form.answeredCount, total: form.totalQuestions })
                : t('questionnaire.result');

    // Track question index globally across domains
    let globalQuestionIndex = 0;

    return (
        <View style={ styles.container }>
            {
                Platform.OS === 'android' ? (
                    <Stack.Screen
                        options={ {
                            gestureEnabled: false,
                            headerTransparent: false,
                            headerBackVisible: false,
                            headerTitle: () => (
                                <View style={ [styles.headerTitleContainer, { alignItems: 'flex-start' }] }>
                                    <Text style={ [styles.headerTitle, { color: colors.textPrimary }] }>
                                        { definition.shortName ?? definition.name }
                                    </Text>
                                    <Text style={ [styles.headerSubtitle, { color: colors.textSecondary }] }>
                                        { headerSubtitle }
                                    </Text>
                                </View>
                            ),
                            headerRight: () => (
                                <CloseButton onPress={ handleClose } />
                            )
                        } }
                    />
                ) : (
                    <>
                        <Stack.Screen.Title asChild>
                            <View style={ styles.headerTitleContainer }>
                                <Text style={ [styles.headerTitle, { color: colors.textPrimary }] }>
                                    { definition.shortName ?? definition.name }
                                </Text>
                                <Text style={ [styles.headerSubtitle, { color: colors.textSecondary }] }>
                                    { headerSubtitle }
                                </Text>
                            </View>
                        </Stack.Screen.Title>
                        <Stack.Toolbar placement="right">
                            <Stack.Toolbar.Button icon="xmark" variant="plain" onPress={handleClose} />
                        </Stack.Toolbar>
                    </>
                )
            }

            <>


                <ScrollView
                    ref={ scrollViewRef }
                    style={ { flex: 1, backgroundColor: BASECOLOR } }
                    // stickyHeaderIndices={[ ...(displayMode === 'paged' ? [0] : []), ...(definition.introText ? [0] : []) ] }
                    contentContainerStyle={ [
                        phase === 'intro'
                            ? styles.introContent
                            : phase === 'result'
                                ? styles.resultContent
                                : styles.questionsContent,
                        { paddingBottom: BOTTOM_BAR_HEIGHT + insets.bottom, alignItems: 'center' }
                    ] }
                    contentInsetAdjustmentBehavior="automatic"
                >
                    <View style={ { width: '100%', maxWidth: 720 } }>
                        { effectiveDate && phase !== 'result' && (
                            <View style={ [styles.backfillBanner, { backgroundColor: colors.tint + '15' }] }>
                                <Text style={ [styles.backfillBannerText, { color: colors.tint }] }>
                                    { t('todo.backfillBanner', { date: fmtDate(effectiveDate, true) }) }
                                </Text>
                            </View>
                        ) }
                        { phase === 'intro' && (definition.intro || readonly) ? (
                            /* Intro View */
                            <IntroView
                                intro={ definition.intro }
                                fallbackIconColor={ definition.iconColor }
                                availability={ availability }
                                hasSchedule={ !!definition.schedule }
                                completedAt={ entry?.completedAt }
                            />
                        ) : phase === 'result' ? (
                            /* Result View */
                            <ResultView
                                definition={ definition }
                                totalScore={ readonly ? entry!.totalScore : form.totalScore }
                                domainScores={ readonly ? (entry!.domainScores ?? {}) : form.domainScores }
                                interpretation={ readonly
                                    ? getScoreInterpretation(definition, entry!.totalScore)
                                    : form.interpretation
                                }
                            />
                        ) : displayMode === 'paged' ? (
                            /* Paged Questions View */
                            <View pointerEvents={ readonly ? 'none' : 'auto' }>

                                { (() => {
                                    const question = allQuestions[currentQuestionIndex];
                                    const pageIntroText = question.introText ?? definition.introText;
                                    const inputType = question.inputType
                                        ?? (question.options.length > 5 ? 'slider' : 'list');

                                    return (
                                        <>
                                            { pageIntroText && (
                                                <Text
                                                    style={ [styles.questionsIntroText, { color: colors.textPrimary }] }>
                                                    { pageIntroText }
                                                </Text>
                                            ) }
                                            <List.SectionCard
                                                header={ t('questionnaire.questionOf', {
                                                    current: currentQuestionIndex + 1,
                                                    total: allQuestions.length
                                                }) }
                                                title={ question.text }
                                                titleStyle={ styles.questionTitle }
                                                rounded
                                            >
                                                { inputType === 'slider' ? (
                                                    <QuestionSlider
                                                        question={ question }
                                                        value={ form.answers[question.id] }
                                                        onChange={ (value) => handleAnswer(question.id, value, currentQuestionIndex, false) }
                                                    />
                                                ) : inputType === 'chips' ? (
                                                    <QuestionChips
                                                        question={ question }
                                                        value={ form.answers[question.id] }
                                                        onChange={ (value) => handleAnswer(question.id, value, currentQuestionIndex, false) }
                                                    />
                                                ) : (
                                                    question.options.map((option, oIndex) => (
                                                        <List.Item
                                                            key={ option.value }
                                                            title={ getOptionLabel(option, t) }
                                                            subtitle={ getOptionDescription(option, t) }
                                                            subtitleNumberOfLines={ 3 }
                                                            type="checkbox"
                                                            checkboxSize={ 24 }
                                                            wrapperStyle={ {
                                                                paddingTop: 12,
                                                                paddingBottom: 12,
                                                                minHeight: 35
                                                            } }
                                                            checked={ form.answers[question.id] === option.value }
                                                            onPress={ () => handleAnswer(question.id, option.value, currentQuestionIndex, false) }
                                                            hideChevron
                                                            lastItem={ oIndex === question.options.length - 1 }
                                                        />
                                                    ))
                                                ) }
                                            </List.SectionCard>
                                        </>
                                    );
                                })() }
                            </View>
                        ) : (
                            /* Scroll Questions View */
                            <View pointerEvents={ readonly ? 'none' : 'auto' }>
                                { definition.introText && (
                                    <Text style={ [styles.questionsIntroText, { color: colors.textPrimary }] }>
                                        { definition.introText }
                                    </Text>
                                ) }

                                { definition.domains.map((domain) => (
                                    <React.Fragment key={ domain.id }>
                                        { definition.domains.length > 1 && (
                                            <Text style={ [styles.domainTitle, { color: colors.textSecondary }] }>
                                                { domain.name }
                                            </Text>
                                        ) }

                                        { domain.questions.map((question) => {
                                            const currentIndex = globalQuestionIndex++;
                                            // Determine input type: explicit or auto-detect
                                            const inputType = question.inputType
                                                ?? (question.options.length > 5 ? 'slider' : 'list');

                                            return (
                                                <View
                                                    key={ question.id }
                                                    onLayout={ (e) => handleQuestionLayout(currentIndex, e) }
                                                >
                                                    <List.SectionCard
                                                        header={ t('questionnaire.questionOf', {
                                                            current: currentIndex + 1,
                                                            total: allQuestions.length
                                                        }) }
                                                        title={ question.text }
                                                        titleStyle={ styles.questionTitle }
                                                        rounded
                                                    >
                                                        { inputType === 'slider' ? (
                                                            <QuestionSlider
                                                                question={ question }
                                                                value={ form.answers[question.id] }
                                                                onChange={ (value) => handleAnswer(question.id, value, currentIndex, false) }
                                                            />
                                                        ) : inputType === 'chips' ? (
                                                            <QuestionChips
                                                                question={ question }
                                                                value={ form.answers[question.id] }
                                                                onChange={ (value) => handleAnswer(question.id, value, currentIndex) }
                                                            />
                                                        ) : (
                                                            question.options.map((option, oIndex) => (
                                                                <List.Item
                                                                    key={ option.value }
                                                                    title={ getOptionLabel(option, t) }
                                                                    subtitle={ getOptionDescription(option, t) }
                                                                    subtitleNumberOfLines={ 3 }
                                                                    type="checkbox"
                                                                    checkboxSize={ 24 }
                                                                    wrapperStyle={ {
                                                                        paddingTop: 12,
                                                                        paddingBottom: 12,
                                                                        minHeight: 35
                                                                    } }
                                                                    checked={ form.answers[question.id] === option.value }
                                                                    onPress={ () => handleAnswer(question.id, option.value, currentIndex) }
                                                                    hideChevron
                                                                    lastItem={ oIndex === question.options.length - 1 }
                                                                />
                                                            ))
                                                        ) }
                                                    </List.SectionCard>
                                                </View>
                                            );
                                        }) }
                                    </React.Fragment>
                                )) }
                            </View>
                        ) }
                    </View>
                </ScrollView>
            </>

            <View
                style={ [
                    styles.bottomBar,
                    {
                        height: BOTTOM_BAR_HEIGHT,
                        paddingBottom: insets.bottom
                    }
                ] }
                pointerEvents="box-none"
            >
                <LinearGradient
                    pointerEvents="none"
                    colors={
                        isDark
                            ? [
                                toRgba(BASECOLOR, 0.15),
                                toRgba(BASECOLOR, 0.95),
                                toRgba(BASECOLOR, 1)
                            ]
                            : ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.95)', 'rgba(255,255,255,1)']
                    }
                    style={ {
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 0
                    } }
                />
                <View style={ styles.bottomBarButtonWrapper }>
                    { readonly ? (
                        phase === 'intro' ? (
                            <Button
                                title={ t('questionnaire.viewAnswers') }
                                onPress={ handleStartQuestionnaire }
                                rounded
                            />
                        ) : phase === 'questions' ? (
                            displayMode === 'paged' ? (
                                <>
                                    {/* Progress Bar */ }
                                    <View
                                        style={ [styles.progressContainer, isDark ? { backgroundColor: 'rgba(255,255,255,0.1)' } : { backgroundColor: 'rgba(0,0,0,0.1)' }] }>
                                        <View style={ [styles.progressBar, {
                                            width: `${ ((currentQuestionIndex + 1) / allQuestions.length) * 100 }%`,
                                            backgroundColor: colors.tint
                                        }] } />
                                    </View>

                                    <View style={ styles.pagedButtonRow }>
                                        <Button
                                            title={ t('questionnaire.previous') }
                                            onPress={ handlePrevious }
                                            disabled={ currentQuestionIndex === 0 && !definition.intro }
                                            rounded
                                            variant="secondary"
                                            style={ { flex: 1 } }
                                        />
                                        { currentQuestionIndex < allQuestions.length - 1 ? (
                                            <Button
                                                title={ t('questionnaire.next') }
                                                onPress={ handleNext }
                                                rounded
                                                style={ { flex: 1 } }
                                            />
                                        ) : (
                                            <Button
                                                title={ t('questionnaire.viewResult') }
                                                onPress={ () => setPhase('result') }
                                                rounded
                                                style={ { flex: 1 } }
                                            />
                                        ) }
                                    </View>
                                </>

                            ) : (
                                <Button
                                    title={ t('questionnaire.viewResult') }
                                    onPress={ () => setPhase('result') }
                                    rounded
                                />
                            )
                        ) : (
                            <Button title={ t('common.done') } onPress={ () => router.back() } rounded />
                        )
                    ) : (
                        phase === 'intro' ? (
                            <Button
                                title={ definition.intro?.buttonText ?? t('questionnaire.start') }
                                onPress={ handleStartQuestionnaire }
                                rounded
                            />
                        ) : phase === 'result' ? (
                            <Button title={ t('common.done') } onPress={ handleFinish } rounded />
                        ) : displayMode === 'paged' ? (
                            <>
                                {/* Progress Bar */ }
                                <View
                                    style={ [styles.progressContainer, isDark ? { backgroundColor: 'rgba(255,255,255,0.1)' } : { backgroundColor: 'rgba(0,0,0,0.1)' }] }>
                                    <View style={ [styles.progressBar, {
                                        width: `${ ((currentQuestionIndex + 1) / allQuestions.length) * 100 }%`,
                                        backgroundColor: colors.tint
                                    }] } />
                                </View>
                                <View style={ styles.pagedButtonRow }>
                                    <Button
                                        title={ t('questionnaire.previous') }
                                        onPress={ handlePrevious }
                                        disabled={ currentQuestionIndex === 0 && !definition.intro }
                                        rounded
                                        variant="secondary"
                                        style={ { flex: 1 } }
                                    />
                                    { currentQuestionIndex < allQuestions.length - 1 ? (
                                        <Button
                                            title={ t('questionnaire.next') }
                                            onPress={ handleNext }
                                            rounded
                                            style={ { flex: 1 } }
                                        />
                                    ) : (
                                        <Button
                                            title={ t('common.done') }
                                            onPress={ handleSubmit }
                                            disabled={ !form.isComplete || isSaving }
                                            loading={ isSaving }
                                            rounded
                                            style={ { flex: 1 } }
                                        />
                                    ) }
                                </View>
                            </>
                        ) : (
                            <Button
                                title={ t('common.done') }
                                onPress={ handleSubmit }
                                disabled={ !form.isComplete || isSaving }
                                loading={ isSaving }
                                rounded
                            />
                        )
                    ) }
                </View>
            </View>
        </View>
    );
}

// =============================================================================
// Intro View
// =============================================================================

type IntroViewProps = {
    intro?: QuestionnaireIntro;
    fallbackIconColor: string;
    availability: QuestionnaireAvailability;
    hasSchedule: boolean;
    completedAt?: Date;
};

function IntroView({ intro, fallbackIconColor, availability, hasSchedule, completedAt }: IntroViewProps) {
    const { t, i18n } = useTranslation();
    const { colors } = useTheme();

    const scheduleText = useMemo(() => {
        if (!hasSchedule) {
            return null;
        }

        const dueInDays = availability.dueInDays;
        if (dueInDays === undefined) {
            return null;
        }

        if (dueInDays === 0) {
            return t('questionnaire.scheduleInfo.dueToday');
        } else if (dueInDays < 0) {
            return t('questionnaire.scheduleInfo.overdue', { count: Math.abs(dueInDays) });
        } else {
            return t('questionnaire.scheduleInfo.dueInDays', { count: dueInDays });
        }
    }, [hasSchedule, availability, t]);

    return (
        <View style={ styles.introInner }>
            { intro && (
                <ScreenHeader
                    icon={ intro.icon }
                    iconTintColor={ intro.iconColor ?? fallbackIconColor }
                    title={ intro.title }
                />
            ) }
            { completedAt ? (
                <Text style={ [styles.introDescription, { color: colors.textSecondary }] }>
                    { t('questionnaire.completedOn', {
                        date: fmtDate(completedAt, i18n.language === 'de')
                    }) }
                </Text>
            ) : intro ? (
                <Text style={ [styles.introDescription, { color: colors.textSecondary }] }>
                    { intro.description }
                </Text>
            ) : null }
            { !completedAt && scheduleText && (
                <Text style={ [styles.introSchedule, { color: colors.textHint }] }>
                    { scheduleText }
                </Text>
            ) }
            { !completedAt && intro?.researchNote && (
                <Text style={ [styles.introResearchNote, { color: colors.textSecondary }] }>
                    { intro.researchNote }
                </Text>
            ) }
        </View>
    );
}

// =============================================================================
// Result View
// =============================================================================

type ResultViewProps = {
    definition: QuestionnaireDefinition;
    totalScore: number;
    domainScores: Record<string, number>;
    interpretation: ReturnType<typeof getScoreInterpretation>;
};

function ResultView({
                        definition,
                        totalScore,
                        domainScores,
                        interpretation
                    }: ResultViewProps) {
    const { t } = useTranslation();
    const { colors } = useTheme();

    const resultColor = interpretation?.color ?? colors.tint;

    return (
        <View style={ { flex: 1 } }>
            <List.Section rounded>
                <View style={ styles.resultInner }>
                    { definition.scoring.showScore !== false && (
                        <>
                            <Text style={ [styles.resultScore, { color: resultColor }] }>
                                { totalScore } / { definition.scoring.maxScore }
                            </Text>
                            { interpretation && (
                                <Text style={ [styles.resultSeverity, { color: resultColor }] }>
                                    { interpretation.label }
                                </Text>
                            ) }
                        </>
                    ) }
                    { interpretation && (
                        <Text style={ [styles.resultDescription, { color: colors.textPrimary }] }>
                            { interpretation.description }
                        </Text>
                    ) }
                </View>
            </List.Section>

            {/* Domain Scores */ }
            { definition.scoring.calculateDomainScores && definition.domains.length > 1 && (
                <List.Section title={ t('questionnaire.domains') } rounded>
                    { definition.domains.map((domain, index) => {
                        const score = domainScores[domain.id] ?? 0;
                        const maxScore = getDomainMaxScore(domain);
                        return (
                            <List.Item
                                key={ domain.id }
                                title={ domain.name }
                                rightTitle={ `${ score } / ${ maxScore }` }
                                hideChevron
                                lastItem={ index === definition.domains.length - 1 }
                            />
                        );
                    }) }
                </List.Section>
            ) }
            <List.Wrapper>
                <List.Text textStyle={ { color: colors.textSecondary } }>
                    { t('questionnaire.disclaimer') }
                </List.Text>
            </List.Wrapper>
        </View>
    );
}

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    backfillBanner: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
        marginHorizontal: 16,
        marginBottom: 8,
        alignItems: 'center',
    },
    backfillBannerText: {
        fontSize: 14,
        fontWeight: '500',
    },
    bottomBar: {
        alignItems: 'center',
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: 10,
        zIndex: 9999,
        elevation: 50
    },
    bottomBarButtonWrapper: {
        paddingHorizontal: 16,
        width: '100%',
        maxWidth: 720
    },
    headerTitleContainer: {
        alignItems: 'center',
        flex: 1
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '600'
    },
    headerSubtitle: {
        fontSize: 12,
        marginTop: 1
    },
    // Intro styles
    introContent: {
        paddingVertical: 20
    },
    introInner: {
        paddingHorizontal: 20,
        paddingTop: 40
    },
    introDescription: {
        fontSize: 17,
        lineHeight: 24,
        textAlign: 'center',
        marginTop: 16
    },
    introSchedule: {
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
        marginTop: 12
    },
    introResearchNote: {
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginTop: 24,
        fontStyle: 'italic'
    },
    // Questions styles
    questionsIntroText: {
        fontSize: 22,
        fontWeight: '700',
        lineHeight: 28,
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 8
    },
    questionsContent: {
        paddingBottom: 20
    },
    domainTitle: {
        fontSize: 14,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 8
    },
    questionTitle: {
        fontSize: 16,
        fontWeight: '600',
        lineHeight: 22
    },
    // Paged mode styles
    progressContainer: {
        height: 6,
        borderRadius: 3,
        marginHorizontal: 20,
        marginBottom: 16,
        overflow: 'hidden'
    },
    progressBar: {
        height: '100%',
        borderRadius: 2
    },
    pagedButtonRow: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 16,
        width: '100%',
        maxWidth: 720
    },
    // Result styles
    resultContent: {
        paddingVertical: 20
    },
    resultInner: {
        padding: 20,
        alignItems: 'center'
    },
    resultLabel: {
        fontSize: 15,
        fontWeight: '500',
        marginBottom: 8
    },
    resultScore: {
        fontSize: 48,
        fontWeight: '700'
    },
    resultSeverity: {
        fontSize: 24,
        fontWeight: '600',
        marginTop: 4,
        textAlign: 'center'
    },
    resultDescription: {
        fontSize: 16,
        textAlign: 'center',
        marginTop: 16,
        lineHeight: 22
    }
});

export default QuestionnaireScreen;
