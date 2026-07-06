import React from 'react';
import { View, StyleSheet, ScrollView, Platform } from 'react-native';
import { List } from 'react-native-nice-ui';
import { useTranslation } from 'react-i18next';
import { AppColors, DeviceTheme, useAppTheme } from '@/src/theme';

export default function Appearance() {
    const { colors, setDeviceTheme, deviceTheme } = useAppTheme();
    const { t } = useTranslation();
    const styles = createStyles(colors);

    const availableAppearances: DeviceTheme[] = ['automatic', 'dark', 'light'];

    return (
        <>
            <ScrollView style={{ backgroundColor: colors.modalBackground }}
                        contentContainerStyle={[styles.scrollView, {}]}
                        contentInsetAdjustmentBehavior="automatic"
            >
                <View style={[styles.scrollViewWrapper]}>
                    <List.Section rounded={true}>
                        {
                            availableAppearances.map((item, index) => <List.Item
                                key={index}
                                title={t(`appearance.${item}`)}
                                lastItem={availableAppearances.length === index + 1}
                                type={'checkbox'}
                                checked={item === deviceTheme}
                                hideChevron={true}
                                onPress={() => { void setDeviceTheme(item); }}
                            />)
                        }
                    </List.Section>
                </View>
            </ScrollView>
        </>
    );
}

const createStyles = (colors: AppColors) =>
    StyleSheet.create({
        scrollView: {
            paddingBottom: Platform.OS === 'ios' ? 80 : 90
        },
        scrollViewWrapper: {
            alignSelf: 'center',
            width: '100%',
            maxWidth: 664
        }
    });
