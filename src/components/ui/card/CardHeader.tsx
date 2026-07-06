import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/src/components/ui/AppIcon';
import { useTheme } from 'react-native-nice-ui';

export type CardHeaderProps = {
    /** Card title */
    title: string;
    /** SF Symbol icon name */
    icon?: string;
    /** Icon tint color (defaults to theme tint) */
    iconColor?: string;
    /** Custom right content (overrides date/showChevron) */
    rightContent?: React.ReactNode;
    /** Show date text on the right */
    date?: string;
    /** Show chevron on the right */
    showChevron?: boolean;
    /** Size of the icon (default: 14) */
    iconSize?: number;
    /** Size of the icon container (default: 22) */
    iconContainerSize?: number;
};

export function CardHeader({
    title,
    icon,
    iconColor,
    rightContent,
    date,
    showChevron,
    iconSize = 16,
    iconContainerSize = 26,
}: CardHeaderProps) {
    const { colors, tokens } = useTheme();

    const tintColor = iconColor ?? colors.tint;

    const renderRightContent = () => {
        if (rightContent) {
            return rightContent;
        }

        if (date || showChevron) {
            return (
                <View style={styles.rightContainer}>
                    {date && (
                        <Text style={[styles.date, { color: colors.textHint }]}>
                            {date}
                        </Text>
                    )}
                    {showChevron && (
                        <AppIcon
                            name="chevron.right"
                            tintColor={colors.textHint}
                            size={14}
                        />
                    )}
                </View>
            );
        }

        return null;
    };

    return (
        <View style={styles.header}>
            <View style={styles.headerLeft}>
                {icon && (
                    <View
                        style={[
                            styles.iconContainer,
                            {
                                backgroundColor: tintColor + '20',
                                borderRadius: 8,
                                width: iconContainerSize,
                                height: iconContainerSize,
                            }
                        ]}
                    >
                        <AppIcon
                            name={icon}
                            tintColor={tintColor}
                            size={iconSize}
                        />
                    </View>
                )}
                <Text
                    numberOfLines={2}
                    style={[styles.title, { color: colors.textPrimary }]}
                >
                    {title}
                </Text>
            </View>
            {renderRightContent()}
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
    },
    headerLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingRight: 10,
        overflow: 'hidden',
    },
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 13.8,
        fontWeight: '700',
        letterSpacing: -0.4,
        flex: 1,
    },
    rightContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    date: {
        fontSize: 12,
    },
});
