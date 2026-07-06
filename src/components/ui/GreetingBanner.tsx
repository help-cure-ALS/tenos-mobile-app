/**
 * GreetingBanner - Time-of-day greeting with intelligent action system.
 *
 * Sequence:
 *   1. Greeting (first launch: welcome, otherwise time-based)
 *   2. If action: show after delay, then stop (stays visible)
 *   3. If no action: appreciation → thanks rotation (loops forever)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import LottieView from 'lottie-react-native';
import { useAppTheme, dynamicFontSize } from '@/src/theme';

// Placeholder – replace with your chosen animation file
const GREETING_ANIMATION = require('@/assets/animations/meditation.json');

type BannerItem = {
    text: string;
    onPress?: () => void;
};

export interface GreetingBannerProps {
    nickname?: string;
    textColor: string;
    /** Called when the banner is tapped and no action-specific handler is active. */
    onPress?: () => void;
    /** First launch: shows special welcome greeting instead of time-of-day */
    isFirstLaunch?: boolean;
    /** Prioritized action shown after the greeting — stays visible until tapped */
    action?: { text: string; onPress: () => void };
    /** One-shot hint shown as first item in the loop rotation (no tap handler) */
    hint?: string;
}

type TimePeriod = 'night' | 'morning' | 'afternoon' | 'evening';

function getTimePeriod(): TimePeriod {
    const hour = new Date().getHours();
    if (hour < 5) return 'night';
    if (hour < 11) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
}

/** Pick a random index, avoiding lastIndex if possible */
function randomIndex(length: number, lastIndex: number): number {
    if (length <= 1) return 0;
    let idx: number;
    do {
        idx = Math.floor(Math.random() * length);
    } while (idx === lastIndex);
    return idx;
}

const FIRST_LAUNCH_DELAY = 4000;
const INTRO_INTERVAL = 6000;
const LOOP_INTERVAL = 30000;
const FADE_DURATION = 800;

const LOOP_CATEGORIES = ['appreciation', 'thanks'] as const;

