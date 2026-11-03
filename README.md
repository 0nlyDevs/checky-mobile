# Checky mobile

The Checky phone app for journalists in Madagascar. A video, photo, voice note or link received on WhatsApp, Facebook or TikTok goes through **Partager → Checky**. The app then:

1. uploads the file,
2. transcribes what is said,
3. picks out the claims and warning signs,
4. searches fact-checkers, the web and Wikipedia,
5. suggests a verdict that quotes its sources.

A journalist always confirms the verdict. One tap follows the claim in the newsroom's desk.

Citizens use it too, with no account. On first launch the app asks who is using it:

- **Citizen:** a shared post or a pasted rumour is compared with the verdicts newsrooms have published (« Est-ce déjà vérifié ? »). Only published verdicts are shown, never an AI verdict. If nothing matches, the citizen sends it to a newsroom as a tip and follows it until its verdict comes out. A verdict can be passed on as a card image or as text with its link.
- **Journalist:** the desk, as below.

It is a native app (Expo SDK 58, React Native 0.88, Expo Router), not the responsive website. It talks to the same backend as the web desk ([`fanilo-base`](https://github.com/0nlyDevs/fanilo-base)):

- **Better Auth** (in the Next.js app): email and password sign-in through the Expo plugin; the session cookie is kept in SecureStore.
- **FastAPI** (`/api/v1`): called with the short-lived JWT from `/api/auth/token`.

## Screens

| Route | What it does |
| --- | --- |
| `/accueil` | First launch: citizen or journalist (kept in SecureStore, `fanilo.mode`) |
| `/citoyen` | Citizen home: paste a rumour, the tips sent from this phone, the latest published verdicts |
| `/citoyen/verifier` | Published verdicts that match (`/public/match`) and the public assistant's cited answer (`/public/ask`); otherwise « Signaler à une rédaction » |
| `/citoyen/signaler` | Send a tip (`/public/tips`) to a chosen newsroom, or « Je ne sais pas : Checky choisit » (routed by the place typed and the phone's country); its follow-up token is remembered on the phone |
| `/citoyen/suivi/[token]` | Where the tip stands, refreshed every 30 s, and its verdict once published |
| `/citoyen/verdict/[id]` | A published verdict: reason, post, sources; share the card image or the text with its web link |
| `/connexion`, `/inscription` | Sign in, sign up (same accounts as the desk) |
| `/bienvenue` | Create a newsroom (optionally with the demo claims) or join with an invitation link |
| `/` Analyser | Pick a video/photo from the gallery, or paste a link or text |
| `/analyse` | The check, step by step: upload → transcription → read → claims and warning signs → search → suggested verdict. Then the content, the dashed AI suggestion and the quotes it rests on, the warning signs, the file's AI traces (C2PA, generator tags such as Sora or Midjourney), reverse image search, and results to tick. **Suivre dans le desk** creates the claim and attaches the file and the ticked sources |
| `/affirmations` | The newsroom's claims, filtered by status, searchable |
| `/affirmation/[id]` | A claim: verdict (confirmed with a dialog; never colour alone), **Partager le verdict** (the 1080 × 1080 card in French or Malagasy and the post written from the verdict, through the share sheet; sharing moves a verified claim to Publié, as in the desk), status, AI source analysis, sources (add a link or a file), comments |
| `/verifier` | **Avant l'antenne** (default): the caller's claim, typed or dictated with the keyboard's microphone, is matched against published verdicts (`/public/match`, then the newsroom's own through `/items/similar`). A match shows « Déjà vérifié : … » with the newsroom, the date and a two-sentence radio line to copy; with none, it never says « Faux »: it says nothing is published, gives a neutral line for the air, shows whether the desk already follows it, and offers **Suivre dans le desk** (origin radio, queued offline). **Nos sources**: ask every source of the newsroom; the answer streams and cites its passages |
| `/reglages` | Language, account, newsroom switch and its verification status, Mode léger, offline sync, service health, demo reset, sign out |
| `/rubrique` | My beat, including circulating reports, cases, contacts, figures and suggested angles, from the phone's offline copy |
| `/annuaire`, `/chiffres`, `/registre`, `/verdicts` | Search the directory, official figures, the last 90 days of originals and published verdicts saved on the phone |
| `/scanner` | Check a verdict or communiqué QR seal against saved issuer keys and revocations without a network; photograph printed notices into the check flow |

Shared content arrives through [`expo-share-intent`](https://github.com/achorein/expo-share-intent) (Android intent filters for `text/*`, `image/*`, `video/*`, `audio/*` and PDF; an iOS share extension). `ShareForwarder` in `src/app/_layout.tsx` opens `/analyse` with the shared file or link in the desk, or `/citoyen/verifier` in citizen mode. A share made before a mode is chosen, or while a journalist is signed out, waits until then.

## Languages

The interface is in Malagasy, French and English, switched in one tap (Réglages, the first-launch screen, the citizen home and the newsroom welcome screen). The choice is kept in SecureStore (`fanilo.lang`); until one is made, the phone's language decides: Malagasy → Malagasy, French → French, anything else → English.

- `src/lib/i18n/fr.ts` is the source. `en.ts` and `mg.ts` override it key by key and French fills any gap (`merge` in `src/lib/i18n/core.ts`); they are typed against French, so an unknown key fails `tsc`.
- Screens read strings with `useT()` (`src/lib/i18n/index.ts`), so a switch re-renders them; helpers outside components use `tr()`. Dates use the language's locale (`day()`).
- **Every new string goes into `fr.ts`, with its English in `en.ts` and its Malagasy in `mg.ts`.** `mg.ts` is machine-drafted and marked `// relire (mg)`: a Malagasy speaker must reread it. Its verdict and status words match the web's public site.
- The verdict card keeps its own language picker (French or Malagasy labels); a citizen's card follows the interface (Malagasy, otherwise French).

## Working without a network

For reporters in areas with weak or no coverage. The checks themselves (AI, search, file reading) run on the server, so the phone does not verify offline. Instead, nothing captured is lost and nothing already opened becomes unreadable.

- **"À envoyer" (`src/lib/outbox.tsx`)**: with no network, `/analyse` and `/nouvelle` put the check or the new claim in a queue saved on the phone (`documentDirectory/outbox/`; files are copied there so a cleared share cache does not lose them). The queue is sent when the network comes back, when the app returns to the front, and every 30 s while something waits. A file is uploaded only once (`sourceId` is kept), and the link check runs in the background. The result shows up on the Analyser tab as "Analyse prête", and "Suivre" works as usual from there. Server failures back off up to 10 min, and refusals (too large, wrong type) are marked failed. Only in-app actions fill the queue, never a deep link. It runs only while the app is open: there is no background task.
- **Cached reading (`src/lib/cache.ts`)**: the SWR cache is saved to `swr-cache.json`. Claims, files and verdicts already opened stay readable, and the app opens offline because `/me` and the Better Auth session (`fanilo_session_data`) are cached. SWR refetches when the network returns (`initReconnect` via `expo-network`).
- **Synced reading (`src/lib/offline.ts`)**: on opening and reconnecting, the phone stores published verdicts, issuer keys and revocations, the last 90 days of the registry, and a signed-in newsroom's Ma rubrique, directory, figures and cases. Each screen shows when its copy was saved. Réglages offers an immediate refresh. A public QR seal is checked against those saved keys with no network; the signed title, number and date are shown for comparison with the paper. An unknown or outdated key is never called fake. A photo of a printed notice joins the normal analysis or the outbox.
- **Mode léger**: text first, heavy media only after a tap, slower refresh and compressed photos when sending over a slow link. Compression strips EXIF and C2PA markers, and the switch says so. The setting is kept on the phone; a slow sync offers it once per launch.
- **Weak networks**: `api()` gives up after 60 s and a queued link check after 5 min, so a stalled request does not block the queue.
- **Sign-out** wipes the cache and the queue, after a confirmation when something is unsent.
- Photos are sent uncompressed unless Mode léger is on: recompression strips the EXIF, C2PA and AI markers the server checks.

## Layout

```
src/app/            Expo Router screens (see above)
src/components/     ui.tsx (text, buttons, fields, verdict badge, status, steps), brand, claim row, auth form, outbox
src/lib/            config, auth (Better Auth client), api (JWT + fetch), sse (streams via expo/fetch),
                    upload (presigned PUT with progress, then wait for the ingest job), workspace context,
                    network (expo-network), cache (SWR kept on disk), outbox ("À envoyer" queue),
                    theme (DESIGN.md tokens from the desk), types, i18n/ (fr.ts every string, en.ts and mg.ts over it)
src/lib/api-schema.d.ts   Generated from fanilo-base's OpenAPI (npm run gen:api)
```

Design follows the desk's "Grille d'antenne" (`fanilo-base/apps/web/DESIGN.md`):

- An ink tab bar with a manila marker. Anton for titles, Public Sans for text, Barlow Condensed for FAN refs.
- Verdicts always show an icon and a label. An AI suggestion is a dashed outline on a soft background.
- Status uses ink icons, never verdict colours.
- Signal yellow appears only on selection.

## Setup

Prerequisites: Node 22+, JDK 17 and the Android SDK (platform 36, build-tools 36; Gradle downloads the NDK). You also need a running `fanilo-base`: the web app on :3000 and the API on :8000. Its `apps/web/lib/auth.ts` must include the `expo()` plugin and trust `fanilo://`.

```bash
npm install
npx expo prebuild --platform android      # generates android/ (gitignored)
npm run android                            # builds, installs on the emulator/phone, starts Metro
```

### Pointing the app at the backend

| Variable | Default | Meaning |
| --- | --- | --- |
| `EXPO_PUBLIC_WEB_URL` | `http://localhost:3000` | Next.js app (Better Auth) |
| `EXPO_PUBLIC_API_URL` | `http://localhost:8000` | FastAPI |

The defaults work on an emulator or a USB phone after:

```bash
adb reverse tcp:3000 tcp:3000 && adb reverse tcp:8000 tcp:8000
```

For a phone on Wi-Fi, use the machine's LAN address. For a deployed backend, use its HTTPS URLs. `EXPO_PUBLIC_*` values are compiled into the JS bundle, so set them before `expo start` or a release build.

### A standalone APK to install on a phone

```bash
EXPO_PUBLIC_WEB_URL=https://… EXPO_PUBLIC_API_URL=https://… \
  npx expo prebuild --platform android && cd android && ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk (signed with the debug key: fine for testing, not for the Play Store)
```

iOS needs a Mac with Xcode (`npx expo run:ios`) or EAS Build (`npx eas-cli build -p ios`, Apple developer account).

## Checks

```bash
npx tsc --noEmit && npx eslint src && npm test
npx expo export --platform android   # the bundle builds
npm run gen:api     # after an API schema change in fanilo-base (expects it checked out next to this repo)
```

## Backend pieces this app relies on (fanilo-base)

- `POST /workspaces/{ws}/files/upload-url` then `…/complete`. Videos (`mp4`, `webm`, `quicktime`, `3gpp`) are accepted. Their soundtrack is pulled out with ffmpeg and transcribed by Groq Whisper; the container's tags are scanned for AI generators.
- `POST /workspaces/{ws}/link-check {source_id}` checks an uploaded file on its transcript (or text, or EXIF).
- `PATCH /workspaces/{ws}/sources/{id} {item_id}` attaches the analysed file to the claim created by **Suivre dans le desk**.
- `POST /workspaces/{ws}/copilot/act` creates the claim (next FAN ref) and attaches links.
- `POST /workspaces/{ws}/items/{id}/post {language}` writes the post for the verdict card.
- Citizen mode: `/public/newsrooms`, `/public/verdicts`, `/public/match`, `/public/ask`, `/public/tips`, `/public/tips/{token}`. Only newsrooms that publish their verdicts appear.
