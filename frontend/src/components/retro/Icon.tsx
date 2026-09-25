import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useTextTone } from './Text';

export type RetroIconName = React.ComponentProps<typeof Ionicons>['name'];

/** Icons come from Ionicons (https://icons.expo.fyi). Default color follows the surrounding tone. */
export function RetroIcon({ name, size = 22, color }: { name: RetroIconName; size?: number; color?: string }) {
  const inherited = useTextTone();
  return <Ionicons name={name} size={size} color={color ?? inherited} />;
}
