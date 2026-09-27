import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/theme';

type Action = { label: string; onPress: () => void; tone?: 'primary' | 'danger' | 'muted' };

type Props = { title: string; left?: Action; right?: Action };

const toneColor = (tone: Action['tone']) =>
  tone === 'danger' ? Colors.dark.danger : tone === 'muted' ? Colors.dark.textSecondary : Colors.dark.primary;

export default function ScreenHeader({ title, left, right }: Props) {
  const renderAction = (action?: Action, align: 'left' | 'right' = 'left') => (
    <View style={[styles.side, align === 'right' && styles.sideRight]}>
      {action ? (
        <TouchableOpacity onPress={action.onPress} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.action, { color: toneColor(action.tone) }]}>{action.label}</Text>
        </TouchableOpacity>
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
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.backgroundElement,
  },
  side: { width: 90 },
  sideRight: { alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: Colors.dark.text },
  action: { fontSize: 15, fontWeight: 'bold' },
});
