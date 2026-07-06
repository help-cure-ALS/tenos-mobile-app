import React from 'react';
import { ImageBackground, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { List, Space } from 'react-native-nice-ui';
import { useAppTheme } from '@/src/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/src/components/ui/ScreenHeader';
import { ListItemIcon } from '@/src/components/ui/ListItemIcon';
import { useSafeRouter } from '@/src/hooks/useSafeRouter';

export default function ExportScreen() {
    const { t } = useTranslation();
    const { colors, isDark } = useAppTheme();
    const insets = useSafeAreaInsets();
    const router = useSafeRouter();

    return (
        <View style={ [styles.container] }>
            <Stack.Screen
                options={ {
                    headerTitle: t('share.exportData')
                } }
            />
            <ImageBackground source={ !isDark && require('@/assets/images/bg/gradient-2.png') }
                             style={ [styles.image, { backgroundColor: colors.background }] }>
                <ScrollView
                    contentContainerStyle={ [styles.scrollView, { paddingBottom: insets.bottom + 20 }] }
                    contentInsetAdjustmentBehavior="automatic"
                >
                    <View style={ [styles.bodyWrapper,
                        {
                            // We add the insets to the padding so that the content
                            // doesn't disappear under the sidebar.
                            paddingLeft: insets.left,
                            paddingRight: insets.right
                        },
                        insets.left > 200 && { maxWidth: 940 + insets.left }
                    ] }>
                    <ScreenHeader
                        icon="square.and.arrow.up"
                        subtitle={ t('share.exportDescription') }
                    />

                    <Space size="sm" />

                    <List.Section rounded>
                        <List.Item
                            title={ t('share.exportPdf') }
                            leftCmpSize={ 32 }
                            leftCmp={ <ListItemIcon name="doc.text.fill" color={ colors.textPrimary }
                                                    backgroundColor={ colors.listItemBackgroundMuted } /> }
                            subtitle={ t('share.exportPdfSubtitle') }
                            onPress={ () => router.push('/(tabs)/share/exportPdf') }
                        />
                        <List.Item
                            title={ t('share.exportFhir') }
                            subtitle={ t('share.exportFhirSubtitle') }
                            leftCmpSize={ 32 }
                            leftCmp={ <ListItemIcon name="cross.case.fill" color={ colors.textPrimary }
                                                    backgroundColor={ colors.listItemBackgroundMuted } /> }
                            onPress={ () => router.push('/(tabs)/share/exportFhir') }
                            lastItem
                        />
                    </List.Section>
                    </View>
                </ScrollView>
            </ImageBackground>
        </View>
    );
}

const styles = StyleSheet.create({
    image: {
        flex: 1
    },
    container: {
        flex: 1
    },
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    },
    bodyWrapper: {
        paddingTop: 20,
        flex: 1,
        maxWidth: 940,
        marginHorizontal: 'auto',
        width: '100%'
    },
});
