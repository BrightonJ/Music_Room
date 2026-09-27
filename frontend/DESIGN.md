# Music Room design system

Retro-modern style: cream paper with a faint grid, ink outlines, hard offset shadows, bold flat colors (coral, violet, yellow, green) and the Poppins font.

All the rules live in **one file**, and everything else is built on top of it:

| Layer | File | Use it for |
|---|---|---|
| 1. Design tokens (colors, tones, typography, spacing, radius, shadows, layout) | [`src/constants/theme.ts`](src/constants/theme.ts) | Changing the look of the whole app |
| 2. Shared styles `ui` | [`src/constants/styles.ts`](src/constants/styles.ts) | Styling a native element (`TextInput`, `TouchableOpacity`...) |
| 3. Room styles `roomStyles` | [`src/components/room/roomStyles.ts`](src/components/room/roomStyles.ts) | The room screen and its modals |
| 4. Components `Retro*` | [`src/components/retro/`](src/components/retro) | **New features: start here** |

Layers 2, 3 and 4 only read values from layer 1, so a change in `theme.ts` reaches every screen.

## Change the look of the whole app

Edit `theme.ts`, nothing else:

- Brand colors: `primary` (coral), `secondary` (violet), `accent` (yellow) in the palette.
- Rounder or sharper corners: `Radius`. Bigger, smaller or no hard shadow: `Shadow`.
- Another font: `FontFamily` + `Type` (and load it in `src/app/_layout.tsx`).
- App name / logo: `RetroBrand` in `src/components/retro/Brand.tsx`.

`Colors.dark` and `Colors.light` still exist as aliases of the retro palette, so older code keeps working.

## Add a screen

Create `src/app/my-feature.tsx` (Expo Router turns the file into a route) and compose `Retro*` components:

```tsx
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Space } from '@/constants/theme';
import { ui } from '@/constants/styles';
import {
  RetroButton, RetroCard, RetroChip, RetroHeader, RetroInput, RetroRow, RetroScreen,
  RetroSectionTitle, RetroSmallButton, RetroText,
} from '@/components/retro';

export default function PlaylistsScreen() {
  const router = useRouter();

  return (
    <RetroScreen>
      <RetroHeader title="Playlists" left={{ label: 'Back', onPress: () => router.back(), tone: 'muted' }} />
      <ScrollView contentContainerStyle={ui.scroll}>
        <RetroInput label="Playlist name" placeholder="Road trip" />

        <RetroSectionTitle>Featured</RetroSectionTitle>
        <RetroCard tone="violet">
          <RetroText variant="heading">Summer hits</RetroText>
          <View style={{ flexDirection: 'row', gap: Space.sm, marginTop: Space.md }}>
            <RetroChip label="Public" />
            <RetroChip label="12 tracks" />
          </View>
        </RetroCard>

        <RetroSectionTitle>Yours</RetroSectionTitle>
        <RetroRow title="Chill" subtitle="8 tracks" right={<RetroSmallButton title="Open" onPress={() => {}} />} />

        <RetroButton title="Create playlist" onPress={() => {}} />
      </ScrollView>
    </RetroScreen>
  );
}
```

That screen already has the paper background, the header, the fonts, the outlines and the shadows, with no style written by hand.

## Components

| Need | Use |
|---|---|
| Screen background (paper + grid, safe area) | `RetroScreen` (pass `edges` like `SafeAreaView`) |
| Header with side actions | `RetroHeader` (same component as `ScreenHeader`) |
| Text | `RetroText variant="display" \| "title" \| "heading" \| "label" \| "body" \| "small"` |
| Colored block | `RetroCard tone="default" \| "muted" \| "violet" \| "yellow" \| "coral" \| "green"`: text and icons inside get the right color |
| Buttons | `RetroButton` (`primary`, `secondary`, `danger`, with `loading`), `RetroSmallButton` (in rows), `RetroIconButton`, `RetroLink` |
| Forms | `RetroInput` (`label`, `error`), `RetroSwitch`, `RetroSegmented`, `DateTimeField` |
| Lists | `RetroRow`, `RetroSectionTitle`, `RetroEmpty` |
| Feedback | `RetroMessage` (success / error), `RetroChip` |
| Decoration | `RetroBrand`, `RetroVinyl`, `RetroHighlight`, `RetroIcon` ([Ionicons](https://icons.expo.fyi)) |
| Something new | Build it from `ui` styles and tokens, put it in `src/components/retro/`, export it from `index.ts` |

## Rules

1. No hex colors, `fontFamily`, `fontWeight` or raw `borderRadius` in screens. Need a new one? Add a token to `theme.ts`.
2. Text styles come from `Type` (or `RetroText variant`). Spacing comes from `Space` (`xs` 4, `sm` 8, `md` 12, `lg` 16, `xl` 20, `xxl` 24, `xxxl` 32).
3. One `primary` (coral) button per screen.
4. Colors that mean something: green = success / active, coral = main action / vote down, yellow = selected / highlight, red (`danger`) = destructive.
