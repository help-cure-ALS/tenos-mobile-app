import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { iconPaths } from './icon-registry';

export interface AppIconProps {
    /** SF Symbol name — looked up in the SVG icon registry */
    name: string;
    /** Icon size in dp (default: 24) */
    size?: number;
    /** Icon color (default: '#000000') */
    tintColor?: string;
    /** Optional style applied to the Svg root */
    style?: StyleProp<ViewStyle>;
}

export function AppIcon({ name, size = 24, tintColor = '#000000', style }: AppIconProps) {
    const pathData = iconPaths[name];

    if (!pathData) {
        if (__DEV__) {
            console.warn(`AppIcon: Unknown icon "${name}". Add it to hca-icons-app/ and regenerate icon-registry.ts.`);
        }
        return null;
    }

    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
            <Path d={pathData} fill={typeof tintColor === 'string' ? tintColor : '#000000'} />
        </Svg>
    );
}
