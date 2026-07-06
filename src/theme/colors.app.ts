import type { UIColors } from 'react-native-nice-ui';

export interface AppColors extends UIColors {
    text: string;
    card: string;

    red: string;
    yellow: string;
    green: string;

    listItemBackgroundMuted: string;

    brandColor: string;
    brandColorMuted: string;

        onboardingBackground: string;

        pickerBackground: string;


    // alles, was deine App zusätzlich braucht:
    mainBackground: string;
    keyboardBackground: string;
    modalBackground: string;

    surface: string;
    surfaceSecondary: string;

    questionnaireCardAvailable: string;
    questionnaireCardUnavailable: string;

    borderLight: string;
    shadow: string;

    input: string;
    searchInput: string;
    searchInputBorder: string;
    placeholder: string;

    error: string;
    success: string;
    warning: string;
    info: string;

    primaryLight: string;
    accent: string;

    headerLinkColor?: string;

    scenarioItemBackground: string;
    scenarioItemEditBackground: string;
    scenarioItemIconColor: string;

    spinnerColor: string;
    inputLabel: string;
    inputBorder: string;
    drawerBackground: string;
    drawerBackgroundMac: string;

    promptButtonBackground: string;
    promptButtonBorder: string;
    promptText: string;
    promptSelectedBorder: string;
    promptAddButtonBackground: string;
    promptAddButtonBorder: string;
    promptAddText: string;
    promptDeleteBackground: string;
    promptDeleteText: string;
    promptScreenInputBorder: string;
    promptScreenSaveButton: string;
    promptScreenSaveButtonText: string;

    textDarkGray: string;
    inputToolbarBorder: string;
    fileListBackground: string;
    fileItemBorder: string;
    addButtonBackground: string;
    chatScreenSplit: string;

    buttonBackground: string;
    buttonText: string;
    buttonBorder: string;
    buttonIcon: string;
}
