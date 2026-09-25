import React from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Border, Colors, Radius, Space, Tones, type Tone } from '@/constants/theme';
import { RetroCard } from './Box';
import { RetroIcon, type RetroIconName } from './Icon';
import { RetroText } from './Text';

const C = Colors.retro;

/** Small colored tag ("Public", "Proximity"). */
export function RetroChip({ label, tone = 'yellow' }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.chip, { backgroundColor: Tones[tone].background }]}>
      <RetroText variant="small" color={C.ink}>{label}</RetroText>
    </View>
  );
}

/** Error / success message. */
export function RetroBanner({ type, text }: { type: 'error' | 'success' | string; text: string }) {
  const isError = type === 'error';
  return (
    <View style={[styles.banner, { backgroundColor: isError ? C.errorBackground : C.successBackground }]}>
      <RetroIcon name={isError ? 'alert-circle' : 'checkmark-circle'} size={20} color={isError ? C.danger : C.successForeground} />
      <RetroText variant="small" color={C.ink} style={{ flex: 1, fontSize: 13, lineHeight: 18 }}>{text}</RetroText>
    </View>
  );
}

/** Progress bar, `progress` from 0 to 1. */
export function RetroProgress({ progress, color = C.accent }: { progress: number; color?: string }) {
  const pct = Math.max(0, Math.min(progress, 1)) * 100;
  return (
    <View style={styles.progressTrack}>
      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: color }} />
    </View>
  );
}

/** Round badge with a letter or a number (avatar, rank...). */
export function RetroAvatar({ label, size = 48, tone = 'yellow' }: { label: string; size?: number; tone?: Tone }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: Tones[tone].background,
        borderWidth: size < 32 ? Border.thin : Border.width,
        borderColor: C.ink,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <RetroText variant={size < 32 ? 'small' : 'heading'} color={Tones[tone].foreground}>{label}</RetroText>
    </View>
  );
}

/** Album cover with a fallback icon. */
export function RetroCover({ uri, size = 52 }: { uri?: string | null; size?: number }) {
  const frame = { width: size, height: size, borderRadius: Radius.sm, borderWidth: Border.width, borderColor: C.ink };
  return uri ? (
    <Image source={{ uri }} style={[frame, { backgroundColor: C.backgroundSelected }]} />
  ) : (
    <View style={[frame, styles.coverEmpty]}>
      <RetroIcon name="disc" size={size / 2} color={C.textSecondary} />
    </View>
  );
}

/** A card row: leading visual, title + subtitle, trailing action. Use it for any list of things. */
export function RetroListItem({
  leading,
  title,
  subtitle,
  trailing,
  style,
}: {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <RetroCard padded={false} style={style} contentStyle={styles.listItem}>
      {leading}
      <View style={{ flex: 1 }}>
        <RetroText variant="label" numberOfLines={1}>{title}</RetroText>
        {subtitle ? <RetroText variant="small" color={C.textSecondary} numberOfLines={1}>{subtitle}</RetroText> : null}
      </View>
      {trailing}
    </RetroCard>
  );
}

/** Nothing here yet: an icon or illustration and a message. */
export function RetroEmptyState({
  icon,
  illustration,
  message,
}: {
  icon?: RetroIconName;
  illustration?: React.ReactNode;
  message: string;
}) {
  return (
    <View style={styles.empty}>
      {illustration ?? (icon ? <RetroIcon name={icon} size={36} color={C.textSecondary} /> : null)}
      <RetroText variant="body" color={C.textSecondary} style={{ textAlign: 'center', marginTop: Space.lg }}>{message}</RetroText>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderWidth: Border.thin, borderColor: C.ink, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm + 2,
    borderWidth: Border.width,
    borderColor: C.ink,
    borderRadius: Radius.md,
    padding: Space.md,
    marginBottom: Space.lg,
  },
  progressTrack: { height: 10, borderWidth: Border.thin, borderColor: C.ink, borderRadius: 6, backgroundColor: C.background, overflow: 'hidden' },
  coverEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: C.backgroundSelected },
  listItem: { flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.sm + 2 },
  empty: { alignItems: 'center', marginTop: Space.xxxl + Space.sm },
});
