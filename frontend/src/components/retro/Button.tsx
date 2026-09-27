import { ActivityIndicator, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { Colors, Shadow, Tones, type Tone } from '@/constants/theme';
import { ui } from '@/constants/styles';
import { RetroText } from './Text';
import { RetroIcon, type RetroIconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'danger';

const box = { primary: ui.primaryButton, secondary: ui.secondaryButton, danger: ui.dangerButton } as const;
const label = { primary: ui.primaryButtonText, secondary: ui.secondaryButtonText, danger: ui.dangerButtonText } as const;
const spinner = { primary: Tones.coral.foreground, secondary: Tones.default.foreground, danger: Tones.danger.foreground } as const;

/** Pressed look shared by every button: the button slides onto its shadow. */
const pressedStyle = (offset: number): ViewStyle => ({ ...Shadow.none, transform: [{ translateX: offset }, { translateY: offset }] });

/** Main button. One `primary` (coral) per screen. */
export function RetroButton({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      style={({ pressed }) => [box[variant], pressed && pressedStyle(4), inactive && ui.disabled, style]}
    >
      {loading ? <ActivityIndicator color={spinner[variant]} /> : <RetroText style={label[variant]}>{title}</RetroText>}
    </Pressable>
  );
}

/** Small pill button, for actions inside a row ("Join", "Decline"). */
export function RetroSmallButton({
  title,
  onPress,
  muted,
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  muted?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [muted ? ui.smallButtonMuted : ui.smallButton, pressed && pressedStyle(2), disabled && ui.disabled, style]}
    >
      <RetroText style={muted ? ui.smallButtonMutedText : ui.smallButtonText}>{title}</RetroText>
    </Pressable>
  );
}

/** Round icon button in a tone (e.g. "add"). */
export function RetroIconButton({
  icon,
  onPress,
  tone = 'coral',
  size = 40,
  accessibilityLabel,
}: {
  icon: RetroIconName;
  onPress?: () => void;
  tone?: Tone;
  size?: number;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: Tones[tone].background,
          borderWidth: 2,
          borderColor: Colors.retro.ink,
          alignItems: 'center',
          justifyContent: 'center',
          ...Shadow.sm,
        },
        pressed && pressedStyle(2),
      ]}
    >
      <RetroIcon name={icon} size={size * 0.5} color={Tones[tone].foreground} />
    </Pressable>
  );
}

/** Underlined text link. */
export function RetroLink({ title, onPress, color, style }: { title: string; onPress?: () => void; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="link" style={style}>
      <RetroText style={[ui.linkText, color ? { color } : null]}>{title}</RetroText>
    </Pressable>
  );
}

