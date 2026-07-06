import React from 'react';
import { StyleSheet, ScrollView, Platform } from 'react-native';
import { List } from 'react-native-nice-ui';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/src/theme';
import { useDisplayMode, DisplayMode } from '@/src/context/DisplayModeProvider';
import { ScreenHeader } from "@/src/components/ui/ScreenHeader";
import { ScrollViewContent } from '@/src/components/ui/ScrollViewContent';

const MODE_KEYS = ['minimal', 'comfort', 'clinical'] as const;

export default function DisplayModeScreen() {
    const { colors } = useAppTheme();
    const { mode, defaultMode, setMode } = useDisplayMode();
    const { t } = useTranslation();

    const handleModeChange = async (newMode: DisplayMode | 'default') => {
        await setMode(newMode);
    };

    return (
        <ScrollView
            style={ { backgroundColor: colors.modalBackground } }
            contentContainerStyle={ styles.scrollView }
            contentInsetAdjustmentBehavior="automatic"
        >
            <ScrollViewContent>
                <ScreenHeader
                    icon="info.circle.text.page"
                    iconTintColor={ colors.brandColorMuted }
                    subtitle={ t('displayModes.headerText') }
                />

                {/* Mode Selection */ }
                <List.Section rounded>
                    { MODE_KEYS.map((modeKey, index) => {
                        const isSelected = mode === modeKey;
                        const isDefault = defaultMode === modeKey;

                        return (
                            <List.Item
                                key={ modeKey }
                                title={ t(`displayModes.${ modeKey }`) + (isDefault ? ` (${ t('common.default') })` : '') }
                                subtitle={ t(`displayModes.${ modeKey }Desc`) }
                                subtitleNumberOfLines={ 3 }
                                type="checkbox"
                                checked={ isSelected }
                                hideChevron
                                onPress={ () => handleModeChange(modeKey) }
                            />
                        );
                    }) }
                </List.Section>

            </ScrollViewContent>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        paddingBottom: Platform.OS === 'ios' ? 80 : 90
    }
});
