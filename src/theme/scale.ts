import { Dimensions } from 'react-native';

const BASE_WIDTH = 393; // iPhone 15 Pro design reference

const screenWidth = Dimensions.get('window').width;

type FontSizeOpts = {
    factor?: number; // 0 = no scaling, 0.5 = moderate (default), 1 = full linear
    min?: number;
    max?: number;
};

/**
 * Responsive font size scaled relative to screen width.
 *
 * Uses moderate scaling (like react-native-size-matters' moderateScale):
 * result = size + (scaledSize - size) * factor
 *
 * @example
 * dynamicFontSize(16)                        // moderate scaling (factor 0.5)
 * dynamicFontSize(36, { max: 55 })           // with upper bound
 * dynamicFontSize(14, { min: 12, max: 18 })  // clamped range
 * dynamicFontSize(24, { factor: 0.3 })       // gentler scaling
 */
export function dynamicFontSize(size: number, opts?: FontSizeOpts): number {
    const { factor = 0.5, min, max } = opts ?? {};
    const scaled = size * (screenWidth / BASE_WIDTH);
    let result = Math.round(size + (scaled - size) * factor);
    if (min !== undefined && result < min) result = min;
    if (max !== undefined && result > max) result = max;
    return result;
}
