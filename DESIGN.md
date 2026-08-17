# Design system

Sketch Studios' visual identity is adapted from the "Aura Platform" source template
(Neuform Featured templates, author Sourasith Phomhome / @madebysourasith). The source is a
web marketing hero section (WebGL/Three.js background, nav + pricing CTA) — not applicable
content-wise to a mobile knowledge-explorer app — so only its **design tokens** (color,
typography, spacing, radii) were carried over and adapted for React Native / Expo. WebGL/canvas
effects and the marketing copy/navigation structure were dropped.

Implemented in `src/constants/theme.ts`. Always consume colors via `useTheme()`
(`src/hooks/use-theme.ts`) rather than importing `Colors` directly, so components respond to
the user's light/dark/system preference.

## Source template reference

| Frontmatter | Value |
| --- | --- |
| version | `neuform-top-creators-featured` |
| name | Aura Platform |
| primary | `#FF5C00` |
| secondary | `#666666` |
| accent | `#E55300` |
| background | `#F8F9F9` |
| surface | `#666666` |
| text-primary | `#111827` |
| text-secondary | `#4B5563` |
| border | `#666666` |
| spacing.base | `8px` |
| spacing.gap | `16px` |
| spacing.card-padding | `24px` |
| spacing.section-padding | `80px` |
| radii.card | `8px` |
| radii.control | `8px` |
| radii.pill | `9999px` |
| type | Inter (display), Playfair Display (body), JetBrains Mono (labels/metadata) |

## Adaptation notes

- **Neutral scale**: `text-primary` (`#111827`) and `text-secondary` (`#4B5563`) are exact
  Tailwind Gray 900/600 values, and `background` (`#F8F9F9`) is a near match for Gray 50. The
  full Tailwind Gray scale was adopted as the app's `ink` scale so every neutral tier
  (surfaces, borders, text) stays coherent instead of only having the three customized stops.
- **`border` / `secondary` / `surface` all given as the same flat `#666666`** in the source —
  read as an unset placeholder rather than a deliberate choice (a UI where body text,
  secondary surfaces, and hairline borders are all identical mid-gray would look broken). The
  app instead uses a two-tier border system consistent with the neutral scale: `border` =
  Gray 200 (subtle hairline), `borderStrong` = Gray 300 (emphasized). `secondary`/`surface`
  map to the same neutral scale rather than a flat swatch.
- **Brand orange**: `primary` (`#FF5C00`) and `accent` (`#E55300`) anchor a full 50–800 orange
  ramp (`Brand` in `theme.ts`) for hover/press/soft states and dark-mode contrast, the same
  way the app's previous cobalt brand ramp worked.
- **Dark mode** wasn't specified by the source (it's a light-only marketing page). The app's
  existing light/dark structure was preserved: dark mode reuses the same neutral/orange scales
  at inverted tiers (e.g. accent = `Brand[400]` `#FF7A33`, brighter than the light-mode primary
  for contrast against the near-black background).
- **Typography**: source calls for Inter on display moments and Playfair Display on body
  copy — an unusual pairing (serif body, sans display) but applied as specified. JetBrains
  Mono (already bundled) continues to serve labels, breadcrumbs, specs, and formulas.
- **Spacing/radii**: `base` (8), `gap` (16), and `card-padding` (24) already matched the
  app's existing spacing scale numerically, so no rescale was needed. `section-padding` (80)
  was added as `Spacing.section` for large vertical breaks between screen sections.
  `radii.card`/`control` (8) and `radii.pill` (9999) already matched `Radii.sm` and
  `Radii.full`.
- **Dropped**: WebGL/Three.js hero background, canvas particle/gradient effects, and the
  marketing nav/copy ("Login / Docs / Plans", "Explore Platform" CTA) — none apply to a
  native mobile app and Expo Go has no practical WebGL/Three.js support.

## Colors

`Ink` (neutral) and `Brand` (orange) scales live in `theme.ts`; `Colors.light` / `Colors.dark`
resolve semantic roles (`background`, `text`, `border`, `accent`, etc.) from them.

| Role | Light | Dark |
| --- | --- | --- |
| background | `#F9FAFB` | `#030712` |
| backgroundElement (card) | `#FFFFFF` | `#111827` |
| text | `#111827` | `#FFFFFF` |
| textSecondary | `#374151` | `#E5E7EB` |
| border | `#E5E7EB` | `#1F2937` |
| accent | `#FF5C00` | `#FF7A33` |
| accentHover | `#E55300` | `#FF9C5C` |

Status colors (`danger`/`success`/`warning`/`info`) are unchanged from the previous palette —
they're functional, not brand-identity tokens.

## Typography

| Token | Font | Use |
| --- | --- | --- |
| `Fonts.display` / `displayMedium` | Inter 600/500 | Headings, wordmark |
| `Fonts.body` / `bodyMedium` / `bodySemiBold` | Playfair Display 400/500/600 | UI/body text |
| `Fonts.mono` / `monoRegular` | JetBrains Mono 500/400 | Labels, breadcrumbs, specs, formulas |

Loaded via `expo-font`'s `useFonts()` in `src/app/_layout.tsx`.

## Spacing & radii

`Spacing` (`theme.ts`): `half` 2 · `one` 4 · `two` 8 (base) · `three` 16 (gap) · `four` 24
(card padding) · `five` 32 · `six` 64 · `section` 80.

`Radii` (`theme.ts`): `sm` 8 (card/control) · `md` 12 · `lg` 16 · `xl` 22 · `full` 999 (pill).

## Not yet updated

The splash screen and Android adaptive-icon background colors in `app.json` were updated to
the new orange brand, but the underlying icon/splash **image assets**
(`assets/images/icon.png`, `splash-icon.png`, `android-icon-*.png`) still contain the old
artwork and need a separate design pass to match the new brand.
