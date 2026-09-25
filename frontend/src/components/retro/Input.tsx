import React from 'react';
import { Platform, Pressable, StyleSheet, Switch, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { Border, Colors, Poppins, Radius, Space } from '@/constants/theme';
import { RetroText } from './Text';
import { RetroCard } from './Box';

const C = Colors.retro;

/**
 * Text field with optional label and inline error.
 * Pass `onPress` to get a read-only field that opens something (e.g. a date picker).
 */
export const RetroInput = React.forwardRef<
  TextInput,
  TextInputProps & { label?: string; error?: string; onPress?: () => void; containerStyle?: StyleProp<ViewStyle> }
>(function RetroInput({ label, error, onPress, containerStyle, style, ...rest }, ref) {
  const field = (
    <View style={[styles.box, !!error && { borderColor: C.danger }]}>
      <TextInput
        ref={ref}
        placeholderTextColor={C.textSecondary}
        selectionColor={C.secondary}
        cursorColor={C.secondary}
        {...rest}
        editable={onPress ? false : rest.editable}
        style={[styles.input, style]}
      />
    </View>
  );

  return (
    <View style={containerStyle}>
      {label ? <RetroText variant="label" style={{ marginBottom: Space.sm }}>{label}</RetroText> : null}
      {onPress ? (
        <Pressable onPress={onPress}>
          <View pointerEvents="none">{field}</View>
        </Pressable>
      ) : (
        field
      )}
      {error ? (
        <RetroText variant="small" color={C.danger} style={{ marginTop: Space.xs, marginLeft: Space.xs }}>
          {error}
        </RetroText>
      ) : null}
    </View>
  );
});

/** A card with a title, a hint and an on/off switch. */
export function RetroToggleRow({
  title,
  subtitle,
  value,
  onValueChange,
  style,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <RetroCard style={style} contentStyle={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <RetroText variant="label">{title}</RetroText>
        {subtitle ? <RetroText variant="small" color={C.textSecondary}>{subtitle}</RetroText> : null}
      </View>
      <Switch
        trackColor={{ false: C.switchOff, true: C.secondary }}
        thumbColor={C.backgroundElement}
        ios_backgroundColor={C.switchOff}
        value={value}
        onValueChange={onValueChange}
      />
    </RetroCard>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: C.field, borderWidth: Border.width, borderColor: C.ink, borderRadius: Radius.md },
  input: {
    color: C.text,
    fontFamily: Poppins.regular,
    fontSize: 15,
    paddingHorizontal: Space.lg - 2,
    paddingVertical: Space.md + 1,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
});
