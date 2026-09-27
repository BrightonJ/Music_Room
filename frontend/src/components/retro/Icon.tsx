import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTextTone } from './Text';

export type RetroIconName = ComponentProps<typeof Ionicons>['name'];

/** Ionicons (https://icons.expo.fyi). Default color follows the surrounding tone. */
export function RetroIcon({ name, size = 20, color }: { name: RetroIconName; size?: number; color?: string }) {
  const inherited = useTextTone();
  return <Ionicons name={name} size={size} color={color ?? inherited} />;
}
