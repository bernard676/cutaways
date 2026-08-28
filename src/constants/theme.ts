/**
 * Design tokens adapted from the "Aura Platform" source template (see DESIGN.md) for
 * Sketch Studios: a neutral gray scale carries the UI, with a confident orange "brand"
 * accent (primary #FF5C00 / accent #E55300 from the source) used sparingly for the mark,
 * focus, links, and active state. Colors.light/Colors.dark below are the two resolved
 * palettes; use `useTheme()` (src/hooks/use-theme.ts) rather than importing `Colors`
 * directly so components respond to the user's light/dark/system preference.
 */

import { Platform } from 'react-native';

const ink = {
  0: '#ffffff',
  50: '#f9fafb',
  100: '#f3f4f6',
  200: '#e5e7eb',
  300: '#d1d5db',
  400: '#9ca3af',
  500: '#6b7280',
  600: '#4b5563',
  700: '#374151',
  800: '#1f2937',
  850: '#18202f',
  900: '#111827',
  950: '#030712',
} as const;

const brand = {
  50: '#fff3ec',
  100: '#ffe1cc',
  200: '#ffc299',
  300: '#ff9c5c',
  400: '#ff7a33',
  500: '#ff5c00',
  600: '#e55300',
  700: '#c24700',
  800: '#9c3900',
  glow: 'rgba(255, 92, 0, 0.28)',
} as const;

const semantic = {
  green500: '#17935a',
  green600: '#0f7a49',
  green50: '#e9f6ef',
  red500: '#d64545',
  red600: '#bd3535',
  red50: '#fbecec',
  amber500: '#c07d12',
  amber600: '#9c6310',
  amber50: '#fbf2e2',
  blue500: '#2563c9',
  blue600: '#1d4fa6',
  blue50: '#eaf1fb',
} as const;

export const Ink = ink;
export const Brand = brand;
export const Semantic = semantic;

export const Colors = {
  light: {
    // surfaces
    background: ink[50], // page background
    backgroundElement: ink[0], // card / raised surface
    backgroundSunken: ink[100], // recessed / selected surface
    backgroundSelected: ink[100],
    backgroundInverse: ink[900],
    overlay: 'rgba(10, 12, 16, 0.5)',
    // text
    text: ink[900],
    textSecondary: ink[700],
    textMuted: ink[500],
    textFaint: ink[400],
    textInverse: ink[0],
    // borders
    border: ink[200],
    borderStrong: ink[300],
    // brand
    accent: brand[500],
    accentHover: brand[600],
    accentPress: brand[700],
    accentSoft: brand[50],
    // status
    danger: semantic.red500,
    success: semantic.green500,
    warning: semantic.amber500,
    info: semantic.blue500,
    statusPassFg: semantic.green600,
    statusPassBg: semantic.green50,
    statusFailFg: semantic.red600,
    statusFailBg: semantic.red50,
  },
  dark: {
    background: ink[950],
    backgroundElement: ink[900],
    backgroundSunken: ink[850],
    backgroundSelected: ink[800],
    backgroundInverse: ink[50],
    overlay: 'rgba(0, 0, 0, 0.6)',
    text: ink[0],
    textSecondary: ink[200],
    textMuted: ink[400],
    textFaint: ink[500],
    textInverse: ink[900],
    border: ink[800],
    borderStrong: ink[700],
    accent: brand[400],
    accentHover: brand[300],
    accentPress: brand[200],
    accentSoft: brand[800],
    danger: semantic.red500,
    success: semantic.green500,
    warning: semantic.amber500,
    info: semantic.blue500,
    statusPassFg: semantic.green500,
    statusPassBg: semantic.green600,
    statusFailFg: semantic.red500,
    statusFailBg: semantic.red600,
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type ThemeColors = { [K in keyof typeof Colors.light]: string };

/**
 * Loaded via expo-font's useFonts() in the root layout (see src/app/_layout.tsx).
 * These strings MUST match the font-family names actually registered there, or React
 * Native silently falls back to the system font. display: Inter (headings, wordmark) ·
 * body: Playfair Display (UI/body text) · mono: JetBrains Mono (labels, specs, formulas).
 */
export const Fonts = {
  display: 'Inter_600SemiBold',
  displayMedium: 'Inter_500Medium',
  body: 'PlayfairDisplay_400Regular',
  bodyMedium: 'PlayfairDisplay_500Medium',
  bodySemiBold: 'PlayfairDisplay_600SemiBold',
  mono: 'JetBrainsMono_500Medium',
  monoRegular: 'JetBrainsMono_400Regular',
};

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
  section: 80,
} as const;

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
