import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Tones, type Tone } from '@/constants/theme';
import { ui } from '@/constants/styles';
import { TextToneProvider } from './Text';

/**
 * Outlined card with the hard shadow, in one of the theme tones.
 * Text and icons inside automatically get the right color for that tone.
 */
export function RetroCard({ tone = 'default', style, children }: { tone?: Tone; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  const { background, foreground } = Tones[tone];
  return (
    <View style={[ui.card, { backgroundColor: background }, style]}>
      <TextToneProvider value={foreground}>{children}</TextToneProvider>
    </View>
  );
}
