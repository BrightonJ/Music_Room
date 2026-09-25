import React from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { Border, Colors, Radius, Space, Tones, type Tone } from '@/constants/theme';
import { RetroBox } from './Box';
import { RetroText, TextToneProvider } from './Text';
import { RetroIcon, type RetroIconName } from './Icon';

const C = Colors.retro;

type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'ghost';
const variantTone: Record<ButtonVariant, Tone> = { primary: 'coral', secondary: 'violet', accent: 'yellow', ghost: 'default' };

/** Main button. `primary` = the one call to action of a screen. */
export function RetroButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  small,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { background, foreground } = Tones[variantTone[variant]];
  return (
    <Pressable onPress={onPress} disabled={disabled} style={style}>
      {({ pressed }) => (
        <RetroBox
          pressed={pressed}
          radius={small ? Radius.md : Radius.lg}
          background={disabled ? C.backgroundSelected : background}
          contentStyle={{
            paddingVertical: small ? Space.sm : Space.lg - 2,
            paddingHorizontal: small ? Space.md : Space.xl - 2,
            alignItems: 'center',
          }}
        >
          <RetroText
            variant="label"
            color={disabled ? C.textSecondary : foreground}
            style={{ fontSize: small ? 13 : 16, textAlign: 'center' }}
          >
            {label}
          </RetroText>
        </RetroBox>
      )}
    </Pressable>
  );
}

/** Round icon button. `md` has the hard shadow (e.g. "add"), `sm` is a flat outlined circle (e.g. vote arrows). */
export function RetroIconButton({
  icon,
  onPress,
  size = 'md',
  tone = 'coral',
  active,
  activeColor = C.success,
}: {
  icon: RetroIconName;
  onPress?: () => void;
  size?: 'sm' | 'md';
  tone?: Tone;
  active?: boolean;
  activeColor?: string;
}) {
  if (size === 'sm') {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={6}
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: Border.thin,
          borderColor: C.ink,
          backgroundColor: active ? activeColor : C.backgroundElement,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <RetroIcon name={icon} size={16} />
      </Pressable>
    );
  }
  const { background, foreground } = Tones[tone];
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      {({ pressed }) => (
        <RetroBox
          pressed={pressed}
          radius={Radius.pill}
          background={background}
          contentStyle={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}
        >
          <RetroIcon name={icon} size={22} color={foreground} />
        </RetroBox>
      )}
    </Pressable>
  );
}

/** Small tappable colored tag, e.g. the "Public / Friends / Private" switcher. */
export function RetroTagButton({
  label,
  tone = 'yellow',
  onPress,
  style,
}: {
  label: string;
  tone?: Tone;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { background, foreground } = Tones[tone];
  return (
    <Pressable onPress={onPress} style={style}>
      {({ pressed }) => (
        <RetroBox
          pressed={pressed}
          radius={Radius.md}
          background={background}
          contentStyle={{ paddingHorizontal: Space.sm + 2, paddingVertical: Space.lg - 1, minWidth: 78, alignItems: 'center' }}
        >
          <TextToneProvider value={foreground}>
            <RetroText variant="small">{label}</RetroText>
          </TextToneProvider>
        </RetroBox>
      )}
    </Pressable>
  );
}

/** Plain text link. */
export function RetroLink({
  label,
  onPress,
  tone = 'secondary',
  style,
}: {
  label: string;
  onPress?: () => void;
  tone?: 'secondary' | 'muted';
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable onPress={onPress} style={style} hitSlop={8}>
      <RetroText
        variant={tone === 'muted' ? 'body' : 'small'}
        color={tone === 'muted' ? C.textSecondary : C.secondary}
        style={{ textDecorationLine: 'underline' }}
      >
        {label}
      </RetroText>
    </Pressable>
  );
}

/** Header action (small outlined pill). */
export function RetroPill({ label, onPress, color }: { label: string; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      {({ pressed }) => (
        <RetroBox pressed={pressed} radius={Radius.pill} shadow={false} contentStyle={{ paddingHorizontal: Space.md, paddingVertical: 7 }}>
          <RetroText variant="small" color={color ?? C.ink}>{label}</RetroText>
        </RetroBox>
      )}
    </Pressable>
  );
}

