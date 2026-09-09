# Sketch Studios — SwiftUI Rebuild Specification

**Audience:** an autonomous coding agent (Apple "Coding Intelligence" in Xcode, or equivalent).
**Goal:** recreate the existing Expo / React Native app as a **native SwiftUI iOS app** —
identical product, screens, features, visual design, motion, and behaviour. Same backend, same
AI providers, same prompts.

This document is self-contained. Where it says "see `path`", that file is in this repository
and can be read for the exact literal string (long AI prompts especially). Everything the app
*does* is specified here.

---

## 0. How to use this document

1. Read §1–§3 to understand the product and the target stack.
2. Scaffold the Xcode project per §4, drop in the design system (§5) and motion system (§6).
3. Build the data + backend + AI layers (§7–§11) — these are pure logic, no UI, and are the
   riskiest part to get right. Port them faithfully.
4. Build screens in the order of the milestone plan (§18), each against its spec in §14.
5. Verify against the acceptance checklist (§19). "Done" = every box ticked.

**Non-negotiables:** the visual design (§5), the motion character (§6, §13), the AI prompts and
request shapes (§10), and the feature set (§1) must match. Implementation details (view-model
style, file layout) are yours to choose within §4's structure.

---

## 1. Product specification

Sketch Studios is a **visual knowledge engine**. A user searches for any object, structure,
machine, mechanism, or technical concept and gets:

- a **generated technical cutaway illustration** (an "infographic": a labelled 3D cutaway plus
  a materials panel and a construction-sequence panel), and
- **structured, explorable knowledge**: components, what each is / does / why it exists /
  what it's made of, how the components relate, how the whole thing works (prose + a flow
  chart), a construction sequence, materials with specs, the governing physics + a formula,
  common failure modes, and sources.

### Core loop

```
Search a term
  → keyword-match existing topics
      → if matches: show a results list; user opens one OR taps "Generate new sketch"
      → if no matches: run the generation pipeline directly
  → generation pipeline (5 visible phases) produces a Topic + Components + Relationships + image
  → land on the Topic screen
      → tap a component (in the list, or a hotspot on the image) → Component detail sheet
          → "Ask about this"  → Chat sheet, scoped to that component
          → "Generate new sketch for X" → recursively generate a Topic for that component
                                          (drill-down; breadcrumb trail grows)
      → chat FAB → Chat sheet scoped to the whole topic
      → bookmark toggle
      → image: pinch-zoom inline, open fullscreen (zoom / rotate-to-landscape), save to Photos
```

### Secondary features

- **Scan an object**: camera → photograph → a vision model names the subject → that name runs
  through the normal search/generate pipeline. Library-photo fallback.
- **Bookmarks** screen (list of saved topics).
- **Recent** topics on Home (distinct-by-topic, from search history).
- **Suggested topics** marquee on Home (a fixed list, three auto-scrolling rows).
- **Settings**: light / dark / system theme; read-only display of the two AI model names;
  account info (name derived from email, email, member-since); sign out.
- **Auth**: email + password sign-in / sign-up (Supabase Auth). Sign-up requires email
  confirmation before sign-in works.

### Explicitly out of scope (already removed from the RN app)

Semantic / vector search, near-duplicate detection, a dynamic "Suggested topics" section,
content moderation, multi-provider model switching, Edge Functions / any custom backend.

---

## 2. Target stack

| Concern | Choice | Notes |
| --- | --- | --- |
| Language | **Swift 6**, strict concurrency | |
| UI | **SwiftUI**, iOS **18.0** minimum | Single target, no UIKit screens; `UIViewRepresentable` only where noted (camera preview, zoomable image scroll view). |
| Architecture | `@Observable` view models + `async/await` repositories (actors) | No third-party state library. Mirrors the RN app's "the client *is* the process" model — no realtime, no server. |
| Navigation | `NavigationStack` + a typed `NavigationPath` / route enum | Replaces expo-router. |
| Backend | **`supabase-swift`** (`supabase/supabase-swift`) — Auth + PostgREST + Storage | Same Supabase project as the RN app. Schema already exists (§8). |
| Networking (AI) | `URLSession` async APIs | Direct calls to Anthropic + Google, exactly as the RN app (§10). |
| JSON | `Codable` structs | Replaces `zod`; validation becomes decoding + small guards. |
| Images (remote) | Custom `URLCache`-backed async loader, or Nuke | `AsyncImage` is acceptable for v1 but has no disk cache; topic images are large. |
| Keychain | `Security` framework wrapper (or `KeychainAccess`) | Supabase session token. No AES-in-AsyncStorage hack needed — Keychain has no 2 KB limit for a single item the way `expo-secure-store` did. |
| Haptics | `UIImpactFeedbackGenerator` / `UISelectionFeedbackGenerator` / `UINotificationFeedbackGenerator`, or `.sensoryFeedback` | §6. |
| Blur / material | Native `Material` (`.ultraThinMaterial` etc.) | Replaces `expo-blur`. |
| Fonts | Bundled TTFs (§5.2) | Same three families. |

### Native-equivalent mapping (RN → SwiftUI)

| RN / Expo | SwiftUI native |
| --- | --- |
| expo-router `Stack`, `router.push` | `NavigationStack(path:)`, `path.append(route)` |
| `@gorhom/bottom-sheet` `BottomSheetModal`, `snapPoints` | `.sheet` + `.presentationDetents([...])` + `.presentationDragIndicator(.visible)` |
| Reanimated `withSpring({ duration, dampingRatio })` | `.animation(.spring(duration:bounce:), value:)` — see §6 for the exact mapping |
| Reanimated `withTiming(v, { duration, easing })` | `.animation(.timingCurve(...) or .easeOut(duration:), value:)` |
| `FadeIn` / `FadeInDown` entrance + stagger | `.transition(.opacity.combined(with: .offset(y: 8)))` + per-index `.delay` |
| `PressableScale` | a custom `ButtonStyle` (§6.3) |
| expo-haptics | feedback generators / `.sensoryFeedback` (§6.4) |
| expo-blur `BlurView` | `.background(.ultraThinMaterial, in: ...)` |
| `useReducedMotion()` | `@Environment(\.accessibilityReduceMotion)` |
| `useReduceTransparency()` | `@Environment(\.accessibilityReduceTransparency)` |
| expo-camera `CameraView` | `AVCaptureSession` + `AVCaptureVideoPreviewLayer` via `UIViewRepresentable` |
| expo-image-picker | `PhotosPicker` (SwiftUI) |
| expo-image-manipulator (downscale + JPEG) | `UIImage` / `CGContext` resize + `jpegData(compressionQuality:)` |
| expo-media-library (save to Photos) | `PHPhotoLibrary.shared().performChanges { PHAssetCreationRequest.forAsset()... }` |
| `react-native-svg` Logomark | `Canvas` / `Path` (dashed stroked circle + filled dot) |
| `@tanstack/react-query` (cache, invalidation, `useFocusEffect` refetch) | repository + `@Observable` store; refetch in `.task(id:)` / `.onAppear`; a tiny in-memory cache keyed like the RN query keys |
| `zod` schema `.safeParse` | `Codable` decode in a `do/catch`; on failure throw the same "unexpected response" error |
| `expo-splash-screen` | `LaunchScreen` storyboard / SwiftUI launch, hide when fonts + session resolved |
| Expo env `EXPO_PUBLIC_*` | `.xcconfig` + `Info.plist` keys, read at launch (§17) |

---

## 3. Backend reuse

**The Supabase backend is reused unchanged.** It is a plain Postgres + Auth + Storage project
with a REST (PostgREST) interface and row-level security; nothing about it is RN-specific. The
SwiftUI app points `supabase-swift` at the **same project URL and anon key** and works
immediately. Schema, RLS policies, and the storage bucket are documented in §8 for reference and
in `supabase/migrations/*.sql` verbatim — do **not** re-run migrations, the tables already exist.

Every table/type/function/index/policy/bucket is prefixed **`visualpedia_`** (the project is
shared with other apps). Always go through the constants in §8.3, never hardcode names.

---

## 4. Xcode project structure

```
SketchStudios/
  App/
    SketchStudiosApp.swift          // @main, root scene, providers/environment
    RootView.swift                  // splash gate → Auth flow | App flow
    AppEnvironment.swift            // DI container: repositories, services, auth
  DesignSystem/
    Theme.swift                     // color tokens (light/dark), Radii, Spacing
    Typography.swift                // text styles (display, body, mono, label, …)
    Fonts/                          // Inter, SpaceGrotesk, JetBrainsMono TTFs
    Motion.swift                    // spring/timing/duration tokens, project(), rubberband()
    Haptics.swift                   // Haptics.selection() / .impact() / .success() / .error()
    Components/
      ScaleButtonStyle.swift        // = PressableScale
      BlurSurface.swift             // translucent chrome + reduce-transparency fallback
      Logomark.swift
      ProgressBarView.swift
      ThemedText helpers (or use Typography modifiers directly)
  Models/
    Knowledge.swift                 // Topic, TopicComponent, ComponentRelationship, StructuredKnowledge, …
    Generation.swift                // GenerationStatus, Generation
    DTOs.swift                      // row structs (snake_case CodingKeys) + mappers
  Backend/
    SupabaseClient.swift            // configured client singleton/actor
    Tables.swift                    // name constants
    AuthService.swift
    TopicsRepository.swift
    SearchRepository.swift
    BookmarksRepository.swift
    HistoryRepository.swift
    ChatRepository.swift
    StorageService.swift            // upload/get-public-url for topic images
  AI/
    AIError.swift                   // = ApiError + throwCleanApiError + GENERIC_ERROR_MESSAGE
    AnthropicClient.swift           // messages API: knowledge (tool call), chat, vision
    GeminiClient.swift              // generateContent: infographic image
    KnowledgeGenerator.swift        // = llm.ts (prompt + JSON schema + decode)
    ChatGenerator.swift             // = chat.ts
    VisionClient.swift              // = vision.ts (askVisionJson)
    SubjectIdentifier.swift         // = identify.ts
    HotspotDetector.swift           // = hotspots.ts
    InfographicPrompt.swift         // = image.ts prompt builder (port verbatim)
  Services/
    GenerationPipeline.swift        // = services/generation.ts runGeneration()
    GenerationController.swift       // = hooks/use-generation.ts (@Observable phase machine)
    ImageDownloader.swift           // save-to-Photos, cache
    ImageProcessing.swift           // downscale + JPEG for the camera path
    Logger.swift                    // structured, prints full detail to the Xcode console
  State/
    ThemeStore.swift                // @Observable, persisted preference (light/dark/system)
    PendingScan.swift               // one-shot camera→Home handoff
    ToastCenter.swift               // @Observable transient message
  Features/
    Auth/ SignInView.swift  SignUpView.swift
    Home/ HomeView.swift  HomeViewModel.swift  SuggestedMarqueeView.swift
          RecentRowView.swift  GenerationProgressView.swift  ErrorBannerView.swift
    Topic/ TopicView.swift  TopicViewModel.swift  TabsView.swift  FlowChainView.swift
           ComponentDetailSheet.swift  ChatSheet.swift  ZoomableImageView.swift
           FullscreenImageViewer.swift
    Camera/ CameraView.swift  CameraModel.swift  CameraPreview.swift (UIViewRepresentable)
    Bookmarks/ BookmarksView.swift
    Settings/ SettingsView.swift
  Resources/
    Info.plist, *.xcconfig, Assets.xcassets (app icon, colors optional), LaunchScreen
  Tests/
    SlugTests, HotspotClampTests, IdentifyNormalizeTests, DTOMapperTests, AIErrorTests
```

