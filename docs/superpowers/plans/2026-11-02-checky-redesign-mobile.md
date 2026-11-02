# Checky redesign: phone app — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Expo app (journalist and citizen modes) to the Checky identity: tokens, fonts, name, Phosphor duotone icons, ink tab bar with a paper pill, the Checky button and a fixed sign bar, light and dark, with real data and no display bug.

**Architecture:** Colour values move into a pure `src/lib/tokens.ts` (no React Native import) tested with `node --test`; `src/lib/theme.ts` keeps its exported keys (`useTheme()`, `fonts`, `verdict` map) so screens change only where layout changes. One branch and one squash-merged PR on `main` per task.

**Tech Stack:** Expo SDK 58, React Native 0.88, Expo Router, `@expo-google-fonts/bricolage-grotesque`, `@expo-google-fonts/cormorant-garamond`, `phosphor-react-native` (needs `react-native-svg`, present), Node 26 `node --test`.

**Spec:** `../fanilo-base/docs/superpowers/specs/2026-11-02-checky-redesign-design.md` (§4.2–4.5, §4.7, §4.9, §4.10, verification gate). Visual reference: https://claude.ai/artifact/S3XTow6nzQvdSev7FAfDfT (phone width).

## Global Constraints

- `AGENTS.md`: read the SDK 58 versioned docs before using an Expo API; add packages with `npx expo install`; run `npx expo lint` and `npx tsc --noEmit` before done; never edit `ios/`/`android/`.
- Token values exactly as spec §4.2; verdict fills carry `#ffffff` text in light and `#0a0a0b` in dark; the active tab pill `#f3f2ee` carries `#0a0a0b` in both themes.
- Every filled surface is rendered with its paired foreground key (spec §4.10). Pressed state = `opacity` on the pressable container only, or scale .97, never on text colour alone.
- Fonts: Bricolage Grotesque everywhere, Cormorant Garamond italic 500 only for verbatim quotes. Anton, Barlow Condensed and Public Sans removed.
- Icons: Phosphor `weight="duotone"` through `src/lib/icons.ts`; no `lucide-react-native` import left after Task 3.
- On-screen product name « Checky »; SecureStore keys (`fanilo.mode`, `fanilo_session_data`), scheme `fanilo://`, bundle ids and API names unchanged.
- Touch targets ≥ 44 px; text ≥ 4.5:1; dark follows the system.
- Git (user's global rules): branch from up-to-date `main`; `type: message`, no scope, subject only, author Mathieu-bot, no AI attribution; PR same title, short plain body; review comment then `gh pr merge --squash --delete-branch` (body = squashed commit subjects); `git switch main && git pull`.
- Checks before every PR: `npm test && npx expo lint && npx tsc --noEmit && npx expo export --platform web --output-dir /tmp/claude-1000/-home-jiu-ifm-fanilo-mobile/60fd7c3c-663b-485d-b6e9-5bb44b9fb663/scratchpad/mobile-export` (bundles), and the screenshot gate below.

## Review Focus

1. Dark mode on the active tab pill and on primary buttons (paper fill, label must stay ink). Pinned by `tokens.test.ts` pairs (Task 1) and dark screenshots (Task 4).
2. Long real data on small screens: a 140-character claim title, a long URL in Analyser, a citizen verdict with no sources. Pinned by the gate on `/affirmation/[id]`, `/analyse`, `/citoyen/verdict/[id]`.
3. The Checky button and the sign bar must never hide the last row of a list or the keyboard's input: content gets bottom padding equal to tab bar + bar + button; `KeyboardAvoidingView` behaviour kept. Pinned by Task 4 step 4.
4. Offline: cached screens and the « À envoyer » outbox keep their layout in the new theme. Pinned by the gate with the network off (Task 4 step 5).
5. Citizen mode (no account) uses the same tokens; nothing in it references journalist-only colours. Pinned by the gate on `/citoyen` routes.

### Screenshot gate (used by every task)

Run the web build of the app (`npx expo start --web --port 8082`) and drive it with Playwright (cached Chromium, `uv run --with playwright python -I gate.py`) at 390×844 and 360×740, `colorScheme` light and dark: `/accueil`, `/citoyen`, `/citoyen/verifier`, `/connexion`, `/(tabs)` index, `/affirmations`, one `/affirmation/[id]`, `/reglages`, against the local API from `fanilo-base` with demo data. Save screenshots; check every text is readable. Web rendering is a proxy for layout and colour; note in the PR that a device check is still pending.

---

### Task 1: Checky tokens and fonts

**Files:**
- Create: `src/lib/tokens.ts`, `src/lib/tokens.test.ts`
- Modify: `src/lib/theme.ts` (values from `tokens.ts`; same exported keys plus `nav`, `navForeground`, `navActive`, `navActiveForeground`, `raised`, `quote` font), `src/app/_layout.tsx` (`useFonts`), `package.json` (`"test": "node --test src/lib/*.test.ts"`)

**Interfaces:**
- Produces: `export const light`, `export const dark` (plain objects with the same keys as today's `theme.ts` objects plus the new ones above), `export const PAIRS: ReadonlyArray<[string, string]>`, `export function contrast(a: string, b: string): number`. `theme.ts` keeps `useTheme(): Theme` and `fonts` = `{ regular: "BricolageGrotesque_400Regular", medium: "BricolageGrotesque_500Medium", semibold: "BricolageGrotesque_600SemiBold", bold: "BricolageGrotesque_700Bold", display: "BricolageGrotesque_800ExtraBold", quote: "CormorantGaramond_500Medium_Italic" }` (use the exact export names the packages provide).

- [ ] **Step 1: Write the failing test** `src/lib/tokens.test.ts`: `contrast("#0a0a0b","#f3f2ee")` ≈ 17.67 (±0.05); for `light` and `dark`, every `PAIRS` entry ≥ 4.5 (foreground on background/card/muted, mutedForeground on background/card/muted, primaryForeground on primary, navForeground on nav, navActiveForeground on navActive, each `verdict[v].ink` on `verdict[v].soft` and on background, each `verdict[v].on` on `verdict[v].fill`); `dark.navActiveForeground === "#0a0a0b"`.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implement `tokens.ts` with spec §4.2 values (map: `background`=ground, `card`=surface, `muted`=raised, `primary`, `border`, `input`=control border as solid hex blended on the ground: light `#c4c3be`, dark `#3a3a3c`; drop `manila`, `signal*`, `rail*` after Task 4 replaces their users — until then alias `rail`→`nav`, `railForeground`→`navForeground`, `manila`→`navActive`, `signal`→`foreground`). **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** `npx expo install @expo-google-fonts/bricolage-grotesque @expo-google-fonts/cormorant-garamond`; load them in `_layout.tsx`; remove Anton/Barlow/Public Sans imports and packages (`npm uninstall`); replace any `fonts.*` key that no longer exists.
- [ ] **Step 6:** Verbatim quotes (`VerdictBadge` reason quotes, analysis quotes in `analyse.tsx`, `affirmation/[id].tsx`, `citoyen/verdict/[id].tsx`) use `fonts.quote`.
- [ ] **Step 7:** Checks + gate. PR `style: apply checky colour tokens and fonts to the phone app`, squash-merge.

### Task 2: Product name

**Files:** `app.json` (`name`, `ios.infoPlist` display strings, Android label; keep `slug`, `scheme`, bundle ids), `src/lib/i18n/fr.ts`, `src/components/brand.tsx`, `README.md` title line

- [ ] **Step 1:** `grep -rn "FANILO\|Fanilo" src app.json` → list user-facing hits (share-extension label « Partager → FANILO » included).
- [ ] **Step 2:** `brand.tsx` wordmark « Checky. » (Bricolage 800, dot in `fonts.quote`). Replace user-facing strings; keep keys, scheme and identifiers.
- [ ] **Step 3:** Re-grep: only identifiers remain. Checks + gate. PR `feat: rename the phone app to checky on every screen`, squash-merge.

### Task 3: Phosphor duotone icons

**Files:** Create `src/lib/icons.ts`; modify the 14 files importing `lucide-react-native` (`grep -rl lucide-react-native src`), `src/components/ui.tsx` (`VERDICT_ICON`, `STATUS_ICON`, `ButtonProps.icon` type)

**Interfaces:** Produces `export type Icon = React.ComponentType<{ size?: number; color?: string }>` and wrappers fixing `weight="duotone"`; verdict map true→Check, false→X, misleading→Warning, unverifiable→Question; status map to_check→Question, in_progress→MagnifyingGlass, verified→SealCheck, published→Broadcast.

- [ ] **Step 1:** `npx expo install phosphor-react-native`.
- [ ] **Step 2:** Implement `icons.ts`; replace imports file by file; `grep -rn lucide-react-native src` → no output; `npm uninstall lucide-react-native`.
- [ ] **Step 3:** Checks + gate. PR `refactor: switch phone icons to phosphor duotone`, squash-merge.

### Task 4: Tab bar, Checky button, sign bar

**Files:**
- Create: `src/components/checky-button.tsx`, `src/components/sign-bar.tsx`
- Modify: `src/app/(tabs)/_layout.tsx` (custom `tabBar`), `src/app/affirmation/[id].tsx` (sign/confirm action moves into `SignBar` when a verdict awaits confirmation), `src/components/ui.tsx` (`Screen` bottom padding prop), screens in `(tabs)` (bottom padding)

**Interfaces:**
- Produces: `<CheckyButton />` (56 px ink circle, Sparkle icon, `accessibilityLabel="Nouvelle vérification avec Checky"`, positioned above the tab bar at right 16, opens the Analyser tab and focuses its paste field); `<SignBar label onPress busy disabled />` (fixed above the tab bar, full-width primary button 44 px). `Screen` accepts `bottomInset?: number`.

- [ ] **Step 1:** Custom tab bar per spec §4.7: `nav` background, 4 current tabs, the active one in a `navActive` pill with `navActiveForeground` label and icon, others `navForeground`; height 66 + safe area; labels 11.5 px; `accessibilityRole="tab"` + `accessibilityState={{ selected }}`.
- [ ] **Step 2:** `CheckyButton` on the four tab screens (not on modal routes, not in citizen mode where the home already is the check field).
- [ ] **Step 3:** `SignBar` on `affirmation/[id]` when the verdict is suggested and the user may confirm: it opens the existing confirmation dialog (journalist always confirms, as today); the Checky button moves up by the bar's height.
- [ ] **Step 4:** Every scrolling screen gets `bottomInset` = tab bar + (sign bar) + 72 so the last row and inputs stay reachable; check with the longest list in demo data.
- [ ] **Step 5:** Gate in both themes; offline run (browser offline) of `/affirmations` and an opened claim shows cached data and the outbox in the new theme. PR `feat: give the phone app an ink tab bar, the checky button and a sign bar`, squash-merge.
