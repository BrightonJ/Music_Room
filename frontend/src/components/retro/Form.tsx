import { forwardRef } from 'react';
import { Pressable, Switch, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';
import { ui } from '@/constants/styles';
import { RetroText } from './Text';

const C = Colors.retro;

/** Text field with an optional label and inline error. */
export const RetroInput = forwardRef<TextInput, TextInputProps & { label?: string; error?: string; containerStyle?: StyleProp<ViewStyle> }>(
  function RetroInput({ label, error, containerStyle, style, ...rest }, ref) {
    return (
      <View style={containerStyle}>
        {label ? <RetroText style={ui.label}>{label}</RetroText> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={C.textSecondary}
          selectionColor={C.secondary}
          cursorColor={C.secondary}
          {...rest}
          style={[ui.input, !!error && ui.inputError, style]}
        />
        {error ? <RetroText style={ui.fieldError}>{error}</RetroText> : null}
      </View>
    );
  }
);

/** On/off switch in the theme colors. */
export function RetroSwitch({ value, onValueChange }: { value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: C.switchOff, true: C.secondary }}
      thumbColor={C.backgroundElement}
      ios_backgroundColor={C.switchOff}
    />
  );
}

/** Segmented control: pick one option out of a few. */
export function RetroSegmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={ui.segment}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            style={[ui.segmentItem, active && ui.segmentItemActive]}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
          >
            <RetroText style={[ui.segmentText, active && ui.segmentTextActive]}>{option.label}</RetroText>
          </Pressable>
        );
      })}
    </View>
  );
}
