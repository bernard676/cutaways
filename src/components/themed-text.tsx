import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextType =
  | 'display' // H2 headline (Space Grotesk)
  | 'displaySm' // H3 (Space Grotesk)
  | 'wordmark' // H4 brand wordmark (Space Grotesk)
  | 'body' // default paragraph text (Hanken Grotesk)
  | 'bodyLg' // tagline (Hanken Grotesk)
  | 'bodyMedium'
  | 'bodySemiBold'
  | 'label' // uppercase overline section labels
  | 'small'
  | 'mono' // breadcrumbs, specs, step captions
  | 'link';

export type ThemedTextProps = TextProps & {
  type?: ThemedTextType;
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'body', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]} {...rest} />
  );
}

const styles = StyleSheet.create({
  display: {
    fontFamily: Fonts.display,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.4,
  },
  displaySm: {
    fontFamily: Fonts.display,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  wordmark: {
    fontFamily: Fonts.display,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: 16,
    lineHeight: 23,
  },
  bodyLg: {
    fontFamily: Fonts.body,
    fontSize: 17,
    lineHeight: 25,
  },
  bodyMedium: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
    lineHeight: 23,
  },
  bodySemiBold: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 16,
    lineHeight: 22,
  },
  label: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: 11.5,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  small: {
    fontFamily: Fonts.body,
    fontSize: 13.5,
    lineHeight: 19,
  },
  mono: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.2,
  },
  link: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
});
