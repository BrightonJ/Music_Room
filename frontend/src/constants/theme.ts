import '@/global.css';
import { Platform } from 'react-native';

/**
 * DESIGN TOKENS - the single source of truth for the app's look.
 * Change a value here and every screen follows. See frontend/DESIGN.md.
 */

// --- Colors: cream paper, ink outlines, bold flat colors ---
const retro = {
  text: '#1A1A1A',
  background: '#FBF6EA',
  backgroundElement: '#FFFFFF', // cards / surfaces
  backgroundSelected: '#EFE7D2', // disabled / pressed / track backgrounds
  textSecondary: '#6B6558',
  primary: '#EE6C5B', // coral: main call to action
  secondary: '#7C6CF2', // violet
  accent: '#F7C948', // yellow
  success: '#5BC46B', // green
  danger: '#D64545',
  ink: '#1A1A1A', // outlines + hard shadows
  field: '#FFFFFF', // inputs
  onColor: '#FFFFFF', // text on coral / violet
  // Feedback banners
  errorBackground: '#FBD9D3',
  successBackground: '#D5F0D9',
  successForeground: '#2E8B45',
  // Misc
  switchOff: '#D9D2BD',
  vinylGroove: '#2B2B2B',
} as const;

export const Colors = {
  light: retro,
  dark: retro, // single theme for now
  retro,
} as const;

export type ThemeColor = keyof typeof Colors.retro;

/**
 * Tones: a background with the text color that goes on top of it.
 * <RetroCard tone="violet"> and <RetroButton> use these, and text inside inherits the foreground.
 */
export const Tones = {
  default: { background: retro.backgroundElement, foreground: retro.text },
  violet: { background: retro.secondary, foreground: retro.onColor },
  yellow: { background: retro.accent, foreground: retro.ink },
  coral: { background: retro.primary, foreground: retro.onColor },
  green: { background: retro.success, foreground: retro.ink },
} as const;

export type Tone = keyof typeof Tones;

/** Tones that cards cycle through in lists (home screen). */
export const CardToneCycle: Tone[] = ['violet', 'yellow', 'coral'];

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

// Poppins, loaded in src/app/_layout.tsx
export const Poppins = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

// --- Typography: use <RetroText variant="...">, never raw font styles ---
export const Typography = {
  title: { fontFamily: Poppins.bold, fontSize: 34, lineHeight: 40 },
  heading: { fontFamily: Poppins.bold, fontSize: 19, lineHeight: 26 },
  label: { fontFamily: Poppins.semibold, fontSize: 14, lineHeight: 20 },
  body: { fontFamily: Poppins.regular, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: Poppins.medium, fontSize: 12, lineHeight: 16 },
} as const;

export type TextVariant = keyof typeof Typography;

// --- Space: THE spacing scale for app code (Spacing below is legacy Expo-template) ---
export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// --- Shape: outlines, corners and the hard "drop" shadow ---
export const Border = { width: 2, thin: 1.5 } as const;
export const Radius = { sm: 10, md: 12, lg: 14, xl: 16, pill: 20 } as const;
export const Shadow = { offset: 4 } as const;

// --- Layout ---
export const Layout = {
  gutter: Space.xl, // horizontal screen padding
  maxContentWidth: 560, // keeps forms readable on wide (web) screens
  headerSide: 96, // width reserved for header buttons
  gridStep: 28, // paper grid spacing
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;