---

## 5. Design system

Source of truth in the RN app: `src/constants/theme.ts` and `src/components/themed-text.tsx`.

### 5.1 Colour tokens

Two resolved palettes. Expose as a `Theme` struct with a `Color` for each token; select by the
user's preference (`light` / `dark` / `system` → resolve against `colorScheme`). Do **not** rely
only on `@Environment(\.colorScheme)` — the app has an explicit override (§ThemeStore).

Base ramps:

```
ink   0 #ffffff · 50 #f9fafb · 100 #f3f4f6 · 200 #e5e7eb · 300 #d1d5db · 400 #9ca3af
      500 #6b7280 · 600 #4b5563 · 700 #374151 · 800 #1f2937 · 850 #18202f · 900 #111827 · 950 #030712
brand 50 #fff3ec · 100 #ffe1cc · 200 #ffc299 · 300 #ff9c5c · 400 #ff7a33 · 500 #ff5c00
      600 #e55300 · 700 #c24700 · 800 #9c3900 · glow rgba(255,92,0,0.28)
green 500 #17935a · 600 #0f7a49 · 50 #e9f6ef
red   500 #d64545 · 600 #bd3535 · 50 #fbecec
amber 500 #c07d12 · 600 #9c6310 · 50 #fbf2e2
blue  500 #2563c9 · 600 #1d4fa6 · 50 #eaf1fb
```

| token | light | dark |
| --- | --- | --- |
| `background` | ink50 | ink950 |
| `backgroundElement` (cards / raised) | ink0 | ink900 |
| `backgroundSunken` (recessed / selected) | ink100 | ink850 |
| `backgroundSelected` | ink100 | ink800 |
| `backgroundInverse` | ink900 | ink50 |
| `overlay` (scrim) | rgba(10,12,16,0.5) | rgba(0,0,0,0.6) |
| `text` | ink900 | ink0 |
| `textSecondary` | ink700 | ink200 |
| `textMuted` | ink500 | ink400 |
| `textFaint` | ink400 | ink500 |
| `textInverse` | ink0 | ink900 |
| `border` | ink200 | ink800 |
| `borderStrong` | ink300 | ink700 |
| `accent` | brand500 | brand400 |
| `accentHover` | brand600 | brand300 |
| `accentPress` | brand700 | brand200 |
| `accentSoft` | brand50 | brand800 |
| `danger` | red500 | red500 |
| `success` | green500 | green500 |
| `warning` | amber500 | amber500 |
| `info` | blue500 | blue500 |
| `statusPassFg` | green600 | green500 |
| `statusPassBg` | green50 | green600 |
| `statusFailFg` | red600 | red500 |
| `statusFailBg` | red50 | red600 |

`MaxContentWidth = 800` pt (centre columns cap at this on large screens / iPad).

### 5.2 Typography

Three bundled families. Register in `Info.plist` (`UIAppFonts`) and load.

- **Space Grotesk** — headings, wordmark. Weights: 500 Medium, 600 SemiBold.
- **Inter** — body / UI. Weights: 400, 500, 600.
- **JetBrains Mono** — breadcrumbs, specs, formulas, small captions. Weights: 400, 500.

Text styles (size / line-height / tracking). Tracking is **size-specific** — this is deliberate
(Apple type guidance): large display text gets negative tracking, body stays at ~0.

| style | font | size | line height | tracking |
| --- | --- | --- | --- | --- |
| `display` (H2) | SpaceGrotesk 600 | 30 | 35 | −0.6 |
| `displaySm` (H3) | SpaceGrotesk 600 | 22 | 27 | −0.35 |
| `wordmark` | SpaceGrotesk 600 | 17 | 22 | −0.2 |
| `body` | Inter 400 | 16 | 23 | 0 |
| `bodyLg` (tagline) | Inter 400 | 17 | 25 | 0 |
| `bodyMedium` | Inter 500 | 16 | 23 | 0 |
| `bodySemiBold` | Inter 600 | 16 | 22 | 0 |
| `label` (overline) | Inter 600 | 11.5 | 16 | 0.8, UPPERCASED |
| `small` | Inter 400 | 13.5 | 19 | 0 |
| `mono` | JetBrainsMono 500 | 11 | 15 | 0.2 |
| `link` | Inter 500 | 14 | 20 | 0 |

Implement as `Text` extensions / a `ViewModifier` per style. Respect Dynamic Type where
practical (scale with `@ScaledMetric` or `.font(.custom(_, size:relativeTo:))`), but the RN app
uses fixed sizes — matching the fixed sizes first is acceptable, then layer Dynamic Type.

### 5.3 Spacing & radii

```
Spacing: half 2 · one 4 · two 8 · three 16 · four 24 · five 32 · six 64 · section 80
Radii:   sm 8 · md 12 · lg 16 · xl 22 · full 999
```

### 5.4 Iconography

The RN app uses **Ionicons** (`@expo/vector-icons`). Map each to the closest **SF Symbol**:

| Ionicons | SF Symbol |
| --- | --- |
| `search` | `magnifyingglass` |
| `camera-outline` | `camera` |
| `bookmark` / `bookmark-outline` | `bookmark.fill` / `bookmark` |
| `person-circle-outline` | `person.crop.circle` |
| `chevron-back` | `chevron.left` |
| `chevron-forward` | `chevron.right` |
| `close` | `xmark` |
| `checkmark` / `checkmark-circle` | `checkmark` / `checkmark.circle.fill` |
| `alert-circle` / `alert-circle-outline` | `exclamationmark.circle.fill` / `exclamationmark.circle` |
| `sparkles` | `sparkles` |
| `chatbubble-ellipses` | `bubble.left.and.text.bubble.right.fill` (or `ellipsis.bubble.fill`) |
| `send` | `paperplane.fill` |
| `expand-outline` | `arrow.up.left.and.arrow.down.right` |
| `phone-landscape-outline` | `rectangle.landscape.rotate` (or `iphone.landscape`) |
| `download-outline` | `square.and.arrow.down` |
| `images-outline` | `photo.on.rectangle` |
| `camera-reverse-outline` | `arrow.triangle.2.circlepath.camera` |
| `mail-outline` | `envelope` |
| `calendar-outline` | `calendar` |

### 5.5 Logomark

`src/components/logomark.tsx`: a square SVG, size `s`. A **dashed stroked circle**, radius
`s/2 − 1.5`, stroke width 1.5, dash pattern `[3, 3]`, colour `brand500`, no fill; **plus a
filled dot** at centre, radius `s * 0.19`, colour `brand500`. Recreate with `Canvas`/`Path`.
Default size 26; auth screens use 32.

### 5.6 App icon / splash

- App icon: `assets/expo.icon/` + `assets/images/icon.png` (reuse the artwork).
- Splash / launch: brand background `#FF5C00`, centred `assets/images/splash-icon.png` at
  76 pt wide. Recreate as a `LaunchScreen` (solid `#FF5C00`, centred logo). Hide once fonts are
  loaded **and** the auth session has resolved (§9).

---

## 6. Motion system

The RN app follows two design skills — Apple's *Designing Fluid Interfaces* principles and an
"animate in React Native" construction guide. SwiftUI is the native home of exactly this model,
so the port is direct. Source: `src/lib/motion.ts`, `src/components/pressable-scale.tsx`,
`src/hooks/use-haptics.ts`.

### 6.1 Principles to preserve

- **Respond on touch-down**, not on release. Press feedback is instant.
- **Interruptible & velocity-aware.** Springs, not fixed-duration curves, for anything a finger
  drives; a gesture reversed mid-flight must follow the finger. SwiftUI springs are interruptible
  by default — animate the *value*, never a one-shot.
- **Springs for gesture-driven motion; timing curves for everything else.**
- **Bounce only after momentum.** A menu that faded in does not overshoot; a card you flicked
  does.
- **Enter and exit along the same path** (a sheet that comes up from the bottom leaves to the
  bottom; a toast that drops in drops out).
- **Reduced Motion**: replace slides / springs / parallax with a short opacity cross-fade; drop
  overshoot; keep colour/opacity changes that explain state. Screen transitions become a fade.
- **Reduced Transparency**: blur surfaces become solid.
- **Haptics**: one per user action, on the *causal* frame, always paired with a visible change,
  never on scroll.

### 6.2 Tokens (`Motion.swift`)

The RN values use Apple's two spring parameters directly. SwiftUI's `Spring(duration:bounce:)`
maps 1:1 — `dampingRatio 1.0 → bounce 0`, `dampingRatio 0.8 → bounce ≈ 0.2`.

```swift
enum Motion {
    // springs (anything a finger touched)
    static let springDefault  = Animation.spring(duration: 0.40, bounce: 0)      // critically damped
    static let springMomentum = Animation.spring(duration: 0.40, bounce: 0.20)   // slight overshoot after a flick
    static let springSheet     = Animation.spring(duration: 0.30, bounce: 0.20)

    // timing curves (no finger)
    static let easeOut    = Animation.timingCurve(0.23, 1, 0.32, 1, duration: 0.25)  // strong ease-out for UI
    static let easeInOut  = Animation.timingCurve(0.77, 0, 0.175, 1, duration: 0.25) // on-screen movement
    static let easeSheet  = Animation.timingCurve(0.32, 0.72, 0, 1, duration: 0.30)  // iOS sheet curve

    // durations (seconds)
    static let press = 0.12, toggle = 0.18, enter = 0.25, toastIn = 0.30, toastOut = 0.24
    static let stagger = 0.045   // per list-index delay
}

// Where a flick comes to rest (used by drag-to-dismiss decisions). Apple's exponential-decay form.
func project(_ velocity: Double, decelerationRate: Double = 0.998) -> Double {
    (velocity / 1000) * decelerationRate / (1 - decelerationRate)
}
// Progressive resistance past a boundary (rubber-banding).
func rubberband(_ overshoot: Double, dimension: Double, constant: Double = 0.55) -> Double {
    (overshoot * dimension * constant) / (dimension + constant * abs(overshoot))
}
```

Every animation that reads `@Environment(\.accessibilityReduceMotion)` should collapse to
`Motion.easeOut`-ish opacity only (or `nil` for instant) and drop `offset`/`scale`/`bounce`.

### 6.3 `ScaleButtonStyle` (= `PressableScale`)

Every tappable that isn't a system control uses this. Wrap tappables in `Button` and apply it.

```swift
struct ScaleButtonStyle: ButtonStyle {
    var scale: CGFloat = 0.97          // 0.92 for large targets (FAB, camera shutter)
    var haptic: HapticKind? = nil
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(reduceMotion ? 1 : (configuration.isPressed ? scale : 1))
            .opacity(reduceMotion && configuration.isPressed ? 0.85 : 1)
            .animation(.easeOut(duration: Motion.press), value: configuration.isPressed)
            .onChange(of: configuration.isPressed) { _, pressed in
                if pressed, let haptic { Haptics.fire(haptic) }   // fire on press-DOWN
            }
    }
}
```

- Default corner touch target ≥ 44×44 pt; add `.contentShape(Rectangle())` + padding, don't grow
  the visual.
- Never a plain opacity dip as the only feedback — always the scale (or, under Reduce Motion,
  the small opacity change above).

