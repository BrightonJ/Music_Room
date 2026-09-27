import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Tones, type Tone } from '@/constants/theme';
import { ui } from '@/constants/styles';
import { RetroText } from './Text';

/** Small colored tag ("Public", "Guests vote"). */
export function RetroChip({ label, tone = 'default' }: { label: string; tone?: Tone }) {
  return (
    <View style={[ui.chip, { backgroundColor: Tones[tone].background }]}>
      <RetroText style={[ui.chipText, { color: Tones[tone].foreground }]}>{label}</RetroText>
    </View>
  );
}

/** Success / error message box. */
export function RetroMessage({ type, text }: { type: 'success' | 'error'; text: string }) {
  return <RetroText style={type === 'error' ? ui.messageError : ui.messageSuccess}>{text}</RetroText>;
}

/** List row: title, subtitle, and actions on the right. */
export function RetroRow({
  title,
  subtitle,
  right,
  style,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[ui.row, style]}>
      <View style={{ flex: 1 }}>
        <RetroText style={ui.rowTitle} numberOfLines={1}>{title}</RetroText>
        {subtitle ? <RetroText style={ui.rowSubtitle}>{subtitle}</RetroText> : null}
      </View>
      {right}
    </View>
  );
}

/** Section title. */
export function RetroSectionTitle({ children }: { children: string }) {
  return <RetroText style={ui.sectionTitle}>{children}</RetroText>;
}

/** Nothing to show yet. */
export function RetroEmpty({ children }: { children: string }) {
  return <RetroText style={ui.empty}>{children}</RetroText>;
}
