import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Border, Colors, Space } from '@/constants/theme';
import { RetroIcon } from './Icon';
import { RetroText } from './Text';

const C = Colors.retro;

/** A word "selected" in a design tool: yellow box, ink outline, corner handles. */
export function RetroHighlight({ children, fontSize = 34 }: { children: string; fontSize?: number }) {
  const handle = (pos: ViewStyle) => <View style={[styles.handle, pos]} />;
  return (
    <View style={styles.highlight}>
      <RetroText variant="title" color={C.ink} style={{ fontSize, lineHeight: fontSize * 1.2 }}>{children}</RetroText>
      {handle({ top: -5, left: -5 })}
      {handle({ top: -5, right: -5 })}
      {handle({ bottom: -5, left: -5 })}
      {handle({ bottom: -5, right: -5 })}
    </View>
  );
}

/** Flat geometric vinyl illustration, drawn with plain views. */
export function RetroVinyl({ size = 150 }: { size?: number }) {
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
    <View style={{ width: size * 1.25, height: size }}>
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

/** The app identity: vinyl, "Music [Room]" and a one-line subtitle. Change the name here only. */
export function RetroBrand({ subtitle }: { subtitle?: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <RetroVinyl size={130} />
      <View style={styles.nameRow}>
        <RetroText variant="title">Music</RetroText>
        <RetroHighlight>Room</RetroHighlight>
      </View>
      {subtitle ? <RetroText variant="body" color={C.textSecondary} style={{ textAlign: 'center' }}>{subtitle}</RetroText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm + 2, marginTop: Space.xl, marginBottom: Space.sm },
  highlight: { alignSelf: 'flex-start', backgroundColor: C.accent, borderWidth: Border.width, borderColor: C.ink, paddingHorizontal: Space.sm, paddingVertical: 2 },
  handle: { position: 'absolute', width: 9, height: 9, backgroundColor: C.background, borderWidth: Border.thin, borderColor: C.ink },
});
