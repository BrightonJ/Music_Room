import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Border, Colors, Space, Type } from '@/constants/theme';
import { RetroIcon } from './Icon';
import { RetroText } from './Text';

const C = Colors.retro;

/** A word "selected" in a design tool: yellow box, ink outline, corner handles. */
export function RetroHighlight({ children }: { children: string }) {
  const handle = (pos: ViewStyle) => <View style={[styles.handle, pos]} />;
  return (
    <View style={styles.highlight}>
      <RetroText variant="display" color={C.ink}>{children}</RetroText>
      {handle({ top: -5, left: -5 })}
      {handle({ top: -5, right: -5 })}
      {handle({ bottom: -5, left: -5 })}
      {handle({ bottom: -5, right: -5 })}
    </View>
  );
}

/** Flat geometric vinyl illustration. */
export function RetroVinyl({ size = 130 }: { size?: number }) {
  const u = size / 150;
  const circle = (d: number, bg: string, extra?: ViewStyle): ViewStyle => ({
    width: d * u,
    height: d * u,
    borderRadius: (d * u) / 2,
    backgroundColor: bg,
    ...extra,
  });
  const outlined = { borderWidth: Border.width, borderColor: C.ink } as const;
  const centered = { alignItems: 'center', justifyContent: 'center' } as const;
  return (
    <View style={{ width: size * 1.25, height: size }} accessible={false}>
      <View style={circle(70, C.secondary, { position: 'absolute', left: 0, top: 6 * u, ...outlined })} />
      <View style={circle(38, C.success, { position: 'absolute', left: 6 * u, bottom: 0, ...outlined })} />
      <View style={circle(140, C.ink, { position: 'absolute', right: 0, top: 5 * u, ...centered })}>
        <View style={circle(112, C.vinylGroove, centered)}>
          <View style={circle(84, C.ink, centered)}>
            <View style={circle(50, C.accent, { ...centered, ...outlined })}>
              <View style={circle(10, C.background, outlined)} />
            </View>
          </View>
        </View>
      </View>
      <View style={{ position: 'absolute', right: 6 * u, top: 0 }}>
        <RetroIcon name="musical-notes" size={28 * u} color={C.primary} />
      </View>
    </View>
  );
}

/** App identity: vinyl + "Music [Room]" + a subtitle. The app name lives here only. */
export function RetroBrand({ subtitle }: { subtitle?: string }) {
  return (
    <View style={styles.brand}>
      <RetroVinyl />
      <View style={styles.nameRow} accessibilityRole="header" accessibilityLabel="Music Room">
        <RetroText variant="display">Music</RetroText>
        <RetroHighlight>Room</RetroHighlight>
      </View>
      {subtitle ? <RetroText style={styles.subtitle}>{subtitle}</RetroText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', marginTop: Space.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm + 2, marginTop: Space.xl, marginBottom: Space.xs },
  subtitle: { ...Type.body, color: C.textSecondary, textAlign: 'center', marginBottom: Space.sm },
  highlight: { backgroundColor: C.accent, borderWidth: Border.width, borderColor: C.ink, paddingHorizontal: Space.sm, paddingVertical: Space.xxs },
  handle: { position: 'absolute', width: 9, height: 9, backgroundColor: C.background, borderWidth: Border.thin, borderColor: C.ink },
});
