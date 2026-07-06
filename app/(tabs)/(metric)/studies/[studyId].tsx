import React, { useState, useCallback } from 'react';
import {
    ActivityIndicator,
    Linking,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    View
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Badge, List, Text, Button, Space } from 'react-native-nice-ui';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { useTranslation } from 'react-i18next';
import {
    useStudies,
    getPhaseLabel,
    getStudyTypeLabel,
    StudyStatusBadge
} from '@/src/studies';
import { useStudyFavorites } from '@/src/hooks/useStudyFavorites';
import { getCountryByCode } from '@/src/components/ui/CountryPicker';
import { useAppTheme } from "@/src/theme";
import { HeaderButton } from "@/src/components/ui/navigation/HeaderButton";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@/src/theme/tokens";

export default function StudyDetailScreen() {
    const { colors } = useAppTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { studyId } = useLocalSearchParams<{ studyId: string }>();

    const { getStudyById, loading, refreshing, refetch, openClinicStudyIds, allClinicStudies } = useStudies();
    const study = getStudyById(studyId);
    const { isFavorite, toggleFavorite } = useStudyFavorites();

    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        about: true,
        eligibility: false,
        centers: false,
        contact: false
    });

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const handleApply = useCallback(() => {
        if (study?.contactEmail) {
            Linking.openURL(`mailto:${study.contactEmail}?subject=${t('studies.emailSubject', { title: study.shortTitle || study.title })}`);
        }
    }, [study, t]);

    const handleContact = useCallback((email?: string) => {
        if (email) {
            Linking.openURL(`mailto:${ email }?subject=${ t('studies.emailSubject', { title: study?.shortTitle || study?.title }) }`);
        }
    }, [study]);

    const handleExternalLink = useCallback(() => {
        if (study?.externalUrl) {
            Linking.openURL(study.externalUrl);
        } else if (study?.nctId) {
            Linking.openURL(`https://clinicaltrials.gov/study/${ study.nctId }`);
        }
    }, [study]);

    if (loading) {
        return (
            <View style={ [styles.container, { backgroundColor: colors.background }] }>
                <Stack.Screen options={ { title: '' } } />
                <View style={ styles.errorState }>
                    <ActivityIndicator size="small" color={ colors.textSecondary } />
                </View>
            </View>
        );
    }

    if (!study) {
        return (
            <View style={ [styles.container, { backgroundColor: colors.background }] }>
                <Stack.Screen options={ { title: t('studies.studyNotFound') } } />
                <View style={ styles.errorState }>
                    <AppIcon name="exclamationmark.triangle" tintColor={ colors.textHint } size={ 48 } />
                    <Text style={ [styles.errorText, { color: colors.textSecondary }] }>
                        { t('studies.studyNotFoundText') }
                    </Text>
                </View>
            </View>
        );
    }

    const isOpenForApplications = openClinicStudyIds.has(studyId) || allClinicStudies.some(c => c.openStudyIds.has(studyId));
    const canApply = isOpenForApplications && !!study.contactEmail;

    const inclusionCriteria = study.eligibility.filter(c => c.type === 'inclusion');
    const exclusionCriteria = study.eligibility.filter(c => c.type === 'exclusion');

    return (
        <>
            {
                Platform.OS === 'android' ? (
                    <Stack.Screen
                        options={ {
                            headerTitle: study.shortTitle || study.title,
                            headerRight: () => (
                                <HeaderButton
                                    title={t('shared.save')}
                                    onPress={() => toggleFavorite(studyId)}
                                    icon={isFavorite(studyId) ? 'bookmark.fill' : 'bookmark'}
                                    tintColor={isFavorite(studyId) ? colors.textPrimary : colors.textHint}
                                    variant="plain"
                                />
                            )
                        } }
                    />
                ) : (
                    <>
                        <Stack.Screen.Title>{ study.shortTitle || study.title }</Stack.Screen.Title>
                        <Stack.Toolbar placement="right">
                            <Stack.Toolbar.Button icon={isFavorite(studyId) ? 'bookmark.fill' : 'bookmark'} variant="plain" tintColor={isFavorite(studyId) ? colors.textPrimary : colors.textHint} onPress={() => toggleFavorite(studyId)} />
                        </Stack.Toolbar>
                    </>
                )
            }

            <ScrollView
                style={ { backgroundColor: colors.background } }
                contentContainerStyle={ styles.scrollView }
                contentInsetAdjustmentBehavior="automatic"
                refreshControl={
                    <RefreshControl
                        refreshing={ refreshing }
                        onRefresh={ refetch }
                        tintColor={ colors.tint }
                    />
                }
            >

                {/* Header Card */ }
                <View style={ [styles.headerCard, { backgroundColor: colors.listItemBackground }] }>
                    <View style={ [styles.headerCardWrapper,
                        {
                            // We add the insets to the padding so that the content
                            // doesn't disappear under the sidebar.
                            paddingLeft: insets.left + tokens.listSectionPaddingHorizontal,
                            paddingRight: insets.right + tokens.listSectionPaddingHorizontal
                        },
                        insets.left > 200 && { maxWidth: 940 + insets.left }
                    ] }>
                        {/* The official long title (resource.title) exists in
                            English only — the sync translates just the short
                            title. For translated studies we therefore show
                            the localized short title instead. */ }
                        <Text variant="titleLarge">
                            { study.isTranslated && study.shortTitle ? study.shortTitle : study.title }
                        </Text>
                        <Text variant="bodySmall" color="secondary">
                            { study.sponsor.name }
                        </Text>

                        <View style={ styles.metaRow }>
                            <StudyStatusBadge
                                status={ study.status }
                                size="medium"
                            />
                            { study.phase && (
                                <Badge label={ getPhaseLabel(study.phase) } />
                            ) }

                            <Badge label={ getStudyTypeLabel(study.type) } />
                        </View>

                        <Space />
                        <Text variant="titleMedium">
                            { t('studies.aboutStudy') }
                        </Text>
                        <Text variant="bodyMedium">
                            { study.description }
                        </Text>

                        {/* Study details */ }
                        <View style={ styles.detailsGrid }>
                            { study.durationMonths && (
                                <DetailItem
                                    label={ t('studies.duration') }
                                    value={ t('studies.durationMonths', { count: study.durationMonths }) }
                                    colors={ colors }
                                />
                            ) }
                            { study.targetParticipants && (
                                <DetailItem
                                    label={ t('studies.participants') }
                                    value={ `${ study.currentParticipants || 0 } / ${ study.targetParticipants }` }
                                    colors={ colors }
                                />
                            ) }
                            { study.nctId && (
                                <DetailItem
                                    label="ClinicalTrials.gov"
                                    value={ study.nctId }
                                    colors={ colors }
                                />
                            ) }
                        </View>
                    </View>
                </View>

                <View style={ [styles.bodyWrapper,
                    {
                        // We add the insets to the padding so that the content
                        // doesn't disappear under the sidebar.
                        paddingLeft: insets.left,
                        paddingRight: insets.right
                    },
                    insets.left > 200 && { maxWidth: 940 + insets.left }
                ] }>
                    <List.Wrapper>

                        {/* Collapsible Sections */ }
                        <View style={ styles.sections }>
                            {/* Eligibility Section */ }
                            <CollapsibleSection
                                title={ t('studies.eligibilityCriteria') }
                                isExpanded={ expandedSections.eligibility }
                                onToggle={ () => toggleSection('eligibility') }
                                colors={ colors }
                            >
                                {/* Translated eligibility is a flat string
                                    (ext/eligibility-{lang}); the structured
                                    inclusion/exclusion lists exist only for
                                    the English base text. */ }
                                { study.eligibilityText && (
                                    <Text style={ [styles.criterionText, { color: colors.textSecondary }] }>
                                        { study.eligibilityText }
                                    </Text>
                                ) }

                                { !study.eligibilityText && inclusionCriteria.length > 0 && (
                                    <View style={ styles.criteriaSection }>
                                        <Text style={ [styles.criteriaTitle, { color: '#34C759' }] }>
                                            { t('studies.inclusionCriteria') }
                                        </Text>
                                        { inclusionCriteria.map((criterion, index) => (
                                            <View key={ index } style={ styles.criterionRow }>
                                                <AppIcon name="checkmark.circle.fill" tintColor="#34C759"
                                                            size={ 16 } />
                                                <Text style={ [styles.criterionText, { color: colors.textSecondary }] }>
                                                    { criterion.description }
                                                </Text>
                                            </View>
                                        )) }
                                    </View>
                                ) }

                                { !study.eligibilityText && exclusionCriteria.length > 0 && (
                                    <View style={ styles.criteriaSection }>
                                        <Text style={ [styles.criteriaTitle, { color: '#FF3B30' }] }>
                                            { t('studies.exclusionCriteria') }
                                        </Text>
                                        { exclusionCriteria.map((criterion, index) => (
                                            <View key={ index } style={ styles.criterionRow }>
                                                <AppIcon name="xmark.circle.fill" tintColor="#FF3B30" size={ 16 } />
                                                <Text style={ [styles.criterionText, { color: colors.textSecondary }] }>
                                                    { criterion.description }
                                                </Text>
                                            </View>
                                        )) }
                                    </View>
                                ) }
                            </CollapsibleSection>

                            {/* Centers Section */ }
                            <CollapsibleSection
                                title={ t('studies.studyCenters', { count: study.centers.length }) }
                                isExpanded={ expandedSections.centers }
                                onToggle={ () => toggleSection('centers') }
                                colors={ colors }
                            >
                                { study.centers.map((center, index) => (
                                    <View
                                        key={ center.id }
                                        style={ [
                                            styles.centerItem,
                                            index < study.centers.length - 1 && {
                                                borderBottomWidth: StyleSheet.hairlineWidth,
                                                borderBottomColor: colors.border
                                            }
                                        ] }
                                    >
                                        <AppIcon name="building.2" tintColor={ colors.textHint } size={ 20 } />
                                        <View style={ styles.centerInfo }>
                                            <Text style={ [styles.centerName, { color: colors.textPrimary }] }>
                                                { center.name }
                                            </Text>
                                            <Text style={ [styles.centerLocation, { color: colors.textSecondary }] }>
                                                {/* country is an ISO code since the sync
                                                    normalizes it — resolve to the localized
                                                    name, fall back to the raw value. */ }
                                                { [center.city, getCountryByCode(center.country)?.name ?? center.country]
                                                    .filter(Boolean).join(', ') }
                                            </Text>
                                        </View>
                                    </View>
                                )) }
                            </CollapsibleSection>

                            {/* Contact Section */ }
                            { (study.contactEmail || study.externalUrl || study.nctId) && (
                                <CollapsibleSection
                                    title={ t('studies.contactAndLinks') }
                                    isExpanded={ expandedSections.contact }
                                    onToggle={ () => toggleSection('contact') }
                                    colors={ colors }
                                >
                                    { study.contactEmail && (
                                        <Pressable
                                            style={ [styles.linkButton, { backgroundColor: `${ colors.tint }10` }] }
                                            onPress={ () => handleContact(study.contactEmail) }
                                        >
                                            <AppIcon name="envelope.fill" tintColor={ colors.tint } size={ 20 } />
                                            <Text style={ [styles.linkText, { color: colors.tint }] }>
                                                { study.contactEmail }
                                            </Text>
                                        </Pressable>
                                    ) }
                                    { (study.externalUrl || study.nctId) && (
                                        <Pressable
                                            style={ [styles.linkButton, { backgroundColor: `${ colors.tint }10` }] }
                                            onPress={ handleExternalLink }
                                        >
                                            <AppIcon name="link" tintColor={ colors.tint } size={ 20 } />
                                            <Text style={ [styles.linkText, { color: colors.tint }] }>
                                                { t('studies.moreInformation') }
                                            </Text>
                                        </Pressable>
                                    ) }
                                </CollapsibleSection>
                            ) }
                        </View>

                        {/* Bottom Action Button */ }
                        { canApply && (
                            <View style={ styles.bottomAction }>
                                <Button onPress={ handleApply } fullWidth rounded>
                                    { t('studies.applyForStudy') }
                                </Button>
                            </View>
                        ) }

                        {/* AI-translation disclaimer — only when translated
                            content is actually shown (non-English language
                            with at least one translated field). */ }
                        { study.isTranslated && (
                            <View style={ styles.translationNotice }>
                                <Text style={ [styles.translationNoticeText, { color: colors.textSecondary }] }>
                                    { t('studies.aiTranslationNotice') }
                                </Text>
                            </View>
                        ) }
                    </List.Wrapper>
                </View>
            </ScrollView>
        </>
    );
}

