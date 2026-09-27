import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Border, Colors, Layout, Radius, Space, Type } from '@/constants/theme';

type Action = { label: string; onPress: () => void; tone?: 'primary' | 'danger' | 'muted' };

type Props = { title: string; left?: Action; right?: Action };

const C = Colors.retro;
const toneColor = (tone: Action['tone']) => (tone === 'danger' ? C.danger : tone === 'muted' ? C.textSecondary : C.text);

/** Screen header: title in the middle, outlined pill actions on the sides. Also exported as `RetroHeader`. */
export default function ScreenHeader({ title, left, right }: Props) {
  const renderAction = (action?: Action, align: 'left' | 'right' = 'left') => (
    <View style={[styles.side, align === 'right' && styles.sideRight]}>
      {action ? (
        <Pressable
          onPress={action.onPress}
          hitSlop={12}
          accessibilityRole="button"
          style={({ pressed }) => [styles.pill, pressed && { backgroundColor: C.backgroundSelected }]}
        >
          <Text style={[styles.action, { color: toneColor(action.tone) }]}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  return (
    <View style={styles.header}>
      {renderAction(left, 'left')}
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      {renderAction(right, 'right')}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Layout.gutter,
    paddingVertical: Space.md,
  },
  side: { width: Layout.headerSide, alignItems: 'flex-start' },
  sideRight: { alignItems: 'flex-end' },
  pill: {
    borderWidth: Border.width,
    borderColor: C.ink,
    borderRadius: Radius.pill,
    backgroundColor: C.backgroundElement,
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs + 2,
  },
  title: { ...Type.heading, flex: 1, textAlign: 'center', color: C.text },
  action: { ...Type.small, fontSize: 13 },
});
