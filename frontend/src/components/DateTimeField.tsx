import { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Colors, Outline, Radius, Space, Type } from '@/constants/theme';
import { ui } from '@/constants/styles';
import { formatDate, formatDateTime } from '@/lib/dates';

type Props = {
  value: Date | null;
  onChange: (date: Date) => void;
  mode: 'date' | 'datetime';
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  hasError?: boolean;
};

// Same field on both platforms:
//  - iOS: inline spinner below the field (supports date + time in one picker)
//  - Android: system dialogs; "datetime" opens the date dialog then the time dialog
export default function DateTimeField({ value, onChange, mode, placeholder = 'Select', minimumDate, maximumDate, hasError }: Props) {
  const [iosOpen, setIosOpen] = useState(false);
  const label = value ? (mode === 'date' ? formatDate(value) : formatDateTime(value)) : placeholder;
  const initial = value ?? (mode === 'date' ? new Date(2000, 0, 1) : new Date());

  const openAndroid = () => {
    DateTimePickerAndroid.open({
      value: initial,
      mode: 'date',
      minimumDate,
      maximumDate,
      onChange: (event: DateTimePickerEvent, date?: Date) => {
        if (event.type !== 'set' || !date) return;
        if (mode === 'date') {
          onChange(date);
          return;
        }
        const day = date;
        // Opening the second dialog from the first one's callback needs a tick
        setTimeout(() => {
          DateTimePickerAndroid.open({
            value: day,
            mode: 'time',
            is24Hour: true,
            onChange: (timeEvent: DateTimePickerEvent, time?: Date) => {
              if (timeEvent.type !== 'set' || !time) return;
              const merged = new Date(day);
              merged.setHours(time.getHours(), time.getMinutes(), 0, 0);
              onChange(merged);
            },
          });
        }, 50);
      },
    });
  };

  const onPress = () => {
    if (Platform.OS === 'android') openAndroid();
    else {
      if (!value) onChange(initial);
      setIosOpen((open) => !open);
    }
  };

  return (
    <View>
      <TouchableOpacity style={[ui.input, hasError && ui.inputError]} onPress={onPress} accessibilityRole="button">
        <Text style={{ ...Type.input, color: value ? Colors.retro.text : Colors.retro.textSecondary }}>{label}</Text>
      </TouchableOpacity>
      {Platform.OS === 'ios' && iosOpen ? (
        <View style={styles.iosPanel}>
          <DateTimePicker
            value={initial}
            mode={mode}
            display="spinner"
            themeVariant="light"
            textColor={Colors.retro.text}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(event: DateTimePickerEvent, date?: Date) => {
              if (date) onChange(date);
            }}
          />
          <TouchableOpacity style={styles.done} onPress={() => setIosOpen(false)}>
            <Text style={ui.linkText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  iosPanel: { backgroundColor: Colors.retro.backgroundElement, ...Outline, borderRadius: Radius.md, marginTop: Space.sm, paddingBottom: Space.sm },
  done: { alignItems: 'center', paddingVertical: Space.sm },
});
