import { StyleSheet } from 'react-native';
import { Border, Colors, Layout, Outline, Radius, Shadow, Space, Tones, Type } from './theme';

const C = Colors.retro;

/**
 * Shared screen styles (forms, lists, buttons), built only from the tokens in theme.ts.
 * For new features prefer the `Retro*` components (src/components/retro), which use these styles.
 */
export const ui = StyleSheet.create({
  // Layout
  screen: { flex: 1, backgroundColor: C.background },
  scroll: { padding: Layout.gutter, paddingBottom: Space.xxxl + Space.lg, width: '100%', maxWidth: Layout.maxContentWidth, alignSelf: 'center' },
  sectionTitle: { ...Type.heading, color: C.text, marginTop: Space.xxl, marginBottom: Space.md },
  card: { backgroundColor: C.backgroundElement, ...Outline, borderRadius: Radius.xl, padding: Space.lg, ...Shadow.md },

  // Forms
  label: { ...Type.label, color: C.text, marginBottom: Space.sm - 2, marginTop: Space.md },
  input: {
    ...Type.input,
    backgroundColor: C.backgroundElement,
    color: C.text,
    paddingHorizontal: Space.lg - 2,
    paddingVertical: Space.md + 1,
    borderRadius: Radius.md,
    ...Outline,
  },
  inputError: { borderColor: C.danger },
  fieldError: { ...Type.small, color: C.danger, marginTop: Space.xs, marginLeft: Space.xs },
  helper: { ...Type.small, fontSize: 13, lineHeight: 18, color: C.textSecondary, marginTop: Space.sm - 2 },

  // Buttons (hard shadow, ink outline)
  primaryButton: {
    backgroundColor: Tones.coral.background,
    ...Outline,
    ...Shadow.md,
    paddingVertical: Space.lg - 2,
    borderRadius: Radius.lg,
    alignItems: 'center',
    marginTop: Space.xxl,
  },
  primaryButtonText: { ...Type.button, color: Tones.coral.foreground },
  secondaryButton: {
    backgroundColor: Tones.default.background,
    ...Outline,
    ...Shadow.md,
    paddingVertical: Space.md + 1,
    borderRadius: Radius.lg,
    alignItems: 'center',
    marginTop: Space.md,
  },
  secondaryButtonText: { ...Type.button, fontSize: 15, color: Tones.default.foreground },
  dangerButton: {
    backgroundColor: Tones.danger.background,
    ...Outline,
    ...Shadow.md,
    paddingVertical: Space.md + 1,
    borderRadius: Radius.lg,
    alignItems: 'center',
    marginTop: Space.md,
  },
  dangerButtonText: { ...Type.button, fontSize: 15, color: Tones.danger.foreground },
  disabled: { opacity: 0.5 },
  linkText: { ...Type.label, color: C.secondary, textDecorationLine: 'underline' },

  // Rows (list items)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.backgroundElement,
    ...Outline,
    ...Shadow.md,
    padding: Space.md + 2,
    borderRadius: Radius.xl,
    marginBottom: Space.md + 2,
  },
  rowTitle: { ...Type.label, fontSize: 16, lineHeight: 22, color: C.text },
  rowSubtitle: { ...Type.small, fontSize: 13, lineHeight: 18, color: C.textSecondary, marginTop: Space.xxs },
  smallButton: {
    backgroundColor: Tones.coral.background,
    borderWidth: Border.thin,
    borderColor: C.ink,
    ...Shadow.sm,
    paddingVertical: Space.sm - 1,
    paddingHorizontal: Space.md + 2,
    borderRadius: Radius.pill,
    marginLeft: Space.sm,
  },
  smallButtonText: { ...Type.buttonSmall, color: Tones.coral.foreground },
  smallButtonMuted: {
    backgroundColor: Tones.default.background,
    borderWidth: Border.thin,
    borderColor: C.ink,
    ...Shadow.sm,
    paddingVertical: Space.sm - 1,
    paddingHorizontal: Space.md + 2,
    borderRadius: Radius.pill,
    marginLeft: Space.sm,
  },
  smallButtonMutedText: { ...Type.buttonSmall, color: Tones.default.foreground },

  // Messages
  empty: { ...Type.body, fontSize: 14, color: C.textSecondary, textAlign: 'center', marginTop: Space.xxl },
  messageSuccess: {
    ...Type.label,
    color: C.successForeground,
    backgroundColor: C.successBackground,
    ...Outline,
    borderRadius: Radius.md,
    padding: Space.md,
    textAlign: 'center',
    marginTop: Space.md,
    overflow: 'hidden',
  },
  messageError: {
    ...Type.label,
    color: C.danger,
    backgroundColor: C.errorBackground,
    ...Outline,
    borderRadius: Radius.md,
    padding: Space.md,
    textAlign: 'center',
    marginTop: Space.md,
    overflow: 'hidden',
  },

  // Segmented control (e.g. "Who can vote")
  segment: { flexDirection: 'row', backgroundColor: C.backgroundElement, ...Outline, borderRadius: Radius.md, padding: Space.xs, gap: Space.xs },
  segmentItem: { flex: 1, paddingVertical: Space.sm + 2, borderRadius: Radius.sm, alignItems: 'center', borderWidth: Border.thin, borderColor: 'transparent' },
  segmentItemActive: { backgroundColor: Tones.yellow.background, borderColor: C.ink },
  segmentText: { ...Type.buttonSmall, fontSize: 13, color: C.textSecondary },
  segmentTextActive: { color: Tones.yellow.foreground },

  // Small colored tag ("Public", "Guests vote")
  chip: {
    borderWidth: Border.thin,
    borderColor: C.ink,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.sm + 2,
    paddingVertical: Space.xxs + 1,
    alignSelf: 'flex-start',
    backgroundColor: Tones.default.background,
  },
  chipText: { ...Type.small, color: C.ink },

  // Bottom sheets (modals)
  modalOverlay: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: C.background,
    ...Outline,
    borderBottomWidth: 0,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    padding: Space.xxl,
    paddingBottom: Space.xxxl + Space.xs,
    maxHeight: '85%',
  },
  modalTitle: { ...Type.title, fontSize: 20, lineHeight: 26, color: C.text, marginBottom: Space.md },
});
