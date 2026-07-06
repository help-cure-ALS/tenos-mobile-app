import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, Path, Polygon, Rect } from 'react-native-svg';

import type { OpmMotorNeuronCode, OpmOnsetCode } from '../types';

type OnsetFigureProps = {
    code: OpmOnsetCode;
    size?: number;
    selected?: boolean;
};

type PropagationFigureProps = {
    variant: 'same' | 'vertical' | 'unknown';
    size?: number;
    selected?: boolean;
};

type MotorNeuronFigureProps = {
    code: OpmMotorNeuronCode;
    size?: number;
};

const RED = '#D91E36';
const GREEN = '#78A84A';
const BLUE_DARK = '#145C9E';
const BLUE_LIGHT = '#4D96CB';
const BODY = '#D8DADF';
const BODY_BORDER = '#BFC2CA';
const BODY_PATH = 'M28.5,1 C34.5751322,1 39.5,5.92486775 39.5,12 C39.5,16.2744289 37.0619686,19.9794251 33.5006412,21.800253 L33.5,27.5 L48,27.5 C50.8002625,27.5 52.2003938,27.5 53.2699525,28.0449674 C54.945218,28.8985578 56,30.6198055 56,32.5 C56,34.3801945 54.945218,36.1014422 53.2699525,36.9550326 C52.2003938,37.5 50.8002625,37.5 48,37.5 L33.5,37.5 L33.5,68 L48,68 C50.8002625,68 52.2003938,68 53.2699525,68.5449674 C54.945218,69.3985578 56,71.1198055 56,73 C56,74.8801945 54.945218,76.6014422 53.2699525,77.4550326 C52.2003938,78 50.8002625,78 48,78 L9,78 C6.19973747,78 4.7996062,78 3.7300475,77.4550326 C2.05478197,76.6014422 1,74.8801945 1,73 C1,71.1198055 2.05478197,69.3985578 3.7300475,68.5449674 C4.7996062,68 6.19973747,68 9,68 L23.5,68 L23.5,37.5 L9,37.5 C6.19973747,37.5 4.7996062,37.5 3.7300475,36.9550326 C2.05478197,36.1014422 1,34.3801945 1,32.5 C1,30.6198055 2.05478197,28.8985578 3.7300475,28.0449674 C4.7996062,27.5 6.19973747,27.5 9,27.5 L23.5,27.5 L23.5003548,21.8007622 C19.938486,19.9801159 17.5,16.2748274 17.5,12 C17.5,5.92486775 22.4248678,1 28.5,1 Z';

export function OnsetFigure({ code, size = 54, selected }: OnsetFigureProps) {
    const marker = onsetMarkers[code];
    return (
        <View style={[styles.figure, { width: size, height: size }, selected && styles.selectedFigure]}>
            <Svg width={size} height={size} viewBox="0 0 57 79">
                <PhenotypeBody />
                <OnsetMarker marker={marker} />
            </Svg>
        </View>
    );
}

export function PropagationFigure({ variant, size = 56, selected }: PropagationFigureProps) {
    return (
        <View style={[styles.figure, { width: size, height: size }, selected && styles.selectedFigure]}>
            <Svg width={size} height={size} viewBox="0 0 57 79">
                <PhenotypeBody />
                {variant === 'same' ? <HorizontalPropagationArrow /> : <VerticalPropagationArrow />}
                {variant === 'unknown' && <Circle cx={45} cy={17} r={7} fill={GREEN} opacity={0.72} />}
            </Svg>
        </View>
    );
}

export function MotorNeuronFigure({ code, size = 56 }: MotorNeuronFigureProps) {
    const palette = motorPalettes[code];
    const clipId = `opmBody${React.useId().replace(/:/g, '')}`;

    return (
        <View style={[styles.figure, { width: size, height: size }]}>
            <Svg width={size} height={size} viewBox="0 0 57 79">
                <Defs>
                    <ClipPath id={clipId}>
                        <Path d={BODY_PATH} fillRule="evenodd" />
                    </ClipPath>
                </Defs>
                <G clipPath={`url(#${clipId})`}>
                    <Rect x={0} y={0} width={57} height={79} fill={palette.body} />
                    <Rect x={0} y={0} width={57} height={24} fill={palette.head} />
                    <Rect x={0} y={68} width={57} height={11} fill={palette.legs} />
                    {palette.splitHead && <Rect x={28.5} y={0} width={28.5} height={24} fill={palette.splitHead} />}
                    {palette.splitBody && <Rect x={28.5} y={24} width={28.5} height={44} fill={palette.splitBody} />}
                </G>
                <Path d={BODY_PATH} fill="none" fillRule="evenodd" stroke="#EEF3F6" strokeWidth={1} />
            </Svg>
        </View>
    );
}

