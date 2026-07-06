import { Platform } from 'react-native';

import { lightUIColors, darkUIColors } from 'react-native-nice-ui';

import type { AppColors } from './colors.app';

export function isIOSVersionOrHigher(minVersion: number): boolean {
    return Platform.OS === 'ios' && parseInt(Platform.Version as string, 10) >= minVersion;
}


/** Signal colors for ALSFRS-R progress rate visualization (theme-independent) */
export const green = '#399B65';
export const yellow = '#FF9500';
export const red = '#F9154A';

export const lightColors: AppColors = {
    ...lightUIColors,

    red: '#F9154A',
    yellow: '#FF9500',
    green: '#399B65',

    listItemBackgroundMuted: 'rgba(0,0,0,0.05)',
    pickerBackground: 'rgba(230,230,230,0.9)',

    tint: '#904199',
    primary: '#904199',
    brandColor: '#904199',
    brandColorMuted: '#b769bd',

    text: '#000000',
    card: '#ffffff',

    onboardingBackground: '#f5f5f5',

    // App-only
    mainBackground: '#ffffff',
    keyboardBackground: 'rgba(0,0,0,0.1)',
    modalBackground: '#f5f5f5',

    surface: '#f5f5f5',
    surfaceSecondary: '#f9f9f9',

    questionnaireCardAvailable: '#ffffff',
    questionnaireCardUnavailable: '#f8f8f8',

    borderLight: '#eaeaea',
    shadow: 'rgba(0,0,0,0.1)',

    input: '#f8f8f8',
    searchInput: 'rgba(0,0,0,0.1)',
    searchInputBorder: 'transparent',
    placeholder: '#707070',

    error: '#ff4444',
    success: '#00C851',
    warning: '#ffbb33',
    info: '#33b5e5',

    primaryLight: '#E3F2FD',
    accent: '#FF6B6B',

    headerLinkColor: Platform.select({
        ios: isIOSVersionOrHigher(26) ? '#000000' : '#007AFF',
        android: '#007AFF',
        default: '#007AFF'
    }) as string,

    scenarioItemBackground: '#ffffff',
    scenarioItemEditBackground: '#f3f3f3',
    scenarioItemIconColor: '#000000',

    spinnerColor: 'rgba(0,0,0,0.54)',
    inputLabel: 'rgba(0,0,0,0.5)',
    inputBorder: '#808080',

    drawerBackground: 'transparent',
    drawerBackgroundMac: '#F9F9F9',

    promptButtonBackground: '#E8E8E8',
    promptButtonBorder: '#E8E8E8',
    promptText: '#333333',
    promptSelectedBorder: '#000000',
    promptAddButtonBackground: '#ffffff',
    promptAddButtonBorder: '#666666',
    promptAddText: '#666666',
    promptDeleteBackground: '#666666',
    promptDeleteText: '#ffffff',
    promptScreenInputBorder: '#e0e0e0',
    promptScreenSaveButton: '#007AFF',
    promptScreenSaveButtonText: '#ffffff',

    textDarkGray: '#333333',
    inputToolbarBorder: '#000000',
    fileListBackground: '#ffffff',
    fileItemBorder: '#e0e0e0',
    addButtonBackground: '#f0f0f0',
    chatScreenSplit: '#c7c7c7',

    buttonBackground: '#E8E8E8',
    buttonText: '#000000',
    buttonBorder: '#505054',
    buttonIcon: '#333333'
};

export const darkColors: AppColors = {
    ...darkUIColors,

    red: '#F9154A',
    yellow: '#FF9500',
    green: '#399B65',

    text: '#ffffff',
    card: 'rgba(255,255,255,0.05)',

    tint: '#8451A1',
    primary: '#8451A1',
    brandColor: '#8451A1',
    brandColorMuted: '#c0a7dd',

    listItemBackgroundMuted: 'rgba(255,255,255,0.05)',
    // listItemBackground: '#2A2A2A',
    pickerBackground: 'rgba(34,34,34,0.9)',

    onboardingBackground: '#1a1a1a',

    mainBackground: '#000',
    keyboardBackground: 'rgba(0,0,0,0.6)',
    modalBackground: '#1a1a1a',

    surface: '#1a1a1a',
    surfaceSecondary: '#2a2a2a',

    questionnaireCardAvailable: 'rgba(255,255,255,0.15)',
    questionnaireCardUnavailable: 'rgba(255,255,255,0.07)',

    borderLight: '#444444',
    shadow: 'rgba(255,255,255,0.1)',

    input: 'rgba(0,0,0,0.6)',
    searchInput: 'rgba(0,0,0,0.6)',
    searchInputBorder: 'rgba(0,0,0,0.6)',
    placeholder: '#888888',

    error: '#ff6b6b',
    success: '#51cf66',
    warning: '#ffd43b',
    info: '#74c0fc',

    primaryLight: '#1a1a2e',
    accent: '#ff7979',

    headerLinkColor: Platform.select({
        ios: isIOSVersionOrHigher(26) ? '#cccccc' : '#007AFF',
        android: '#007AFF',
        default: '#007AFF'
    }) as string,

    scenarioItemBackground: '#2a2a2a',
    scenarioItemEditBackground: '#3a3a3a',
    scenarioItemIconColor: '#ffffff',

    spinnerColor: 'rgba(255,255,255,0.8)',
    inputLabel: 'rgba(255,255,255,0.8)',
    inputBorder: 'rgba(255,255,255,0.2)',

    drawerBackground: '#000000',
    drawerBackgroundMac: '#000000',

    promptButtonBackground: '#333333',
    promptButtonBorder: '#333333',
    promptText: '#cccccc',
    promptSelectedBorder: '#cccccc',
    promptAddButtonBackground: '#2a2a2a',
    promptAddButtonBorder: '#cccccc',
    promptAddText: '#cccccc',
    promptDeleteBackground: '#888888',
    promptDeleteText: '#ffffff',
    promptScreenInputBorder: '#444444',
    promptScreenSaveButton: '#0099ff',
    promptScreenSaveButtonText: '#ffffff',

    textDarkGray: '#cccccc',
    inputToolbarBorder: '#cccccc',
    fileListBackground: '#000000',
    fileItemBorder: '#cccccc',
    addButtonBackground: '#333333',
    chatScreenSplit: '#404040',

    buttonBackground: '#505054',
    buttonText: '#ffffff',
    buttonBorder: '#505054',
    buttonIcon: '#ffffff'
};
