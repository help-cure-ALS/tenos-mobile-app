import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { useAppTheme } from '@/src/theme';
import { useTranslation } from 'react-i18next';

import { CardContainer, CardHeader, CardFooter } from './card';
import { useTDEE, ALSFRS6_MAX_SCORE } from '@/src/metrics';
import { useDisplayMode } from "@/src/context/DisplayModeProvider";

export type TDEECardProps = {
    /** Called when the card is pressed */
    onPress?: () => void;
    /** Called when the card is long-pressed */
    onLongPress?: () => void;
    /** Called when missing patient data link is pressed */
    onMissingDataPress?: () => void;
    /** Called when missing ALSFRS link is pressed */
    onMissingALSFRSPress?: () => void;
};

export function TDEECard({
                             onPress,
                             onLongPress,
                             onMissingDataPress,
                             onMissingALSFRSPress
                         }: TDEECardProps) {
    const { t, i18n } = useTranslation();
    const { colors, tokens } = useAppTheme();
    const {
        calories,
        alsfrs6,
        missingPatientData,
        missingFields,
        missingALSFRS,
        isLoading
    } = useTDEE();
    const { preferences } = useDisplayMode();

    const showInfoAlert = () => {
        Alert.alert(
            t('tdee.alertTitle'),
            t('tdee.alertMessage'),
            [{ text: t('common.ok') }]
        );
    };

    // Missing patient data state
    if (missingPatientData && !isLoading) {
        return (
            <CardContainer onPress={ onMissingDataPress } onLongPress={ onLongPress } padding={ 13 }>
                <CardHeader
                    icon="flame.fill"
                    iconColor="#FF9500"
                    title={t('tdee.title')}
                    showChevron={ !!onMissingDataPress }
                />

                <View style={ styles.content }>
                    <Text style={ [styles.missingHint, { color: colors.textHint }] }>
                        {t('tdee.completeData')}{ ' ' }
                        { missingFields.join(', ') }
                    </Text>
                </View>

                { onMissingDataPress && (
                    <CardFooter>
                        <Pressable onPress={ onMissingDataPress }>
                            <Text style={ { color: colors.tint, fontSize: 13 } }>
                                {t('tdee.addHealthData')}
                            </Text>
                        </Pressable>
                    </CardFooter>
                ) }
            </CardContainer>
        );
    }

    // Missing ALSFRS-R data state (but patient data exists)
    if (missingALSFRS && !isLoading && !missingPatientData) {
        return (
            <CardContainer onPress={ onMissingALSFRSPress ?? onPress } onLongPress={ onLongPress } padding={ 13 }>
                <CardHeader
                    icon="flame.fill"
                    iconColor="#FF9500"
                    title={t('tdee.title')}
                    showChevron={ !!(onMissingALSFRSPress ?? onPress) }
                />

                <View style={ styles.content }>
                    { calories !== undefined ? (
                        // Show calculated value with estimate note
                        <>
                            <View style={ styles.valueRow }>
                                <Text style={ [styles.valueText, { color: colors.text }] }>
                                    ~{ calories.toLocaleString(i18n.language) }
                                </Text>
                                <Text style={ [styles.unitText, { color: colors.textSecondary }] }>
                                    {t('tdee.unit')}
                                </Text>
                            </View>
                            <Text style={ [styles.noteText, { color: colors.textHint }] }>
                                {t('tdee.estimatedWithoutAlsfrs')}
                            </Text>
                        </>
                    ) : (
                        <View style={ styles.missingContainer }>
                            <AppIcon
                                name="questionmark.circle.fill"
                                tintColor={ colors.textHint }
                                size={ 24 }
                            />
                            <Text style={ [styles.missingText, { color: colors.textSecondary }] }>
                                {t('tdee.fillAlsfrs')}
                            </Text>
                        </View>
                    ) }
                </View>

                { preferences.showTrends && onMissingALSFRSPress && (
                    <CardFooter>
                        <Pressable onPress={ onMissingALSFRSPress }>
                            <Text style={ { color: colors.tint, fontSize: 12 } }>
                                {t('tdee.fillAlsfrsQuestionnaire')}
                            </Text>
                        </Pressable>
                    </CardFooter>
                ) }
                <Pressable onPress={ showInfoAlert } hitSlop={ 12 } style={ styles.infoButton }>
                    <AppIcon
                        name="info.circle.fill"
                        tintColor={ colors.textHint }
                        size={ 20 }
                    />
                </Pressable>
            </CardContainer>
        );
    }

    // Normal state with full data
    return (
        <CardContainer onPress={ onPress } onLongPress={ onLongPress } padding={ 13 }>
            <CardHeader
                icon="flame.fill"
                iconColor="#FF9500"
                title={t('tdee.title')}
                showChevron={ !!onPress }
            />

            <View style={ styles.content }>
                { isLoading ? (
                    <Text style={ [styles.loadingText, { color: colors.textHint }] }>
                        {t('tdee.calculating')}
                    </Text>
                ) : calories !== undefined ? (
                    <>
                        <View style={ styles.valueRow }>
                            <Text style={ [styles.valueText, { color: colors.text }] }>
                                ~{ calories.toLocaleString(i18n.language) }
                            </Text>
                            <Text style={ [styles.unitText, { color: colors.textSecondary }] }>
                                {t('tdee.unit')}
                            </Text>
                        </View>
                    </>
                ) : (
                    <Text style={ [styles.errorText, { color: colors.textHint }] }>
                        {t('tdee.calculationNotPossible')}
                    </Text>
                ) }
            </View>
            { preferences.showTrends && alsfrs6 && (
                <CardFooter
                    text={t('tdee.basedOnAlsfrs', { score: alsfrs6.score, max: ALSFRS6_MAX_SCORE })}
                />
            ) }
            <Pressable onPress={ showInfoAlert } hitSlop={ 12 } style={ styles.infoButton }>
                <AppIcon
                    name="info.circle.fill"
                    tintColor={ colors.textHint }
                    size={ 20 }
                />
            </Pressable>
        </CardContainer>
    );
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        justifyContent: 'flex-end',
        minHeight: 40
    },
    infoButton: {
        position: 'absolute',
        right: 10,
        bottom: 13
    },
    valueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6
    },
    valueText: {
        fontSize: 28,
        fontWeight: '700'
    },
    unitText: {
        fontSize: 16,
        fontWeight: '500'
    },
    alsfrs6Text: {
        fontSize: 13,
        marginTop: 4
    },
    noteText: {
        fontSize: 12,
        marginTop: 2
    },
    loadingText: {
        fontSize: 16
    },
    errorText: {
        fontSize: 16
    },
    missingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8
    },
    missingText: {
        fontSize: 16,
        fontWeight: '500'
    },
    missingHint: {
        fontSize: 13,
        lineHeight: 18
    }
});
