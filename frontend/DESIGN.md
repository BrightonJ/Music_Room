# Music Room design system

The whole look of the app (colors, fonts, spacing, outlines, shadows) lives in **two places**.
Screens never define their own colors, fonts or borders: they compose ready-made components.

| What | Where |
|---|---|
| Design tokens (colors, tones, typography, spacing, shapes, layout) | [`src/constants/theme.ts`](src/constants/theme.ts) |
| Component kit (`Retro*`) | [`src/components/retro/`](src/components/retro) |

Screens import **only** from `@/components/retro`, plus `Space` / `Colors` from the theme when they need a gap.

## Change the look of the whole app

Edit `theme.ts`, nothing else:

- Different brand color: `primary`, `secondary`, `accent` in `Colors`.
- Rounder or sharper corners: `Radius`. Softer or no hard shadow: `Shadow.offset`.
- Another font: `Poppins` + `Typography` (and load it in `src/app/_layout.tsx`).
- App name / logo: `RetroBrand` in `components/retro/Brand.tsx`.

## Add a screen

Create `src/app/friends.tsx` (Expo Router turns the file into a route) and start from `RetroPage`:

```tsx
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Space } from '@/constants/theme';
import {
  RetroPage, RetroSection, RetroListItem, RetroAvatar, RetroButton, RetroIconButton, RetroEmptyState,
} from '@/components/retro';

export default function FriendsScreen() {
  const router = useRouter();
  const friends = [{ id: 1, name: 'Ada' }];

  return (
    <RetroPage
      title="Friends"
      left={{ label: 'Back', onPress: () => router.back() }}
      footer={<RetroButton label="Invite a friend" onPress={() => {}} />}
    >
      <RetroSection title="Your friends">
        {friends.length === 0 ? (
          <RetroEmptyState icon="people" message="No friends yet." />
        ) : (
          friends.map((f) => (
            <RetroListItem
              key={f.id}
              style={styles.item}
              leading={<RetroAvatar label={f.name[0]} />}
              title={f.name}
              trailing={<RetroIconButton icon="chatbubble" onPress={() => {}} />}
            />
          ))
        )}
      </RetroSection>
    </RetroPage>
  );
}

const styles = StyleSheet.create({ item: { marginBottom: Space.md } });
```

That screen already has the paper background, the header, the padding, the max width and the fonts.

## Components

| Need | Use |
|---|---|
| Screen (header, padding, scroll, pinned button) | `RetroPage` (`scroll={false}` if you render your own `FlatList`, `centered` for login-like screens) |
| Text | `RetroText variant="title" \| "heading" \| "label" \| "body" \| "small"` |
| Colored block | `RetroCard tone="default" \| "violet" \| "yellow" \| "coral" \| "green"`. Text and icons inside inherit the right color. |
| Buttons | `RetroButton` (`primary`, `secondary`, `accent`, `ghost`), `RetroIconButton`, `RetroTagButton`, `RetroLink` |
| Forms | `RetroInput` (`label`, `error`, `onPress` for pickers), `RetroToggleRow` |
| Lists | `RetroListItem` (+ `RetroCover`, `RetroAvatar`), `RetroSection`, `RetroEmptyState` |
| Feedback | `RetroBanner`, `RetroChip`, `RetroProgress` |
| Decoration | `RetroBrand`, `RetroVinyl`, `RetroHighlight`, `RetroDivider`, `RetroIcon` (Ionicons) |
| Something new | Build it from `RetroBox` (outline + hard shadow) and put it in `components/retro/`, then export it from `index.ts` |

## Rules

1. No hex colors, `fontSize`, `fontFamily`, `borderRadius` or `borderWidth` in screens. If you need one, add a token to `theme.ts`.
2. Spacing comes from `Space` (`xs` 4, `sm` 8, `md` 12, `lg` 16, `xl` 20, `xxl` 24, `xxxl` 32). `Spacing` is legacy Expo-template code.
3. One `primary` (coral) button per screen.
4. Colors that mean something: green = success / public, coral = danger / private, yellow = highlight / friends.
