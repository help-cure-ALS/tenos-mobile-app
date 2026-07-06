import { defaultTokens } from 'react-native-nice-ui';
import type { AppTokens } from './tokens.app';

export const tokens: AppTokens = {
    ...defaultTokens,

    // App-spezifische Tokens
    cardRadius: 12,
    cardPadding: 16,
    screenPaddingHorizontal: 16,
};
