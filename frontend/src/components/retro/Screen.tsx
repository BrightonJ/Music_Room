import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { Colors, Layout } from '@/constants/theme';
import { ui } from '@/constants/styles';

/** Faint grid, like graph paper. */
export function GridBackground() {
  const { width, height } = useWindowDimensions();
  const step = Layout.gridStep;
  const line = { position: 'absolute', backgroundColor: Colors.retro.ink, opacity: Layout.gridOpacity } as const;
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      {Array.from({ length: Math.ceil(width / step) }, (_, i) => (
        <View key={`v${i}`} style={[line, { left: i * step, top: 0, bottom: 0, width: 1 }]} />
      ))}
      {Array.from({ length: Math.ceil(height / step) }, (_, i) => (
        <View key={`h${i}`} style={[line, { top: i * step, left: 0, right: 0, height: 1 }]} />
      ))}
    </View>
  );
}

/**
 * THE screen wrapper: cream paper with the grid, inside a safe area.
 * Every screen starts with it: <RetroScreen>...</RetroScreen>
 */
export function RetroScreen({
  children,
  edges,
  style,
}: {
  children?: ReactNode;
  edges?: readonly Edge[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView style={[ui.screen, style]} edges={edges}>
      <GridBackground />
      {children}
    </SafeAreaView>
  );
}
