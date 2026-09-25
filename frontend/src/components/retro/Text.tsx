import React, { createContext, useContext } from 'react';
import { Text } from 'react-native';
import { Colors, Typography, type TextVariant } from '@/constants/theme';

/** Lets colored surfaces (cards, buttons) set the default text color for everything inside them. */
const TextToneContext = createContext<string>(Colors.retro.text);
export const TextToneProvider = TextToneContext.Provider;

export function RetroText({
  variant = 'body',
  color,
  style,
  ...rest
}: React.ComponentProps<typeof Text> & { variant?: TextVariant; color?: string }) {
  const inherited = useContext(TextToneContext);
  return <Text {...rest} style={[Typography[variant], { color: color ?? inherited }, style]} />;
}

/** Current default text color (set by RetroCard / buttons). Icons use it too. */
export function useTextTone() {
  return useContext(TextToneContext);
}