### 6.4 Haptics (`Haptics.swift`)

| Moment | Call |
| --- | --- |
| Selection changed — tab switch, theme pick, chip / result / suggested tapped, chat send | `UISelectionFeedbackGenerator().selectionChanged()` |
| Something committed / a sheet detent caught / FAB pressed | `UIImpactFeedbackGenerator(style: .light).impactOccurred()` |
| Camera shutter | `UIImpactFeedbackGenerator(style: .medium).impactOccurred()` |
| Bookmark **added** | `UINotificationFeedbackGenerator().notificationOccurred(.success)` |
| Bookmark **removed** | selection |
| Operation failed (where surfaced) | `.notificationOccurred(.error)` |

Expose `Haptics.selection()`, `.impact(_:)`, `.success()`, `.error()` and a `fire(_ kind:)`.
No-op when the user has haptics disabled is automatic. Prepare generators before use for
low latency.

### 6.5 `BlurSurface` (= translucent chrome)

Floating nav/toolbars/pills that content scrolls under. Use `.background(.ultraThinMaterial)`
with a bright hairline top edge; under `accessibilityReduceTransparency` swap to a solid
`theme.background` + a hairline `theme.border`. Used for: the Topic screen header bar, the
image-action pill row, optionally the chat FAB.

### 6.6 Entrance / stagger helper

For lists that the user *asked for and is waiting on* (search results, recent, component list,
flow steps, progress steps): each row fades + rises 8 pt with `Motion.springMomentum` (or
`.easeOut`), delayed `index * Motion.stagger`, capped ~6 rows of stagger. Implement with an
`.onAppear` flag + `.opacity`/`.offset` + `.animation`, or a `PhaseAnimator`. **Skip entirely
under Reduce Motion** (content is just there). Do **not** animate rows of a `List`/`LazyVStack`
that recycle on scroll — animate on first appearance only.

### 6.7 Named motion pieces (parity list)