export function GreetingBanner({ nickname, textColor, onPress, isFirstLaunch, action, hint }: GreetingBannerProps) {
    const { t, i18n } = useTranslation();
    const { colors } = useAppTheme();
    const period = useMemo(() => getTimePeriod(), []);

    const greetingText = useMemo(() => {
        if (isFirstLaunch) {
            if (nickname) {
                return t('greeting.welcomeWithName', { name: nickname });
            }
            return t('greeting.welcome');
        }
        if (nickname) {
            return t(`greeting.${period}WithName`, { name: nickname });
        }
        return t(`greeting.${period}`);
    }, [isFirstLaunch, period, nickname, t]);

    // Load category pools
    const categories = useMemo(() => ({
        appreciation: t('greeting.appreciation', { returnObjects: true }) as string[],
        thanks: t('greeting.thanks', { returnObjects: true }) as string[],
    }), [t]);

    // Current display state
    const [currentItem, setCurrentItem] = useState<BannerItem>({ text: greetingText });
    const greetingShown = useRef(true);
    const loopCategoryRef = useRef(0);
    const lastPickRef = useRef<Record<string, number>>({ appreciation: -1, thanks: -1 });
    const transitionedRef = useRef(false);
    const shownActionTextRef = useRef<string | undefined>(undefined);
    const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hintRef = useRef(hint);
    hintRef.current = hint;

    // Sync greeting text when nickname loads asynchronously
    useEffect(() => {
        if (greetingShown.current) {
            setCurrentItem({ text: greetingText });
        }
    }, [greetingText]);

    const opacity = useSharedValue(1);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const getRandomFromCategory = useCallback((catKey: typeof LOOP_CATEGORIES[number]): BannerItem => {
        const pool = categories[catKey];
        const idx = randomIndex(pool.length, lastPickRef.current[catKey]);
        lastPickRef.current[catKey] = idx;
        return { text: pool[idx] };
    }, [categories]);

    const getLoopItem = useCallback((): BannerItem => {
        const catKey = LOOP_CATEGORIES[loopCategoryRef.current];
        loopCategoryRef.current = (loopCategoryRef.current + 1) % LOOP_CATEGORIES.length;
        return getRandomFromCategory(catKey);
    }, [getRandomFromCategory]);

    const fadeTo = useCallback((next: BannerItem) => {
        if (fadeTimeoutRef.current) {
            clearTimeout(fadeTimeoutRef.current);
        }
        opacity.value = withTiming(0, { duration: FADE_DURATION });
        fadeTimeoutRef.current = setTimeout(() => {
            fadeTimeoutRef.current = null;
            setCurrentItem(next);
            opacity.value = withTiming(1, { duration: FADE_DURATION });
        }, FADE_DURATION);
    }, [opacity]);

    // Initial transition: greeting → action or loop (runs once)
    useEffect(() => {
        if (transitionedRef.current) return;

        const delay = isFirstLaunch ? FIRST_LAUNCH_DELAY : INTRO_INTERVAL;

        const timeout = setTimeout(() => {
            transitionedRef.current = true;
            greetingShown.current = false;

            if (action) {
                shownActionTextRef.current = action.text;
                fadeTo({ text: action.text, onPress: action.onPress });
                return;
            }

            // No action → show hint first (if any), then start loop
            const currentHint = hintRef.current;
            if (currentHint) {
                fadeTo({ text: currentHint });
                intervalRef.current = setInterval(() => {
                    fadeTo(getLoopItem());
                }, LOOP_INTERVAL);
            } else {
                fadeTo(getLoopItem());
                intervalRef.current = setInterval(() => {
                    fadeTo(getLoopItem());
                }, LOOP_INTERVAL);
            }
        }, delay);

        return () => {
            clearTimeout(timeout);
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isFirstLaunch, action, fadeTo, getLoopItem]);

    // Re-translate current item when language changes
    const language = i18n.language;
    useEffect(() => {
        if (!transitionedRef.current) return; // greeting effect handles this
        if (action) {
            setCurrentItem({ text: action.text, onPress: action.onPress });
        } else {
            fadeTo(getLoopItem());
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [language]);

    // React to action changes after the initial transition (e.g. user completed an action)
    const actionText = action?.text;
    useEffect(() => {
        if (!transitionedRef.current) return;
        if (actionText === shownActionTextRef.current) return;

        shownActionTextRef.current = actionText;

        // Clear any running loop
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        if (action) {
            // New action → show it and stay
            fadeTo({ text: action.text, onPress: action.onPress });
        } else {
            // All actions done → show a thanks message first, then start loop
            fadeTo(getRandomFromCategory('thanks'));
            intervalRef.current = setInterval(() => {
                fadeTo(getLoopItem());
            }, LOOP_INTERVAL);
        }
    }, [actionText, action, fadeTo, getLoopItem, getRandomFromCategory]);

    const handlePress = useCallback(() => {
        if (currentItem?.onPress) {
            currentItem.onPress();
        } else {
            onPress?.();
        }
    }, [currentItem, onPress]);

    const isTappable = !!currentItem?.onPress;

    // For tappable items: first word in brand color, rest normal
    const renderText = () => {
        const text = currentItem?.text ?? '';
        if (!isTappable) return text;

        const spaceIdx = text.indexOf(' ');
        if (spaceIdx === -1) return <Text style={{ color: colors.brandColor }}>{text}</Text>;

        return (
            <>
                <Text style={{ color: colors.brandColor }}>{text.slice(0, spaceIdx)}</Text>
                {text.slice(spaceIdx)}
            </>
        );
    };

    return (
        <Pressable style={styles.container} onPress={handlePress}>
            <LottieView
                source={GREETING_ANIMATION}
                autoPlay
                loop
                style={styles.animation}
                colorFilters={[{ keypath: 'Dot.**', color: textColor }]}
            />
            <Animated.Text
                style={[
                    styles.text,
                    { color: textColor },
                    animatedStyle,
                ]}
            >
                {renderText()}
            </Animated.Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        marginTop: '30%',
        marginBottom: '40%',
    },
    animation: {
        width: 180,
        height: 58,
    },
    text: {
        marginTop: 5,
        fontSize: dynamicFontSize(35, { min: 28, max: 56 }),
        fontWeight: '700',
        minHeight: 130,
        letterSpacing: -0.5,
    },
});
