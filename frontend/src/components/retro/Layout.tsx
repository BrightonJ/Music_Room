import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Colors, Layout, Space } from '@/constants/theme';
import { RetroText } from './Text';
import { RetroPill } from './Button';

const C = Colors.retro;

/** Faint grid, like graph paper. */
function GridBackground() {
  const { width, height } = useWindowDimensions();
  const step = Layout.gridStep;
  const cols = Math.ceil(Math.min(width, 900) / step);
  const rows = Math.ceil(height / step);
  const line = { position: 'absolute', backgroundColor: C.ink, opacity: 0.045 } as const;
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      {Array.from({ length: cols }, (_, i) => (
        <View key={`v${i}`} style={[line, { left: i * step, top: 0, bottom: 0, width: 1 }]} />
      ))}
      {Array.from({ length: rows }, (_, i) => (
        <View key={`h${i}`} style={[line, { top: i * step, left: 0, right: 0, height: 1 }]} />
      ))}
    </View>
  );
}

/** Bare screen: cream paper background. Prefer <RetroPage>. */
export function RetroScreen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <SafeAreaView style={[styles.screen, style]}>
      <GridBackground />
      {children}
    </SafeAreaView>
  );
}

type HeaderAction = { label: string; onPress: () => void; color?: string };

export function RetroHeader({ title, left, right }: { title: string; left?: HeaderAction; right?: HeaderAction }) {
  return (
    <View style={styles.header}>
      <View style={[styles.headerSide, { alignItems: 'flex-start' }]}>
        {left && <RetroPill label={left.label} onPress={left.onPress} color={left.color} />}
      </View>
      <RetroText variant="heading" style={{ flexShrink: 1, textAlign: 'center' }} numberOfLines={1}>{title}</RetroText>
      <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>
        {right && <RetroPill label={right.label} onPress={right.onPress} color={right.color} />}
      </View>
    </View>
  );
}

/**
 * THE screen wrapper: paper background + optional header + padded, centered, scrollable content.
 * Every new screen should start from this.
 *
 *   <RetroPage title="Friends" left={{ label: 'Back', onPress: router.back }}>
 *     ...content...
 *   </RetroPage>
 */
export function RetroPage({
  title,
  left,
  right,
  scroll = true,
  centered = false,
  keyboardAvoiding = false,
  footer,
  refreshControl,
  contentStyle,
  children,
}: {
  title?: string;
  left?: HeaderAction;
  right?: HeaderAction;
  /** false: content is a plain flex View (use it when you render your own FlatList). */
  scroll?: boolean;
  /** Vertically center the content (login-style screens). */
  centered?: boolean;
  keyboardAvoiding?: boolean;
  /** Pinned to the bottom of the screen, e.g. a main action button. */
  footer?: React.ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.content, centered && styles.centered, !!footer && { paddingBottom: 110 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.plainContent, contentStyle]}>{children}</View>
  );

  return (
    <RetroScreen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' && keyboardAvoiding ? 'padding' : undefined} style={styles.flex}>
        {title !== undefined && <RetroHeader title={title} left={left} right={right} />}
        {body}
      </KeyboardAvoidingView>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </RetroScreen>
  );
}

/** Section title + content, with consistent spacing. */
export function RetroSection({
  title,
  children,
  style,
}: {
  title: string;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ marginBottom: Space.xl }, style]}>
      <RetroText variant="label" color={C.textSecondary} style={{ marginBottom: Space.md + 2 }}>{title}</RetroText>
      {children}
    </View>
  );
}

/** Horizontal rule with an optional word in the middle ("or"). */
export function RetroDivider({ label }: { label?: string }) {
  const rule = <View style={styles.rule} />;
  return (
    <View style={styles.divider}>
      {rule}
      {label ? <RetroText variant="small" color={C.textSecondary} style={{ paddingHorizontal: Space.md }}>{label}</RetroText> : null}
      {label ? rule : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Layout.gutter,
    paddingVertical: Space.md,
  },
  headerSide: { width: Layout.headerSide },
  content: { padding: Layout.gutter, paddingBottom: Space.xxxl + Space.lg, maxWidth: Layout.maxContentWidth, width: '100%', alignSelf: 'center' },
  centered: { flexGrow: 1, justifyContent: 'center' },
  plainContent: { maxWidth: Layout.maxContentWidth, width: '100%', alignSelf: 'center' },
  footer: { position: 'absolute', bottom: Space.xxl, left: Layout.gutter, right: Layout.gutter, maxWidth: Layout.maxContentWidth, alignSelf: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: Space.xxl },
  rule: { flex: 1, height: 2, backgroundColor: C.ink, opacity: 0.15 },
});