type OnsetMarkerSpec =
    | { kind: 'circle'; cx: number; cy: number; r: number }
    | { kind: 'rect'; x: number; y: number; width: number; height: number; rx: number };

function PhenotypeBody() {
    return (
        <Path
            d={BODY_PATH}
            fill={BODY}
            fillRule="evenodd"
            stroke={BODY_BORDER}
            strokeWidth={1}
        />
    );
}

function OnsetMarker({ marker }: { marker: OnsetMarkerSpec }) {
    if (marker.kind === 'circle') {
        return <Circle cx={marker.cx} cy={marker.cy} r={marker.r} fill={RED} />;
    }

    return <Rect x={marker.x} y={marker.y} width={marker.width} height={marker.height} rx={marker.rx} fill={RED} />;
}

function HorizontalPropagationArrow() {
    return (
        <>
            <Line x1={14} y1={32.5} x2={43} y2={32.5} stroke={GREEN} strokeWidth={3} strokeLinecap="round" />
            <Polygon points="14,32.5 20,28.5 20,36.5" fill={GREEN} />
            <Polygon points="43,32.5 37,28.5 37,36.5" fill={GREEN} />
        </>
    );
}

function VerticalPropagationArrow() {
    return (
        <>
            <Line x1={28.5} y1={18} x2={28.5} y2={66} stroke={GREEN} strokeWidth={3} strokeLinecap="round" />
            <Polygon points="28.5,18 24.5,25 32.5,25" fill={GREEN} />
            <Polygon points="28.5,66 24.5,59 32.5,59" fill={GREEN} />
        </>
    );
}

const onsetMarkers: Record<OpmOnsetCode, OnsetMarkerSpec> = {
    O1: { kind: 'circle', cx: 28.5, cy: 12, r: 4 },
    O2d: { kind: 'circle', cx: 7.5, cy: 32.5, r: 4 },
    O2p: { kind: 'circle', cx: 23, cy: 32.5, r: 4 },
    O2x: { kind: 'rect', x: 7, y: 29, width: 30, height: 7, rx: 3.5 },
    O3r: { kind: 'rect', x: 25, y: 25, width: 7, height: 30, rx: 3.5 },
    O3a: { kind: 'rect', x: 25, y: 38, width: 7, height: 28, rx: 3.5 },
    O4d: { kind: 'circle', cx: 7.5, cy: 72.5, r: 4 },
    O4p: { kind: 'circle', cx: 23, cy: 72.5, r: 4 },
    O4x: { kind: 'rect', x: 8, y: 69, width: 39, height: 7, rx: 3.5 },
};

const motorPalettes: Record<OpmMotorNeuronCode, { head: string; body: string; legs: string; splitHead?: string; splitBody?: string }> = {
    M0: { head: BLUE_LIGHT, body: BLUE_DARK, legs: BLUE_LIGHT, splitHead: BLUE_DARK },
    M1d: { head: BLUE_LIGHT, body: BLUE_LIGHT, legs: BLUE_LIGHT, splitHead: BLUE_DARK },
    M1p: { head: BLUE_LIGHT, body: BLUE_LIGHT, legs: BLUE_LIGHT },
    M2d: { head: BLUE_DARK, body: BLUE_DARK, legs: BLUE_DARK, splitHead: BLUE_LIGHT },
    M2p: { head: BLUE_DARK, body: BLUE_DARK, legs: BLUE_DARK },
    M3: { head: BLUE_LIGHT, body: BLUE_DARK, legs: BLUE_LIGHT, splitHead: BLUE_DARK, splitBody: BLUE_LIGHT },
};

const styles = StyleSheet.create({
    figure: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'visible',
    },
    selectedFigure: {
        opacity: 1,
    },
});