| Piece | Behaviour |
| --- | --- |
| Press feedback | scale 0.97, 120 ms, ease-out, on press-down (§6.3) |
| Tab indicator | a pill slides + resizes under the active tab, `Motion.easeInOut` 180 ms; selection haptic on tap; instant under Reduce Motion |
| Toast | drops in from bottom (`Motion.toastIn` + easeOut), leaves to bottom ~20 % faster (`Motion.toastOut`); safe-area inset; non-interactive |
| Error banner (Home) | spring pop-in (`springDefault`) + a single icon shake (skip shake under Reduce Motion); swipe horizontally to dismiss — commit on **velocity OR distance** (`project()`), hand release velocity to the fly-out spring, rubber-band resistance |
| Generation progress | 5 steps stagger in; the active step has a pulsing dot (freeze under Reduce Motion); a completed step's checkmark springs in (`springMomentum`); the progress bar fill animates its width (`easeInOut`, `Motion.enter`) |
| Home mode changes (`idle`/`searching`/`results`/`generating`/`error`) | cross-fade; the "generating" panel enters from the bottom (it's a deeper state) |
| Topic header | translucent `BlurSurface` pinned to top; content scrolls under it; a bottom hairline fades in `[0 → 12 pt]` of scroll offset |
| Topic tab content | switches with a direction-aware slide+fade (right when moving forward through tabs, left when back); interruptible; a plain fade under Reduce Motion |
| Component cards | stagger in on the Components tab |
| Component / chat sheets | native `.sheet` with detents (component: `[.fraction(0.55), .large]`; chat: `[.fraction(0.65), .large]`); drag indicator visible; light impact haptic when a detent catches |
| Bookmark toggle | icon does a quick scale dip → spring back (`springMomentum`); success haptic on add |
| Chat FAB | mounts with `scale 0.9 → 1` spring; light impact on press; `ScaleButtonStyle(scale: 0.92)` |
| Explore / drill-down overlay | dim scrim + card scales `0.95 → 1` + fades in (`springSheet`) |
| Image double-tap zoom | springs between 1× and 2× (`springMomentum`) |
| Suggested marquee | 3 rows, auto-scroll at 30 / 20 / 46 pt·s⁻¹, directions −1 / +1 / −1, seamless loop; **frozen** under Reduce Motion |
| Camera shutter | `ScaleButtonStyle(scale: 0.92)` + medium impact on capture |
| Screen transitions | native push; **fade** under Reduce Motion |
| Auth | header (logo + title) fades/rises in on appear; error/info text drops in |

---

## 7. Data model (`Models/`)

Port `src/types/knowledge.ts` to Swift structs. All `Identifiable` where they have `id`.
Dates are ISO-8601 strings from PostgREST — decode to `Date` with a custom strategy or keep as
`String` and format on display (the RN app keeps strings; either is fine).

```swift
enum RelationshipType: String, Codable, CaseIterable {
    case partOf, connectedTo, supports, transfersLoadTo, madeOf, powers, causes
}

enum GenerationStatus: String, Codable {
    case pending, understanding, knowledge, components, image, finalizing, complete, failed
}

struct ConstructionStep: Codable, Hashable { var order: Int; var title: String; var description: String }
struct Material: Codable, Hashable { var name: String; var spec: String; var why: String }
struct FailureMode: Codable, Hashable { var name: String; var cause: String; var mitigation: String }
struct Science: Codable, Hashable { var principle: String; var formula: String; var formulaNote: String }
struct Source: Codable, Hashable { var title: String; var publisher: String }

struct StructuredKnowledge: Codable, Hashable {
    var overview: String
    var materials: [Material]
    var construction: [ConstructionStep]
    var science: Science
    var failureModes: [FailureMode]
    var sources: [Source]
    var relatedTopicSlugs: [String]
    var flow: [String]              // ordered stage labels for the flow chart
    var howItWorks: String          // 2–4 prose paragraphs (blank-line separated); may be "" on old topics → fall back to `flow`
}

struct Topic: Identifiable, Hashable {
    var id: String; var slug: String; var title: String; var description: String
    var domain: String?
    var structuredKnowledge: StructuredKnowledge
    var imageUrl: String?; var imageStoragePath: String?
    var createdBy: String?; var createdAt: String; var updatedAt: String
}

struct ComponentBoundingBox: Codable, Hashable { var x, y, width, height: Double }  // normalised 0–1, origin top-left

struct TopicComponent: Identifiable, Hashable {
    var id: String; var topicId: String; var name: String
    var description: String   // "what it is"
    var does: String          // "what it does"
    var why: String           // "why it exists"
    var materials: [String]
    var bbox: ComponentBoundingBox?   // from metadata.bbox
    var sortOrder: Int
}

struct ComponentRelationship: Identifiable, Hashable {
    var id: String; var topicId: String
    var fromComponentId: String; var toComponentId: String
    var type: RelationshipType; var description: String
}

struct TopicSearchResult: Identifiable, Hashable {
    var id: String; var slug: String; var title: String; var description: String; var imageUrl: String?
}

struct BookmarkEntry: Identifiable { var id: String; var topicId: String; var createdAt: String; var topic: Topic }
struct ChatMessage: Identifiable, Hashable {
    var id: String; var topicId: String; var userId: String
    var role: Role; var content: String; var componentContextId: String?; var createdAt: String
    enum Role: String, Codable { case user, assistant }
}
```

### 7.1 Row DTOs & mappers (`DTOs.swift`)

DB rows are snake_case (`src/lib/db-mappers.ts`). Define `…Row: Decodable` with `CodingKeys`
mapping to snake_case, and a `toModel()` for each. Never decode straight into the domain model.
Key column facts:

- `visualpedia_topics.structured_knowledge` is `jsonb` → decode nested `StructuredKnowledge`.
- `visualpedia_components`: columns `name, description, does, why, materials text[], metadata jsonb, sort_order`.
  `bbox` lives at `metadata.bbox` (or absent).
- `visualpedia_chat_messages.component_context_id` nullable.

---

## 8. Backend reference (Supabase — already provisioned)

`supabase-swift` setup: one configured `SupabaseClient(supabaseURL:supabaseKey:)`, with a
custom auth storage backed by **Keychain**. `autoRefreshToken` on, `persistSession` on.

### 8.1 Tables (all RLS-enabled; `authenticated` role)

| table | columns (abridged) | RLS |
| --- | --- | --- |
| `visualpedia_topics` | `id uuid pk`, `slug unique`, `title`, `description`, `domain`, `structured_knowledge jsonb`, `image_url`, `image_storage_path`, `search_text tsvector` (generated from title+description), `created_by`, timestamps | SELECT: any authenticated. INSERT: any authenticated. UPDATE: only `created_by = auth.uid()` |
| `visualpedia_components` | `id`, `topic_id fk`, `name`, `description`, `does`, `why`, `materials text[]`, `metadata jsonb`, `sort_order` | SELECT: any authenticated. INSERT: only if the target `topic_id` was created by the caller |
| `visualpedia_relationships` | `id`, `topic_id fk`, `from_component_id fk`, `to_component_id fk`, `type enum`, `description` | same ownership-scoped INSERT as components |
| `visualpedia_generations` | `id`, `topic_id`, `query`, `status enum`, `error`, `created_by`, timestamps | SELECT / INSERT / UPDATE: only own (`created_by = auth.uid()`) |
| `visualpedia_bookmarks` | `id`, `user_id`, `topic_id`, `created_at`, unique(`user_id`,`topic_id`) | SELECT / INSERT / DELETE: only own |
| `visualpedia_search_history` | `id`, `user_id`, `query`, `topic_id`, `created_at` | SELECT / INSERT / DELETE: only own |
| `visualpedia_chat_messages` | `id`, `topic_id`, `user_id`, `role check(user/assistant)`, `content`, `component_context_id`, `created_at` | SELECT / INSERT: only own |

Enums: `visualpedia_relationship_type` (= `RelationshipType` cases), `visualpedia_generation_status`
(= `GenerationStatus` cases).

`updated_at` is maintained by a DB trigger on topics + generations.

### 8.2 Storage

Bucket **`visualpedia-topic-images`**, public read. Authenticated users may INSERT/UPDATE objects
in it. Topic images are stored at key **`{topicId}.png`**, content-type `image/png`, `upsert:
true`. Public URL: `storage.from("visualpedia-topic-images").getPublicUrl("{topicId}.png")`.

### 8.3 Name constants (`Tables.swift`)

```swift
enum Tables {
    static let topics = "visualpedia_topics"
    static let components = "visualpedia_components"
    static let relationships = "visualpedia_relationships"
    static let generations = "visualpedia_generations"
    static let bookmarks = "visualpedia_bookmarks"
    static let searchHistory = "visualpedia_search_history"
    static let chatMessages = "visualpedia_chat_messages"
}
enum Buckets { static let topicImages = "visualpedia-topic-images" }
```

### 8.4 Repository methods to implement (map to `src/services/*`)

- **SearchRepository.searchTopics(query) -> [TopicSearchResult]** — PostgREST full-text search on
  `search_text` with `websearch` config, limit 10. `select: "id, slug, title, description, image_url"`.
  On error: log a warning, return `[]` (never throw — the pipeline falls through to "generate").
- **TopicsRepository.getTopic(id) -> TopicDetail?** — parallel fetch: topic (`maybeSingle`),
  components (`eq topic_id`, `order sort_order`), relationships (`eq topic_id`). Returns
  `(topic, components, relationships)`. Throws on a real DB error; `nil` if no topic row.
- **TopicsRepository.getTopic(bySlug:) -> Topic?**
- **BookmarksRepository**: `list()` (join topic, newest first), `isBookmarked(topicId)`,
  `add(topicId)`, `remove(topicId)`.
- **HistoryRepository**: `add(query, topicId?)` (fire-and-forget), `recentTopics(limit)` —
  fetch last 30 history rows with a joined topic, dedupe by topic id, take `limit`.
- **ChatRepository**: `messages(topicId)` (own rows, ascending), plus the send flow in §10.4.
- **GenerationsRepository**: insert a row at pipeline start (status `understanding`), update
  `status`/`topic_id` as it progresses, set `failed` + `error` on catch. Non-fatal if the insert
  fails — log and run untracked.

`useFocusEffect`-style refetch in RN → in SwiftUI, refetch in `.onAppear` / `.task(id:)` /
`.refreshable`, and after mutations. Recent topics and bookmarks both refresh on screen appear.

---

## 9. Auth (`AuthService` + Auth flow)

Mirror `src/state/auth-context.tsx`:

- On launch: `client.auth.session` (restore) → set `session`, `isLoading = false`.
- Subscribe to `client.auth.authStateChanges` → update `session`.
- `signIn(email, password)` → `client.auth.signIn(email:password:)`; return the error message
  string or `nil`.
- `signUp(email, password)` → `client.auth.signUp(email:password:)`; on success show
  "Check your email to confirm your account, then sign in." Password min length 6 (client-side).
- `signOut()` → `client.auth.signOut()`.

**Routing:** while `isLoading` → splash. Then: `session == nil` → Auth flow (Sign In / Sign Up),
else → App flow (Home as root). This is a top-level `if` in `RootView`, not a navigation push.

Sign-in email + password → on success the session change flips the root to the App flow. No
"forgot password" screen (parity — none exists).

---

## 10. AI layer (`AI/`)

**All AI runs on-device**, calling providers directly, exactly as the RN app. Keys are read
from config (§17) and *are* embedded in the app binary — a known, deliberate trade-off; do not
add a proxy. One provider per job, fixed:

- **Anthropic Claude** — `model = "claude-sonnet-5"` — structured knowledge, chat, vision.
  Endpoint `POST https://api.anthropic.com/v1/messages`, headers
  `x-api-key: <key>`, `anthropic-version: 2023-06-01`, `content-type: application/json`.
- **Google Gemini** — `model = "gemini-3-pro-image-preview"` ("Nano Banana Pro") — the infographic
  image. Endpoint
  `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=<key>`.

These two model-id strings are the single source of truth and are shown (read-only) on Settings.

### 10.1 Error handling (`AIError.swift` — port `src/lib/ai/errors.ts`)

```swift
let GENERIC_ERROR_MESSAGE = "Oops! Something went wrong. Would you like to try again?"

struct APIError: Error {
    let message: String       // friendly, provider-named — for the explore-overlay / retry copy
    let scope: String         // "llm" | "image" | "chat" | "vision" | "identify" | "hotspots"
    let provider: String
    let status: Int
    let retryable: Bool       // 429 or 5xx, but NOT if the body contains "insufficient_quota"
}

// Route every non-2xx AI response through this:
func throwCleanAPIError(scope:, provider:, response: HTTPURLResponse, body: Data, silent: Bool = false) throws -> Never
```

- Reads the response body as text. `quotaExceeded = body contains "insufficient_quota"`.
- Unless `silent`, **log at error level** with provider, status, request URL, and the first
  4 KB of the body — this must be visible in the Xcode console (§15).
- `retryable = !quotaExceeded && (status == 429 || status >= 500)`.
- Friendly message: 401/403 → "`{provider}` rejected the request — check the API key in
  Settings."; quota → "`{provider}` has run out of billing quota — check your plan/billing.";
  429 → "`{provider}` is rate-limiting requests right now. Try again in a moment."; ≥500 →
  "`{provider}` is temporarily unavailable. Try again shortly."; else → "Something went wrong
  talking to `{provider}`. Try again."
- The UI **never shows `APIError.message` for a whole-generation failure** — it shows
  `GENERIC_ERROR_MESSAGE`. `APIError.message` is used for the smaller in-place drill-down
  failure and for retry affordances. `retryable` gates whether a "Retry" button appears.

### 10.2 Structured knowledge (`KnowledgeGenerator` — port `src/lib/ai/llm.ts`)

Force Claude into a single tool call so the response is always a JSON object.

Request body:

```json
{
  "model": "claude-sonnet-5",
  "max_tokens": 4096,
  "system": "<SYSTEM_PROMPT — see src/lib/ai/llm.ts, copy verbatim>",
  "messages": [{ "role": "user", "content": "<user prompt — see below>" }],
  "tools": [{
    "name": "emit_structured_knowledge",
    "description": "Emit the structured knowledge for the requested topic.",
    "input_schema": { <KNOWLEDGE_JSON_SCHEMA — see src/lib/ai/llm.ts, copy verbatim> }
  }],
  "tool_choice": { "type": "tool", "name": "emit_structured_knowledge" }
}
```

- **User prompt**: no parent context → `"Explain how this works: {query}"`. With parent context
  (drill-down) → the longer template in `buildUserPrompt` (`src/lib/ai/llm.ts`) that passes the
  parent system description and asks Claude to stay consistent with it while going one level
  deeper.
- Response: find the `content` block with `type == "tool_use"`, take its `input`, **decode into
  `GeneratedKnowledge`** (same shape as `KNOWLEDGE_JSON_SCHEMA` — title, slug, description,
  domain, overview, materials[], construction[], science, failureModes[], sources[],
  relatedTopicSlugs[], flow[], howItWorks, components[] {name, description, does, why,
  materials[]}, relationships[] {from, to, type, description}, imagePrompt). On decode failure:
  log the raw input at error level, throw `"Claude returned an unexpected response. Try again."`
- No `tool_use` block → throw `"Claude returned no tool call"`.
- `SYSTEM_PROMPT` and `KNOWLEDGE_JSON_SCHEMA` are long and load-bearing — **copy them byte-for-byte
  from `src/lib/ai/llm.ts`**. They define the entire knowledge contract (5–10 real components or
  an empty array for atomic parts; exact relationship enum; `flow` vs `howItWorks` distinction;
  `imagePrompt` is one sentence describing only the cutaway subject + view angle; slug is
  kebab-case).

### 10.3 Infographic image (`GeminiClient` + `InfographicPrompt` — port `src/lib/ai/image.ts`)

Request:

```json
{
  "contents": [{ "parts": [{ "text": "<the assembled infographic prompt>" }] }],
  "generationConfig": {
    "responseModalities": ["IMAGE"],
    "imageConfig": { "aspectRatio": "16:9", "imageSize": "2K" }
  }
}
```

- The prompt is assembled by `buildInfographicPrompt(knowledge)` from a fixed set of blocks
  (ROLE, STYLE, LAYOUT, CAMERA, GRAPHIC DESIGN, TYPOGRAPHY, SUBJECT, MATERIAL REALISM,
  CONSTRUCTION SEQUENCE list, CALLOUT FORMAT, component callout list, NUMBERING INTEGRITY,
  WHAT NOT TO INCLUDE, LABEL RULES) — **port `src/lib/ai/image.ts` verbatim**, it is finely
  tuned (two-zone page layout, plain white background — never "transparent" —, navy numbered
  markers, exactly N callouts matching the component list, no title/no extra panels).
- Response: `candidates[0].content.parts` → first part with `inlineData.data` (base64) →
  decode to `Data`; content type from `inlineData.mimeType` (default `image/png`).
- Non-2xx → `throwCleanAPIError(scope: "image", provider: "Google Gemini (image generation)")`.
- No image data → throw `"Gemini returned no image data"`.

### 10.4 Chat (`ChatGenerator` — port `src/lib/ai/chat.ts` + `src/services/chat.ts`)

- `POST /v1/messages`, `max_tokens: 1024`, `system: <built per topic/component>`,
  `messages: [{role, content}]` (no tools). Reply = first `content` block with `type == "text"`.
- **System prompt** (`buildSystemPrompt`, `src/services/chat.ts`): "friendly, precise technical
  tutor"; states the current topic title + description + overview; if a component is selected,
  says "it"/"this" means that component; answer conversationally in a few sentences; for a
  greeting/small-talk/no-real-question, reply with one short friendly sentence inviting a
  specific question (don't summarise the overview); **stay strictly scoped to this topic** — for
  anything off-topic reply with exactly
  `"Oops, I cannot answer that right now, but maybe try a new search."` and nothing else;
  genuinely harmful requests get a normal brief refusal instead of the off-topic line.
- **Send flow** (`sendChatMessage`): resolve user id; parallel-fetch topic, the selected
  component (if any), and the last 12 chat rows (own, newest-first). Build history
  chronologically + append the new user turn. **Persist the user row first.** Call the model.
  On success persist the assistant row and return it. On failure: log at error level, persist an
  assistant row with `"Sorry, I couldn't answer that just now. Please try again."`, then rethrow
  so the UI can react. History limit 12; a component context id is stored on each row.

### 10.5 Vision helper (`VisionClient` — port `src/lib/ai/vision.ts`)

`askVisionJson(scope, prompt, image {base64, contentType}) -> Any?`:

- `POST /v1/messages`, `max_tokens: 1024`, one user message with two content blocks:
  `{type:"text", text:"{prompt}\n\nReturn only the raw JSON object."}` and
  `{type:"image", source:{type:"base64", media_type: contentType, data: base64}}`.
- Non-2xx → `throwCleanAPIError(scope, "Anthropic", silent: options.silent)`.
- Reply text → `extractJson` (strip a ```json fence, else slice from first `{` to last `}`) →
  `JSONSerialization` / decode. Returns `nil` if the model produced no usable text.

### 10.6 Subject identification (`SubjectIdentifier` — port `src/lib/ai/identify.ts`)

- Calls `askVisionJson("identify", PROMPT, image)`. `PROMPT` (copy verbatim): identify the single
  most prominent object/structure/machine/mechanism/tool/vehicle/biological-system/technical-
  concept; return the **canonical reference-book name** a user would type (specific over generic,
  but never a brand/model); `label: null` for a person, whole animal, landscape, screenshot,
  document, meal, artwork, or anything too blurry; `detail` optional one-liner; `alternatives`
  0–4 other guesses. JSON only: `{"label": string|null, "detail": string|null, "alternatives": string[]}`.
- `normalizeIdentification(raw)`: tolerant decode; `cleanLabel` trims a leading `a/an/the`, maps
  `null|none|n/a|unknown|unclear|unidentifiable|not sure|nothing` (case-insensitive, exact) to
  `nil`, caps at 80 chars; `alternatives` trimmed, de-duped against the label, max 4; `detail`
  only kept if there is a label.
- Returns `IdentifiedSubject { label: String?, detail: String?, alternatives: [String] }`.
- The camera screen only uses `label`; `detail`/`alternatives` are captured for a future
  "not quite right?" affordance (not currently surfaced).

### 10.7 Hotspot detection (`HotspotDetector` — port `src/lib/ai/hotspots.ts`)

- Best-effort, **never fatal**. Calls `askVisionJson("hotspots", prompt, image, silent: true)`.
- Prompt: for each named component, return the bounding box of that part **on the central cutaway
  illustration** (the shape, not its callout number / text / side panels); normalised 0–1,
  origin top-left; omit anything you can't confidently locate. JSON only:
  `{"boxes":[{"name","x","y","width","height"}]}`. Then the component-name list.
- Parse `{boxes:[...]}`; match `name` back to the requested list case-insensitively; `clampBox`
  each: clamp origin to 0–1, trim width/height to the remaining space, **drop** if either
  dimension < 0.01. Returns `name -> ComponentBoundingBox`.
- On any failure or schema miss: log a warning, return empty — the topic still works without
  hotspots.

---

## 11. Generation pipeline (`GenerationPipeline` + `GenerationController`)

### 11.1 `GenerationController` (= `src/hooks/use-generation.ts`)

An `@Observable` object:

```
phase: GenerationPhase   // GenerationStatus + `.idle`
error: String?
retryable: Bool
topicId: String?
func start(query:, parentContext: String? = nil) async
func retry()             // resubmits the last request unchanged
func reset()
```

`start` sets `phase = .pending`, clears error/topicId, runs the pipeline passing a phase
callback, and on the throw: `phase = .failed`, `error = GENERIC_ERROR_MESSAGE`,
`retryable = (error as? APIError)?.retryable ?? false`, and logs at error level.

### 11.2 `GenerationPipeline.run(query:, onPhase:, parentContext:) async throws -> String`

Port `runGeneration` (`src/services/generation.ts`) exactly. Returns the new topic id.

1. Get the signed-in user id; throw `"Not signed in"` if absent.
2. Insert a `visualpedia_generations` row `{ query, created_by, status: "understanding" }`,
   `select().single()`. If it fails: **log a warning and continue untracked** (`generationId = nil`).
3. `onPhase(.understanding)` then `onPhase(.knowledge)`.
4. `knowledge = try await KnowledgeGenerator.generate(query, parentContext)`.
5. `onPhase(.components)`.
6. `slug = try await uniqueSlug(knowledge.slug.isEmpty ? knowledge.title : knowledge.slug)`
   (`toSlug`: lowercase, non-alphanumeric → `-`, trim leading/trailing `-`; then append
   `-2`, `-3`, … until free — check `visualpedia_topics` by `slug`, `maybeSingle`).
7. Insert the topic row (`slug, title, description, domain, structured_knowledge` (the sub-object
   **without** `title/slug/description/domain/components/relationships/imagePrompt` — just
   overview, materials, construction, science, failureModes, sources, relatedTopicSlugs, flow,
   howItWorks), `created_by`), `select().single()`. Throw on error.
8. If `knowledge.components` non-empty: insert component rows
   (`topic_id, name, description, does, why, materials, sort_order = index`), `select()`. Then
   map component name → new id, and insert relationship rows for every `knowledge.relationships`
   entry whose `from` **and** `to` both resolve to a component id
   (`topic_id, from_component_id, to_component_id, type, description`).
9. `onPhase(.image)`. `image = try await GeminiClient.generate(knowledge)`. Upload the bytes to
   Storage at `{topicId}.png` (`contentType`, `upsert: true`); throw on upload error. Get the
   public URL; `update` the topic row `{ image_url, image_storage_path: "{topicId}.png" }`.
10. `try? await HotspotDetector.detect(image, componentNames)` and, for each located box,
    `update` that component's `metadata` to `{ ...existing, bbox }`. Wrapped so a failure is a
    no-op + a warning log.
11. `onPhase(.finalizing)`. If tracked: `update` the generation row
    `{ status: "complete", topic_id }`.
12. `onPhase(.complete)`. Return `topic.id`.
13. **`catch`**: log at error level (`"Pipeline failed"` + the error); if tracked, `update` the
    generation row `{ status: "failed", error: <message> }`; rethrow.

### 11.3 `ensureTopicImage(topic, components) -> String`

Port `ensureTopicImage` (`src/services/generation.ts`): if `topic.imageUrl != nil` return it;
else rebuild a `GeneratedKnowledge` from the stored `structuredKnowledge` + components
(`imagePrompt = structuredKnowledge.overview` or `topic.description`), run
`generateAndStoreImage` + `detectAndStoreHotspots`, return the new URL. Used by the Topic screen
to backfill a missing image (a generation that died after the topic row but before the image).

### 11.4 Phase → progress-step mapping (for `GenerationProgressView`)

| step label | phase |
| --- | --- |
| "Understanding your question" | `understanding` |
| "Retrieving reliable knowledge" | `knowledge` |
| "Identifying components & relationships" | `components` |
| "Generating technical cutaway" | `image` |
| "Preparing your explanation" | `finalizing` |

`idle`/`pending` → index −1 (nothing active). `complete`/`failed` → index = 5 (all done).
Progress bar percent = `floor(max(index, 0) / 5 * 100)`.

---

## 12. Navigation map

`NavigationStack` with a route enum:

```swift
enum Route: Hashable {
    case topic(id: String, breadcrumb: [String] = [])
    case bookmarks
    case settings
    case camera
}
```

- **Root (App flow):** `HomeView`.
- Home → `.settings` (person icon), `.bookmarks` (bookmark icon), `.camera` (scan button).
- Home, after a successful generation or opening a result → `.topic(id:)`.
- `TopicView` → `.topic(id:, breadcrumb:)` for drill-down (append the current topic title to the
  breadcrumb). Breadcrumb renders as `Home › A › B › current` in the header (mono, truncating).
- `.camera` presented as a **bottom-slide push** (fade under Reduce Motion). It photographs,
  stashes the identified term in `PendingScan`, and pops. Home reads `PendingScan` on
  `.onAppear`/`.task` and runs it through search/generate.
- `.settings` and `.bookmarks` are plain pushes with a back chevron.
- Component / chat sheets are `.sheet` presentations from `TopicView`, not routes.
- Fullscreen image viewer is a `.fullScreenCover` (or an overlay `ZStack`) from `TopicView`.

There is **no tab bar**. Do not add one.

---

## 13. Screen specs

Every screen below lists: layout, states, interactions, motion, haptics. Colours/type/spacing
are token names from §5. "PressableScale" = wrap in `Button` + `ScaleButtonStyle` (§6.3).

### 13.1 SignIn (`src/app/(auth)/sign-in.tsx`)

- Centred form, horizontal padding `Spacing.five`, `KeyboardAvoidance` (SwiftUI: `.safeAreaPadding`
  / `ScrollView` + `.scrollDismissesKeyboard`).
- Header (fades/rises in on appear, `Motion.easeOut` ~320 ms): `Logomark(size: 32)`, then
  `display` "Sketch Studios", then `body` `textMuted` "Search anything. See how it works."
- Fields (`Spacing.three` gap): Email (`keyboardType .emailAddress`, no autocap, `textContentType
  .username`), Password (`isSecure`, `textContentType .password`). Field style: border
  `border`, radius `Radii.lg`, padding `Spacing.three`, background `backgroundElement`, 16 pt text.
- Error text (`small` `danger`) drops in (`FadeInDown`, `Motion.easeOut` ~220 ms) when present.
- Primary button: full-width, `accent` bg, radius `Radii.lg`, `bodySemiBold` `textInverse`
  "Sign in"; shows a spinner while submitting; disabled (opacity 0.4) unless
  `email.trimmed.count > 0 && password.count > 0 && !submitting`. `ScaleButtonStyle` (scale only
  when enabled).
- Link row: `small` `textMuted` "No account? " + `accentHover` "Create one" → push Sign Up.
- Submit → `AuthService.signIn`; on error set the error string; on success the root flow flips
  (no manual navigation).

### 13.2 SignUp (`src/app/(auth)/sign-up.tsx`)

Same layout. Title "Create account", subtitle "Start exploring how things work." Password
placeholder "Password (min 6 characters)", `textContentType .newPassword`. Extra **info** text
(`small` `accentHover`) drops in with "Check your email to confirm your account, then sign in."
`canSubmit` requires `password.count >= 6`. Link row: "Already have an account? " + "Sign in"
(replaces the stack — i.e. pop, don't stack).

### 13.3 Home (`src/app/(app)/index.tsx`)

State machine `mode ∈ {idle, searching, results, generating, error}`. Centre column capped at
`MaxContentWidth`.

**Header** (hidden while `generating`): brand row (`Logomark()` + `wordmark` "Sketch Studios")
on the left; on the right two PressableScale icon buttons — `bookmark` → push `.bookmarks`,
`person.crop.circle` → push `.settings`.

**Body:**

- Everything except `generating` is a scroll view. Mode changes cross-fade.
- **Hero** (only `idle`): `display` "What do you want\nto understand?" then `body` `textMuted`
  "Search any object, structure or system — get a visual, technical breakdown."
- **Search row** (always): a rounded container (`backgroundElement`, `border`, `Radii.lg`) with a
  `magnifyingglass` (`textFaint`), a `TextField` (`placeholder 'Try "suspension bridge"'`,
  submit label search), and a "Go" PressableScale (`backgroundSunken`, `Radii.sm`,
  `bodySemiBold` `text`; selection haptic). Submitting or Go runs search. Typing while in
  `error`/`results` returns to `idle` and clears the error.
- **Scan button** (`idle` or `error`): bordered (`accent` border, `Radii.md`), centred row —
  `camera` (`accent`) + `bodySemiBold` `accent` "Scan an object with your camera" → push
  `.camera`. PressableScale.
- **Error banner** (`error`): the `ErrorBannerView` component (§14.4), with `message` =
  `errorMessage`, `retryable` from the controller, `onRetry` → set `generating` + `controller.retry()`,
  `onDismiss` → back to `idle`.
- **"Searching…"** text (`textMuted`) while `searching`.
- **Suggested topics** (`idle`): `label` `textFaint` "Suggested topics" + `SuggestedMarqueeView`
  over the fixed list: `House foundation`, `Suspension bridge`, `Jet engine`, `Human heart`,
  `Lithium-ion battery`, `Curtain wall bracket`. Tapping a chip sets the query and runs search
  (selection haptic).
- **Recent** (`idle`, if any): `label` `textFaint` "Recent", then rows — each a PressableScale
  (stagger-in) → push `.topic(id:)`: a 56 pt rounded thumbnail (`image_url` or an avatar with
  the title's first letter, `mono` `accentHover` on `backgroundSunken`), a text stack
  (`bodySemiBold` title, `small` `textMuted` domain), a trailing `chevron.right` (`border`).
  Show 5; if more, a centred "Show more"/"Show less" PressableScale toggles to the full list
  (max 10 fetched).
- **Results** (`results`): a `label` `textFaint` "Related" header, then a list of result rows
  (PressableScale → open, selection haptic; do **not** stagger recycled rows) with a 56 pt
  thumbnail + `bodySemiBold` title + 2-line `small` `textMuted` description. Footer: a
  "Generate new sketch" PressableScale (`accent` bg, `sparkles` + `bodySemiBold` `textInverse`;
  selection haptic) → run the pipeline on the current query.
- **Generating** (`generating`): replaces the whole screen, enters from the bottom. A back
  chevron PressableScale (→ `cancelGeneration`: reset controller, back to `idle`). A row with a
  small `accent` dot + `mono` `accentHover` "SKETCH STUDIOS IS THINKING". `displaySm`
  `"{query}"` (quoted). Then `GenerationProgressView(phase:)` (§14.3).

**Search logic** (`runSearch(query)`):

1. trim; empty → nothing.
2. `mode = .searching`. `results = try await SearchRepository.searchTopics(trimmed)`.
3. If results non-empty → `mode = .results`. Else → `generateNew(trimmed)`.
4. On a thrown error → `errorMessage = error.localizedDescription`, `mode = .error`.

`generateNew(q)`: `mode = .generating`; `await controller.start(q)`.

**On `controller.topicId` set:** record search history (`HistoryRepository.add(query, topicId)`),
`controller.reset()`, set `mode` back to `.results` (if there were results) or `.idle` (clearing
the query), then push `.topic(id: topicId)`.

**On `controller.error` set:** `errorMessage = controller.error`, `mode = .error`.

**Pending scan:** on appear, `if let term = PendingScan.take()` → clear error, `mode = .idle`,
set query, `runSearch(term)`.

**Recent refresh:** refetch recent topics every time Home appears (actions on other screens
change it).

### 13.4 Topic (`src/app/(app)/topic/[id].tsx`) — the core screen

Params: `id`, `breadcrumb: [String]`. Loads `TopicDetail` (`getTopic(id)`).

- **Loading:** centred spinner (`accent`).
- **Load error / not found:** centred `danger` text ("Topic not found" or the error message).
- **Missing image backfill:** if the loaded topic has `imageUrl == nil`, once per topic id, call
  `ensureTopicImage` and patch the in-memory topic when it resolves; show a spinner +
  "Generating image…" in the hero placeholder meanwhile, else "Image unavailable".

**Header** — a `BlurSurface` pinned to the top (content scrolls under it), height 44 + safe-area
top inset:
- left: `chevron.left` PressableScale → pop.
- centre: `mono` `textFaint`, one line, truncating — `["Home"] + breadcrumb + [topic.title]`
  joined with `   ›   `.
- right: **BookmarkButton** — `bookmark`/`bookmark.fill` (`accent` when set, else `text`); on
  tap: toggle optimistically, `success` haptic on add / `selection` on remove, then
  `add`/`remove` on the repo (revert on failure); the icon does a quick scale-dip → spring-back
  (`springMomentum`) whenever `bookmarked` flips (not on first render).
- a bottom hairline (`border`) whose opacity tracks scroll offset `[0 → 12 pt]`.

**Scroll content** (top padding = header height + inset + `Spacing.two`), centre column capped:

1. **Hero image** — `ZoomableImageView` (§14.6) at 4:3, with `hotspots` derived from components
   that have a `bbox`. If no image: a 4:3 placeholder (`backgroundElement`) with the
   spinner/"unavailable" state above.
2. **Image actions row** (only if an image) — three PressableScale pills in a `BlurSurface`
   style, centred, `Spacing.three` gap, fades in:
   - `arrow.up.left.and.arrow.down.right` + "Extend" → open fullscreen viewer in **zoom** mode.
   - `rectangle.landscape.rotate` + "Flip view" → open fullscreen viewer in **landscape**
     (rotated) mode.
   - `square.and.arrow.down` + "Download" → `ImageDownloader.saveToPhotos(url, "{slug}.png")`;
     toast "Saved to Photos" on success, the error message on failure; spinner while saving.
3. **Title block**: a `domain` badge (`accentSoft` pill, `small` `accentHover`) if present;
   `display` title; `bodyLg` `textSecondary` description.
4. **If the topic has zero components** ("minimal" / atomic part): render Sections directly —
   "What it is" (description), "Made of" (material names joined, if any), "Why it exists"
   (`knowledge.overview`), "Connects to" (`relatedTopicSlugs` as tappable `accentSoft` chips →
   each drills down: `exploreByName(slug, slug.replacingHyphens, parentContext = "{title}: {description}")`).
5. **Otherwise** — a `TabsView` (§14.5) over 5 tabs, then the active tab's content in a
   direction-aware slide+fade container:
   - **Components**: a `bodySemiBold`+`small` card per component (name; 1-line `does`;
     trailing `chevron.right`), stagger-in, PressableScale → open the Component detail sheet.
   - **How it works**: if `howItWorks` non-empty → its paragraphs (split on blank lines) as
     `body` text; else if `flow` non-empty → `FlowChainView(steps:)` (§14.7); else
     "No explanation available."
   - **Build**: "Construction sequence" `label` + a numbered list (sorted by `order`) — each row
     a filled `text`-bg numbered circle (`mono` `textInverse`) + `bodySemiBold` title +
     `small` `textMuted` description. Then "Materials" `label` + a card per material
     (`bodySemiBold` name + right-aligned `mono` `accentHover` spec, then `small` `textMuted`
     why).
   - **Engineering**: "The physics" `label` + `body` `knowledge.science.principle`; a dark
     (`backgroundInverse`) formula block with `mono` `textInverse` `science.formula` (18 pt);
     `small` `textMuted` `science.formulaNote`. Then "Common failures" `label` + a card per
     failure (`bodySemiBold` name; `small` — "Cause — …" and "Mitigation — …", the labels in
     `text`, the rest `textMuted`).
   - **Sources**: a bordered row per source — `bodyMedium` title + `mono` `textMuted` publisher.

**Chat FAB** — bottom-right, 52 pt, `accent` circle, `bubble…` icon `textInverse`, shadow;
mounts with `scale 0.9 → 1` spring; `ScaleButtonStyle(scale: 0.92)`; light impact on press →
present the Chat sheet scoped to the whole topic (no component).

**Component detail sheet** (`ComponentDetailSheet`, §14.8) — `.sheet`, detents
`[.fraction(0.55), .large]`, drag indicator, light impact on detent catch.

**Chat sheet** (`ChatSheet`, §14.9) — `.sheet`, detents `[.fraction(0.65), .large]`, keyboard-
aware.

**Fullscreen image viewer** (`FullscreenImageViewer`, §14.10) — `.fullScreenCover` with a fade.

**Drill-down / explore overlay** — while an `exploreByName` / `handleExploreComponent` is in
flight and its phase ≠ idle, show a dimmed scrim + a centred card (`backgroundElement`,
`Radii.xl`) that scales `0.95 → 1` + fades in (`springSheet`): a close `xmark` PressableScale
(→ cancel), then either `GenerationProgressView(phase:)` or, on `failed`, the
`APIError.message` (`body` `danger`) + a "Retry" PressableScale if `retryable`.

**`exploreByName(explorationId, name, parentContext?)`:**
1. `toSlug(name)` → `getTopic(bySlug:)`; if found → dismiss sheet, push `.topic(id:)`.
2. else `searchTopics(name)`; if any → dismiss sheet, push `.topic(id: first.id)`.
3. else `await exploreController.start(name, parentContext)`; on its `topicId` → dismiss the
   component sheet, push `.topic(id:, breadcrumb: breadcrumb + [current title])`.
On its `error` → toast the message.

`handleExploreComponent(component)` builds `parentContext` =
`"{topic.title}: {topic.description} Within that system, \"{component.name}\" is: {component.description} It {component.does} {component.why}"`
and calls `exploreByName(component.id, component.name, parentContext)`.

`handleAskAboutComponent(component)` → set selected component, dismiss the detail sheet, present
the Chat sheet scoped to that component.

**Tab reset:** when `id` changes, reset the active tab to Components.

### 13.5 Camera (`src/app/(app)/camera.tsx`)

Full-screen black. Uses `AVCaptureSession` behind a `UIViewRepresentable` preview
(`AVCaptureVideoPreviewLayer`, `.resizeAspectFill`), plus a `PhotosPicker` fallback.

Status: `live` | `working` | `error(message)` | `cameraUnavailable(message)`.

- **Permission not determined:** black screen (nothing).
- **Permission denied:** centred — `camera` icon (white), `body` white "Sketch Studios needs
  camera access to identify objects you photograph.", a white pill button
  ("Allow camera access" → request, or "Open Settings to enable it" → open Settings if it can't
  ask again), a dim "Choose a photo from your library instead" (→ PhotosPicker), a dim "Go back"
  (→ pop).
- **`cameraUnavailable`:** centred — `exclamationmark.circle` icon, the message, a white "Choose
  a photo" pill (→ PhotosPicker), a dim "Try the camera again" (→ reset + re-init session).
- **Live:** the preview fills the screen. Overlay (safe-area inset, `pointerEvents` box-none):
  - top-left: an `xmark` PressableScale on a translucent circle → pop.
  - centre: either an error card (`black 0.7`, the message + a white "Try again" that returns to
    `live`) or a hint pill (`black 0.4`) "Point at an object, structure, or mechanism".
  - bottom controls row: `photo.on.rectangle` PressableScale (→ PhotosPicker),
    the **shutter** (74 pt white ring + inner disc; `ScaleButtonStyle(scale: 0.92)`; **medium
    impact on capture**; disabled while `working` / not ready / `error`; spinner while working),
    `arrow.triangle.2.circlepath.camera` PressableScale (flip front/back).
  - a "IDENTIFYING…" banner (spinner + `mono` white) fades in while `working`.

**Capture flow:** take a photo → downscale so the long edge ≤ **1024 px**, re-encode **JPEG
quality 0.6**, base64 → `SubjectIdentifier.identify(base64, "image/jpeg")`. If `label == nil`:
`error("Couldn't recognize a clear object. Get closer, fill the frame, and keep it well lit.")`.
Else `PendingScan.set(label)` and pop. On an `APIError`: `error(GENERIC_ERROR_MESSAGE)`; other
errors: `error("Couldn't read that photo. Try again.")`. The library path (`PhotosPicker`) runs
the same downscale + identify.

**Robustness notes from the RN app** (fold into the AVFoundation setup): stop the session on
disappear, restart on appear; recover from an interruption (`AVCaptureSessionWasInterrupted` /
`…RuntimeError`) by re-configuring once before giving up → `cameraUnavailable`. iOS doesn't have
RN's "black preview" bug, but do handle `.interrupted`/`.notAuthorized` cleanly.

### 13.6 Bookmarks (`src/app/(app)/bookmarks.tsx`)

Header: `chevron.left` PressableScale (pop) + `displaySm` "Bookmarks" + a 20 pt spacer.
Empty (not loading, zero rows): `textMuted` "Topics you save will show up here." (fades in).
List: fades in once on load (don't stagger recycled rows). Each row a PressableScale → push
`.topic(id: topicId)`: 56 pt thumbnail (or `backgroundSunken` block), `bodySemiBold` title,
2-line `small` `textMuted` description. Refetch on appear.

### 13.7 Settings (`src/app/(app)/settings.tsx`)

Header: `chevron.left` PressableScale + `displaySm` "Settings" + spacer. Scroll, sections
(`label` `textFaint` header):

- **Appearance** — three option rows (`Light` / `Dark` / `System`), each a PressableScale
  (`backgroundElement`, `border`, `Radii.md`); the selected row's border is `accent` and it
  shows a `checkmark.circle.fill` (`accent`) that **springs in** (`springMomentum`); tapping a
  non-selected row fires a selection haptic and sets the preference (persisted).
- **AI models** — hint `small` `textMuted` "Structured knowledge and chat run on Claude; the
  infographic is generated by Gemini. Both are fixed in this build." Then two read-only info
  rows: "Knowledge & chat" → `claude-sonnet-5`; "Infographic" → `gemini-3-pro-image-preview`.
- **Account** — info rows (icon + `small` `textFaint` label + `bodySemiBold` value): "Name"
  (derived: email local-part, split on `. _ -`, title-cased), "Email", "Member since"
  (`created_at` → "Month YYYY"). Then a "Sign out" PressableScale (`border`, `Radii.md`,
  `bodySemiBold` `danger`) → a confirmation dialog ("Sign out" / message "Signed in as
  {email}" / Cancel + destructive "Sign out") → `AuthService.signOut()`.

---

## 14. Shared component specs

### 14.1 `ScaleButtonStyle` — §6.3.
### 14.2 `BlurSurface` — §6.5.

### 14.3 `ProgressBarView` (`src/components/progress-bar.tsx`)

A 6 pt track (`backgroundSunken`, `Radii.full`, clipped) with an `accent` fill whose **width**
animates to `percent` with `Motion.easeInOut` over `Motion.enter`. Instant under Reduce Motion.

### 14.4 `ErrorBannerView` (`src/components/error-banner.tsx` + `swipe-to-dismiss.tsx`)

Card: row layout, `statusFailBg` bg, `danger` border, `Radii.lg`. Left: an
`exclamationmark.circle.fill` (`statusFailFg`) that does one **shake** (rotate ±10°, ~330 ms
total) shortly after appearing — skip under Reduce Motion. Body: `bodyMedium` message; then
either a "Retry" PressableScale (`accent` bg, `textInverse`, selection haptic) if `retryable`,
or `small` `textFaint` "Swipe to dismiss". Entrance: spring pop (`springDefault`) + slight
rise + scale 0.96→1 (opacity-only under Reduce Motion).

**Swipe-to-dismiss:** a horizontal `DragGesture` on the card. Track translation 1:1; fade with
distance. On end: `projected = translation + project(velocity)`; commit if
`abs(projected) > 80` **or** `abs(velocity) > 500`. On commit: fly out to `±screenWidth` with
`springMomentum` (seed `velocity`), fade to 0, then call `onDismiss`. Otherwise spring back to 0.
Under Reduce Motion: no fly-out translate, just a fade then `onDismiss`.

### 14.5 `TabsView` (`src/components/tabs.tsx`)

A horizontally-scrollable row of pill tabs. The active pill has an `accentSoft` fill + `accent`
border and its label is `bodySemiBold` `accent`; inactive labels are `small` `textMuted`. A
single **indicator pill slides and resizes** to sit behind the active tab
(`Motion.easeInOut`, 180 ms) — measure each tab's frame (SwiftUI: `matchedGeometryEffect`, or a
preference key with frames). Instant under Reduce Motion. Selection haptic on tap. Tabs
themselves are PressableScale. Tab list: Components, How it works, Build, Engineering, Sources.

### 14.6 `ZoomableImageView` (`src/components/zoomable-image.tsx`)

An image at a fixed `aspectRatio` (4:3), clipped. **Pinch to zoom in place** (1×–4×), no pan —
`MagnificationGesture`; on end, settle (spring if bounced past a bound). **Double-tap** toggles
1× ↔ 2× with `springMomentum`. Overlays: for each `hotspot` (a `ComponentBoundingBox` in
normalised coords + a label + an action), a dashed `accent` rounded rectangle positioned at
`bbox` (as a fraction of the image frame), with a small `mono` `accent` label chip
(`backgroundElement` bg, `accentSoft` border) pinned just above it. Hotspots fade + stagger in
after the image loads. Each hotspot is a PressableScale (selection haptic) → its action (open
the component sheet). Because pinch-zoom of a bordered image is fiddly in pure SwiftUI, wrapping
a `UIScrollView` (`minimumZoomScale`/`maximumZoomScale`, `zoomScale`) via `UIViewRepresentable`
is acceptable and recommended — keep the hotspot overlay in SwiftUI on top.

### 14.7 `FlowChainView` (`src/components/flow-chain.tsx`)

A vertical stack: each step a bordered box (`backgroundElement`, `border`, `Radii.md`) with
centred `bodyMedium` text; between consecutive boxes a short dashed vertical connector
(`accentSoft`). Steps stagger in.

### 14.8 `ComponentDetailSheet` (`src/components/component-detail-sheet.tsx`)

Content (padded `Spacing.four`, `Spacing.four` gaps): `displaySm` name; then Sections
(`label` `textFaint` header + body), each staggering in:
- "What it is" → `description`
- "What it does" → `does`
- "Made of" → `materials` joined (if any)
- "Why it exists" → `why`
- "Connects to" (if the component has relationships) → the other components' names as
  `accentSoft` chips (display only).
Then (if handlers provided): a primary PressableScale (`accent` bg) "Generate new sketch for
{name}" (spinner while its `exploringId` matches; selection haptic) → `handleExploreComponent`;
and a secondary bordered PressableScale "Ask about this" → `handleAskAboutComponent`.
Connections list: for each relationship touching this component, the *other* endpoint, de-duped.

### 14.9 `ChatSheet` (`src/components/chat-sheet.tsx`)

- Header: `bodySemiBold` "Ask Sketch Studios" + an `xmark` PressableScale (dismiss).
- A context badge (`accentSoft` pill, `small` `accentHover`): the selected component's name, or
  the topic title.
- Message list (scrolls, auto-scrolls to bottom on new messages / send): user bubbles
  right-aligned `accent` bg `textInverse`; assistant bubbles left-aligned `backgroundSunken`
  `text`; max width 85%, `Radii` 16. The newest incoming bubble fades in from below. While
  sending, a "···" (`mono` `textMuted`) assistant bubble.
- Input row (border-top): a `TextField` "Ask a question…" (submit sends) + a 38 pt round `accent`
  send PressableScale (`paperplane.fill` `textInverse`), disabled while sending.
- Load history via `ChatRepository.messages(topicId)` on present. Send via §10.4; **selection
  haptic on send**; light impact when a detent catches. Optimistically append the user bubble,
  then the reply (or the canned failure line) — the repo persists both.

### 14.10 `FullscreenImageViewer` (`src/components/fullscreen-image-viewer.tsx`)

`.fullScreenCover` (fade). Near-black background (`black 0.96`). A close `xmark` PressableScale
top-right (safe-area inset). Modes:
- **zoom**: pinch (1×–5×) + pan (bounded to the scaled overflow) + double-tap to reset (spring)
  + **triple-tap to close**. Prefer a `UIScrollView`-backed representable for the pinch/pan.
- **landscape**: the image is rotated 90° and sized to fill when the phone is turned to
  landscape; pinch only (no pan). (The RN app swaps the layout box to `height×width` then
  rotates it back into the portrait frame.)

### 14.11 `SuggestedMarqueeView` (`src/components/suggested-marquee.tsx`)

Split the items across **3 rows** round-robin. Each row scrolls horizontally, seamlessly looping
(two copies of the content side by side, translate by one copy width). Speeds `[30, 20, 46]`
pt·s⁻¹; directions `[-1, +1, -1]`. Items repeat ~4× within a copy so short lists still fill the
width. Chips: bordered pill (`border`, `backgroundElement`, `Radii.full`), `small` text,
PressableScale (selection haptic). **Frozen (no scroll) under Reduce Motion.** Implement with a
`TimelineView(.animation)` driving an offset, or a `.linear(duration:).repeatForever`
animation on an offset that resets seamlessly.

### 14.12 `GenerationProgressView` (`src/components/generation-progress.tsx`)

`ProgressBarView(percent:)` on top (percent per §11.4). Then the 5 steps (§11.4 labels), each a
row: a 22 pt ring + the label (`bodySemiBold` `text` when active, `body`/`textFaint` otherwise).
Ring states: **done** → `statusPassFg` border + `statusPassBg` fill + a `checkmark`
(`statusPassFg`) that springs in (`springMomentum`); **active** → `text` border +
`backgroundSunken` fill + a **pulsing dot** (`text`, scale 1↔1.6, ~1.4 s loop — **frozen** under
Reduce Motion); **pending** → `border` only. Steps stagger in.

### 14.13 `Logomark` — §5.5.

---

## 15. Logging (`Logger.swift`)

Port `src/lib/logger.ts`. A tiny structured logger that **prints the full failure detail to the
Xcode console** (the RN app's #1 recent bug was truncated logs).

- Levels `debug/info/warn/error`; in a debug build all print, in release only `warn`+.
- API: `Logger.error(scope, message, error: Error? = nil, context: [String: Any] = [:])` etc.
- Output: one line `"[scope] message"`, then, indented, each context key on its own line; an
  `Error` renders its localized description **and** the full `String(describing:)` / any
  underlying `APIError` fields (status, provider, body) as plain multi-line text — never a
  single JSON-escaped blob.
- Redact keys matching `password|token|apikey|api_key|authorization|secret` (case-insensitive).
- `throwCleanAPIError` logs provider + status + URL + first 4 KB of the response body at error
  level (unless `silent`). `GenerationPipeline.catch` logs `"Pipeline failed"` + the error.
  `GenerationController` logs `"Generation failed"` + the error. All three fire on a failed
  search-to-generate, so the console shows the HTTP body, the pipeline stage, and the stack.

Use `os.Logger` / `OSLog` if you like, but ensure the body text is not truncated (`os_log`
truncates long strings — prefer `print` in debug, or chunk).

---

## 16. State & misc

- **`ThemeStore`** (`src/state/theme-store.ts`) — `@Observable`, `preference ∈ {light, dark,
  system}`, persisted (`UserDefaults`). `resolved` = `preference == .system ? colorScheme :
  preference`. Inject a resolved `Theme` into the environment; also set the window
  `.preferredColorScheme` so system chrome matches.
- **`PendingScan`** (`src/state/pending-scan.ts`) — a one-shot slot: `set(String)`, `take() ->
  String?` (returns and clears). Module-level / a singleton — **not** navigation params.
- **`ToastCenter`** (`src/components/toast.tsx` + `use-toast.tsx`) — `@Observable`
  `message: String?`; `show(_:)` sets it and clears after **2.4 s** (cancel a pending clear on a
  new message). Rendered once at the app root, above everything (including sheets), as a pill
  (`ink900` bg, `Radii.full`, `textInverse` `small`) dropping in from the top safe area,
  non-interactive, entering/leaving along the same vertical path (exit ~20% faster).

---

## 17. Configuration & secrets

Four values, currently Expo `EXPO_PUBLIC_*` env vars (`.env` / `.env.example`):

| key | purpose |
| --- | --- |
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon / publishable key |
| `ANTHROPIC_API_KEY` | Claude — knowledge, chat, vision (`sk-ant-…`) |
| `GEMINI_API_KEY` | Gemini — image generation |

The real values are in this repo's `.env` (git-ignored) — reuse them. In Xcode: put them in a
git-ignored `Secrets.xcconfig`, surface via `Info.plist` `$(…)` substitution, read at launch
into a `Config` struct. They **will** be present in the app binary — same accepted trade-off as
the RN app (revisit before any public release; do not build a proxy now).

`Info.plist` also needs: `NSCameraUsageDescription` = "Allow Sketch Studios to use the camera so
it can identify objects you photograph.", `NSPhotoLibraryUsageDescription` = "Allow Sketch
Studios to open a photo so it can identify what's in it.", `NSPhotoLibraryAddUsageDescription`
= "Allow Sketch Studios to save generated images to your photos.", `UIAppFonts` (the 7 TTFs),
`UISupportedInterfaceOrientations` = Portrait only for the app (the fullscreen viewer handles
its own rotation visually; the app itself stays portrait-locked like `orientation: "portrait"`).
`CADisableMinimumFrameDurationOnPhone` = `YES` (unlock 120 fps for custom animation).

---

## 18. Milestone plan

Each milestone should compile, run, and be independently verifiable.

**M1 — Foundations.** Xcode project (§4), design system (§5: `Theme`, `Typography`, fonts,
`Spacing`/`Radii`), `Motion.swift`, `Haptics.swift`, `ScaleButtonStyle`, `BlurSurface`,
`Logomark`, `ToastCenter`, `ThemeStore`, `Logger`. A throwaway "component gallery" screen to eyeball
tokens in light + dark.

**M2 — Backend + auth.** `supabase-swift` wired to the existing project (Keychain session
storage). `AuthService` + Sign In / Sign Up screens + the splash→auth→app root gate. Models +
DTOs + mappers. `TopicsRepository.getTopic`, `SearchRepository.searchTopics` (verify against
real data by hardcoding a known topic id / query).

**M3 — AI layer (headless).** `AIError`, `AnthropicClient`, `GeminiClient`, `KnowledgeGenerator`
(port the prompt + schema verbatim), `ChatGenerator`, `VisionClient`, `SubjectIdentifier`,
`HotspotDetector`, `InfographicPrompt`. Unit tests for `slug`, `clampBox`,
`normalizeIdentification`, `APIError` classification, DTO mappers. Drive
`KnowledgeGenerator.generate("suspension bridge")` from a test/temporary button and inspect the
decoded struct + the generated image in the console/Quick Look.

**M4 — Generation pipeline.** `GenerationPipeline.run` + `GenerationController` +
`GenerationProgressView` + `ProgressBarView` + `ensureTopicImage`. `GenerationsRepository`,
`HistoryRepository`. A temporary screen that takes a query, shows the progress UI, and prints
the new topic id.

**M5 — Home.** Full `HomeView` state machine (§13.3): search → results → generate, recent,
suggested marquee, error banner + swipe-to-dismiss, scan button (route only). Navigation stack +
`Route` enum.

**M6 — Topic screen.** `TopicView` (§13.4): blur header + scroll-under, hero `ZoomableImageView`
+ hotspots, image-action pills, title block, minimal-topic layout, `TabsView` + all 5 tab
contents + `FlowChainView`, chat FAB, drill-down/explore overlay + `exploreByName`. Bookmarks
repo + `BookmarkButton`.

**M7 — Sheets.** `ComponentDetailSheet`, `ChatSheet` + `ChatRepository` send flow. Fullscreen
image viewer (zoom + landscape).

**M8 — Camera.** `AVCaptureSession` preview + `PhotosPicker` fallback, permission states,
capture → downscale → identify → `PendingScan` → Home pickup. `ImageProcessing`,
`ImageDownloader` (save to Photos, used by the Topic screen too).

**M9 — Bookmarks + Settings.** Both screens (§13.6, §13.7). Theme switching end-to-end.

**M10 — Motion & polish pass.** Walk §6.7 and §13 line by line: press feedback everywhere, tab
indicator, staggered entrances, sheet detent haptics, toast path, bookmark spring, FAB mount,
explore-card spring, marquee, generation-progress pulse/checkmark, direction-aware tab
transitions. Then the full Reduce Motion + Reduce Transparency pass. Then Dynamic Type + a
VoiceOver sweep (labels, roles, `accessibilityValue` on the bookmark/toggles).

---

## 19. Acceptance checklist ("same everything")

**Features**
- [ ] Email/password sign-up (with "confirm your email" message) and sign-in; sign-out with a
      confirmation dialog; session persists across launches.
- [ ] Search: keyword match → results list; no match → generation runs automatically.
- [ ] Generation shows 5 named phases with a progress bar; cancel returns to Home; a transient
      failure shows a retryable error, a permanent one a non-retryable one.
- [ ] Topic screen renders every section for a full topic and the collapsed layout for an
      atomic one; a topic missing its image backfills it.
- [ ] Component sheet: what/does/made-of/why/connects-to; "Generate new sketch for X" drills
      down and grows the breadcrumb; "Ask about this" opens component-scoped chat.
- [ ] Chat: topic-scoped and component-scoped; off-topic questions get the exact canned line;
      history persists per topic per user; a reply failure still leaves an apology message.
- [ ] Image: inline pinch-zoom, tappable hotspots, fullscreen zoom, rotate-to-landscape, save
      to Photos (with a toast).
- [ ] Scan: camera capture and library pick both identify a subject and route it through
      search/generate; unrecognisable photos show the "get closer" message; permission-denied
      and camera-unavailable states both offer the library path.
- [ ] Bookmarks: toggle from the Topic screen, list on the Bookmarks screen, both stay in sync.
- [ ] Home: Recent (distinct topics, refreshes on return), Suggested marquee (3 rows), both tap
      through to topics.
- [ ] Settings: theme light/dark/system persists and applies immediately; the two model names
      show; account name/email/member-since show.

**Design**
- [ ] Colours match §5.1 in both light and dark; the accent is the exact orange.
- [ ] The three type families load; display text has negative tracking; `label` is uppercased.
- [ ] Spacing/radii match; centre columns cap at 800 pt on iPad/large.
- [ ] Icons are the SF Symbol equivalents from §5.4; the Logomark is the dashed circle + dot.

**Motion**
- [ ] Every non-system tappable scales to 0.97 on press-down (0.92 for FAB/shutter), 120 ms.
- [ ] Springs use the `{duration, bounce}` values from §6.2; overshoot appears only after a
      momentum gesture.
- [ ] Tab indicator slides; toast drops in/out along one axis (exit faster); error banner pops
      + shakes once; swipe-to-dismiss commits on velocity *or* distance and hands off velocity.
- [ ] Generation steps stagger in; active step pulses; completed checkmark springs.
- [ ] Topic header is translucent with content scrolling under it and a scroll-reactive
      hairline; tab content slides directionally.
- [ ] Sheets use native detents with a drag indicator and a detent-catch haptic.
- [ ] Haptics fire per §6.4 and nowhere else (never on scroll).

**Accessibility**
- [ ] Reduce Motion: no slides/springs/parallax/overshoot; screen transitions fade; marquee and
      the progress pulse freeze; everything still works.
- [ ] Reduce Transparency: blur surfaces become solid.
- [ ] VoiceOver labels/roles on all controls; the bookmark button announces its state.

**Engineering**
- [ ] A failed generation prints the provider HTTP status, the response body, the pipeline
      stage, and a stack to the Xcode console (not truncated).
- [ ] All table/bucket names come from the `Tables`/`Buckets` constants.
- [ ] Secrets are in a git-ignored xcconfig; the repo builds without them present (fails
      gracefully with a clear message, like the RN app's supabase.ts guard).

---

## 20. Appendix — file-to-file port index

| RN file | Swift target |
| --- | --- |
| `src/constants/theme.ts` | `DesignSystem/Theme.swift`, `Typography.swift` |
| `src/components/themed-text.tsx` / `themed-view.tsx` | `Typography.swift` modifiers / plain views |
| `src/lib/motion.ts` | `DesignSystem/Motion.swift` |
| `src/components/pressable-scale.tsx` | `DesignSystem/Components/ScaleButtonStyle.swift` |
| `src/hooks/use-haptics.ts` | `DesignSystem/Haptics.swift` |
| `src/components/blur-surface.tsx` + `src/hooks/use-reduce-transparency.ts` | `DesignSystem/Components/BlurSurface.swift` |
| `src/components/logomark.tsx` | `DesignSystem/Components/Logomark.swift` |
| `src/components/progress-bar.tsx` | `DesignSystem/Components/ProgressBarView.swift` |
| `src/components/toast.tsx` + `src/hooks/use-toast.tsx` | `State/ToastCenter.swift` + a root overlay view |
| `src/types/knowledge.ts` | `Models/Knowledge.swift`, `Generation.swift` |
| `src/lib/db-mappers.ts` | `Models/DTOs.swift` |
| `src/lib/tables.ts` | `Backend/Tables.swift` |
| `src/lib/supabase.ts` | `Backend/SupabaseClient.swift` (Keychain storage) |
| `src/state/auth-context.tsx` | `Backend/AuthService.swift` |
| `src/services/topics.ts` | `Backend/TopicsRepository.swift` |
| `src/services/search.ts` | `Backend/SearchRepository.swift` |
| `src/services/bookmarks.ts` | `Backend/BookmarksRepository.swift` |
| `src/services/history.ts` | `Backend/HistoryRepository.swift` |
| `src/services/chat.ts` | `Backend/ChatRepository.swift` + `AI/ChatGenerator.swift` |
| `src/services/generation.ts` | `Services/GenerationPipeline.swift` |
| `src/hooks/use-generation.ts` | `Services/GenerationController.swift` |
| `src/lib/ai/errors.ts` | `AI/AIError.swift` |
| `src/lib/ai/llm.ts` | `AI/KnowledgeGenerator.swift` (+ `AnthropicClient.swift`) |
| `src/lib/ai/image.ts` | `AI/GeminiClient.swift` + `AI/InfographicPrompt.swift` |
| `src/lib/ai/chat.ts` | `AI/ChatGenerator.swift` |
| `src/lib/ai/vision.ts` | `AI/VisionClient.swift` |
| `src/lib/ai/identify.ts` | `AI/SubjectIdentifier.swift` |
| `src/lib/ai/hotspots.ts` | `AI/HotspotDetector.swift` |
| `src/lib/slug.ts` | `Services/Slug.swift` |
| `src/lib/download-image.ts` | `Services/ImageDownloader.swift` |
| `src/lib/logger.ts` | `Services/Logger.swift` |
| `src/state/pending-scan.ts` | `State/PendingScan.swift` |
| `src/state/theme-store.ts` + `src/hooks/use-theme.ts` | `State/ThemeStore.swift` |
| `src/app/_layout.tsx` + `(app)/_layout.tsx` + `(auth)/_layout.tsx` | `App/SketchStudiosApp.swift`, `RootView.swift`, `Route` enum |
| `src/app/(auth)/sign-in.tsx` / `sign-up.tsx` | `Features/Auth/*` |
| `src/app/(app)/index.tsx` | `Features/Home/*` |
| `src/app/(app)/topic/[id].tsx` | `Features/Topic/*` |
| `src/app/(app)/camera.tsx` | `Features/Camera/*` |
| `src/app/(app)/bookmarks.tsx` | `Features/Bookmarks/BookmarksView.swift` |
| `src/app/(app)/settings.tsx` | `Features/Settings/SettingsView.swift` |
| `src/components/tabs.tsx` | `Features/Topic/TabsView.swift` |
| `src/components/flow-chain.tsx` | `Features/Topic/FlowChainView.swift` |
| `src/components/generation-progress.tsx` | `Features/Home/GenerationProgressView.swift` |
| `src/components/error-banner.tsx` + `swipe-to-dismiss.tsx` | `Features/Home/ErrorBannerView.swift` |
| `src/components/suggested-marquee.tsx` | `Features/Home/SuggestedMarqueeView.swift` |
| `src/components/component-detail-sheet.tsx` | `Features/Topic/ComponentDetailSheet.swift` |
| `src/components/chat-sheet.tsx` | `Features/Topic/ChatSheet.swift` |
| `src/components/zoomable-image.tsx` | `Features/Topic/ZoomableImageView.swift` |
| `src/components/fullscreen-image-viewer.tsx` | `Features/Topic/FullscreenImageViewer.swift` |

Also see `docs/ARCHITECTURE.md` for prose on the pipeline, the `structured_knowledge` shape, RLS,
and known gaps.