// Collapsible Section Component
function CollapsibleSection({
                                title,
                                isExpanded,
                                onToggle,
                                children,
                                colors
                            }: {
    title: string;
    isExpanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
    colors: any;
}) {
    return (
        <View style={ [styles.section, { backgroundColor: colors.listItemBackground }] }>
            <Pressable style={ styles.sectionHeader } onPress={ onToggle }>
                <Text variant="titleMedium" style={ { flex: 1 } }>
                    { title }
                </Text>
                <AppIcon
                    name={ isExpanded ? 'chevron.up' : 'chevron.down' }
                    tintColor={ colors.textHint }
                    size={ 16 }
                />
            </Pressable>
            { isExpanded && <View style={ styles.sectionContent }>{ children }</View> }
        </View>
    );
}

// Detail Item Component
function DetailItem({
                        label,
                        value,
                        colors
                    }: {
    label: string;
    value: string;
    colors: any;
}) {
    return (
        <View style={ [styles.detailItem, { backgroundColor: `${ colors.brandColorMuted }30` }] }>
            <Text style={ [styles.detailLabel, { color: colors.brandColorMuted }] }>{ label }</Text>
            <Text style={ [styles.detailValue, { color: colors.textPrimary }] }>{ value }</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    bodyWrapper: {
        flex: 1,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    },
    container: {
        flex: 1
    },
    errorState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16
    },
    errorText: {
        fontSize: 16,
        textAlign: 'center'
    },
    headerCard: {
        paddingVertical: 24,
        marginBottom: 16,
        alignItems: 'center'
    },
    headerCardWrapper: {
        maxWidth: 940,
        gap: 8
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8
    },
    sections: {
        gap: 12
    },
    section: {
        borderRadius: 16,
        overflow: 'hidden'
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 10
    },
    sectionContent: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 12
    },
    detailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12
    },
    detailItem: {
        flex: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 8,
        flexDirection: 'column',
        alignItems: 'flex-start'
    },
    detailLabel: {
        fontSize: 11,
        textTransform: 'uppercase',
        fontWeight: '500'
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '500'
    },
    criteriaSection: {
        gap: 8
    },
    criteriaTitle: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 4
    },
    criterionRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8
    },
    criterionText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 19
    },
    centerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12
    },
    centerInfo: {
        flex: 1,
        gap: 2
    },
    centerName: {
        fontSize: 14,
        fontWeight: '500'
    },
    centerLocation: {
        fontSize: 13
    },
    linkButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 14,
        borderRadius: 12
    },
    linkText: {
        fontSize: 15,
        fontWeight: '500'
    },
    bottomAction: {
        marginTop: 24
    },
    translationNotice: {
        marginTop: 24,
        paddingHorizontal: 16
    },
    translationNoticeText: {
        fontSize: 12,
        lineHeight: 16,
        textAlign: 'center'
    }
});
