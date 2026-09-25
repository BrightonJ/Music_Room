import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Border, Colors, Radius, Shadow, Space, Tones, type Tone } from '@/constants/theme';
import { TextToneProvider } from './Text';

const C = Colors.retro;

/** The basic building block: ink outline + hard offset shadow. */
export function RetroBox({
  style,
  contentStyle,
  background = C.backgroundElement,
  borderColor = C.ink,
  radius = Radius.xl,
  pressed = false,
  shadow = true,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  background?: string;
  borderColor?: string;
  radius?: number;
  /** Visual "pushed in" state: the box slides onto its shadow. */
  pressed?: boolean;
  shadow?: boolean;
  children?: React.ReactNode;
}) {
  const off = shadow ? Shadow.offset : 0;
  return (
    <View style={[{ paddingRight: off, paddingBottom: off }, style]}>
      {shadow && !pressed && (
        <View
          style={{
            position: 'absolute',
            top: off,
            left: off,
            right: 0,
            bottom: 0,
            backgroundColor: C.ink,
            borderRadius: radius,
            pointerEvents: 'none',
          }}
        />
      )}
      <View
        style={[
          { backgroundColor: background, borderWidth: Border.width, borderColor, borderRadius: radius, overflow: 'hidden' },
          pressed && shadow && { transform: [{ translateX: off }, { translateY: off }] },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

/** A padded RetroBox in one of the theme tones. Text inside inherits the right color. */
export function RetroCard({
  tone = 'default',
  padded = true,
  style,
  contentStyle,
  children,
}: {
  tone?: Tone;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const { background, foreground } = Tones[tone];
  return (
    <RetroBox style={style} background={background} contentStyle={[padded && { padding: Space.lg }, contentStyle]}>
      <TextToneProvider value={foreground}>{children}</TextToneProvider>
    </RetroBox>
  );
}
