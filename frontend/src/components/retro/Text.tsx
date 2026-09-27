import { createContext, useContext, type ComponentProps } from 'react';
import { Text } from 'react-native';
import { Colors, Type, type TypeVariant } from '@/constants/theme';

/** Colored surfaces (cards, buttons) set the default text color of everything inside them. */
const TextToneContext = createContext<string>(Colors.retro.text);
export const TextToneProvider = TextToneContext.Provider;

/** Current default text color. Icons use it too. */
export function useTextTone() {
  return useContext(TextToneContext);
}

/** Text with a typography variant from the theme. Color defaults to the surrounding tone. */
export function RetroText({
  variant = 'body',
  color,
  style,
  ...rest
}: ComponentProps<typeof Text> & { variant?: TypeVariant; color?: string }) {
  const inherited = useTextTone();
  return <Text {...rest} style={[Type[variant], { color: color ?? inherited }, style]} />;
}
