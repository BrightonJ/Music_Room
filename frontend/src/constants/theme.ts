/**
 * DESIGN TOKENS: the single source of truth for the app's look (retro-modern style).
 * Change a value here and every screen follows. Guide: frontend/DESIGN.md.
 *
 * Layers built on top of these tokens:
 *   - src/constants/styles.ts          `ui`: shared StyleSheet (forms, rows, buttons...)
 *   - src/components/room/roomStyles.ts `roomStyles`: room screen StyleSheet
 *   - src/components/retro/             `Retro*` components (preferred for new features)
 */

// --- Colors: cream paper, ink outlines, bold flat colors ---
const palette = {
  text: '#1A1A1A',
  textSecondary: '#6B6558',
  background: '#FBF6EA', // cream paper
  backgroundElement: '#FFFFFF', // cards, rows, inputs
  backgroundSelected: '#EFE7D2', // muted buttons, tracks, placeholders
  primary: '#EE6C5B', // coral: main call to action
  onPrimary: '#FFFFFF', // text / icons on coral and violet
  secondary: '#7C6CF2', // violet
  accent: '#F7C948', // yellow
  success: '#5BC46B', // green
  danger: '#D64545',
  ink: '#1A1A1A', // outlines and hard shadows
  // Feedback
  errorBackground: '#FBD9D3',
  successBackground: '#D5F0D9',
  successForeground: '#2E7D40',
  // Misc
  overlay: 'rgba(26, 26, 26, 0.45)', // behind modals
  switchOff: '#D9D2BD',
  vinylGroove: '#2B2B2B',
} as const;

/**
 * `Colors.dark` and `Colors.light` are kept as aliases so existing code keeps working:
 * anything written against them gets the retro palette automatically.
 */
export const Colors = {
  retro: palette,
  dark: palette,
  light: palette,
} as const;

export type ThemeColor = keyof typeof palette;

/** A background with the text color that goes on top of it. Used by cards, buttons and chips. */
export const Tones = {
  default: { background: palette.backgroundElement, foreground: palette.text },
  muted: { background: palette.backgroundSelected, foreground: palette.text },
  coral: { background: palette.primary, foreground: palette.onPrimary },
  violet: { background: palette.secondary, foreground: palette.onPrimary },
  yellow: { background: palette.accent, foreground: palette.ink },
  green: { background: palette.success, foreground: palette.ink },
  danger: { background: palette.danger, foreground: palette.onPrimary },
} as const;

export type Tone = keyof typeof Tones;

/** Tones that lists of cards cycle through (rooms on the home screen). */
export const CardToneCycle: readonly Tone[] = ['violet', 'yellow', 'coral'];

// --- Typography (Poppins, loaded in src/app/_layout.tsx) ---
export const FontFamily = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semibold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

/** Text styles. Never set fontFamily / fontWeight by hand: pick one of these. */
export const Type = {
  display: { fontFamily: FontFamily.bold, fontSize: 34, lineHeight: 40 },
  title: { fontFamily: FontFamily.bold, fontSize: 24, lineHeight: 30 },
  heading: { fontFamily: FontFamily.bold, fontSize: 18, lineHeight: 24 },
  label: { fontFamily: FontFamily.semibold, fontSize: 14, lineHeight: 20 },
  body: { fontFamily: FontFamily.regular, fontSize: 15, lineHeight: 22 },
  input: { fontFamily: FontFamily.regular, fontSize: 16 },
  small: { fontFamily: FontFamily.medium, fontSize: 12, lineHeight: 16 },
  button: { fontFamily: FontFamily.semibold, fontSize: 16 },
  buttonSmall: { fontFamily: FontFamily.semibold, fontSize: 12 },
} as const;

export type TypeVariant = keyof typeof Type;

// --- Spacing scale ---
export const Space = {
  xxs: 2,
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
export const Radius = { sm: 8, md: 12, lg: 14, xl: 16, sheet: 24, pill: 999 } as const;

const shadow = (offset: number) => ({ boxShadow: `${offset}px ${offset}px 0px 0px ${palette.ink}` });

/** Hard offset shadows (no blur). Spread them into a style: `{ ...Shadow.md }`. */
export const Shadow = {
  sm: shadow(2),
  md: shadow(4),
  none: { boxShadow: 'none' },
} as const;

/** Outline shared by every surface (cards, inputs, buttons). */
export const Outline = { borderWidth: Border.width, borderColor: palette.ink } as const;

// --- Layout ---
export const Layout = {
  gutter: Space.xl, // horizontal screen padding
  maxContentWidth: 600, // keeps content readable on tablets
  headerSide: 96, // width reserved for header buttons
  gridStep: 28, // paper grid spacing
  gridOpacity: 0.05,
} as const;
