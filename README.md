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
| `/citoyen/verifier` | « Est-ce déjà vérifié ? » as on the web's public site (`/public/verify`): a verdict a newsroom signed, else a fact-checker's review, else what is known (registry, official figure, first appearance, tone), then « Demander à une rédaction » and « Me prévenir » (`/public/notify`). A shared or picked photo also gets the public image check (`/public/image-check/file`: file hints, the detector's score, reverse search; never a verdict, nothing stored; a HEIC or over-5 MB photo is checked as a reduced JPEG and says so). No AI verdict ever reaches a citizen |
| `/citoyen/signaler` | Send a tip (`/public/tips`) to a chosen newsroom, or « Je ne sais pas : Checky choisit » (routed by the place typed and the phone's country); its follow-up token is remembered on the phone |
| `/citoyen/suivi/[token]` | Where the tip stands, refreshed every 30 s, and its verdict once published |
| `/citoyen/verdict/[id]` | A published verdict: reason, post, sources; share the card image or the text with its web link |
| `/connexion`, `/inscription` | Sign in, sign up (same accounts as the desk) |
| `/bienvenue` | Create a newsroom (optionally with the demo claims) or join with an invitation link |
| `/` Analyser | Pick a video/photo from the gallery, or paste a link or text |
| `/lot` | Several screenshots shared at once: each one uploaded and checked through the queue, then grouped by rumour (same file, same picture by difference hash, same claim already followed in the desk, or the same claim's words; `src/lib/group.ts`) |
| `/analyse` | The check, step by step: upload → transcription → read → claims and warning signs → search → suggested verdict. Then the content, the dashed AI suggestion and the quotes it rests on, the warning signs, the file's AI traces (C2PA, generator tags such as Sora or Midjourney), reverse image search, and results to tick. **Suivre dans le desk** creates the claim and attaches the file and the ticked sources |
| `/affirmations` | The newsroom's claims, filtered by status, searchable |
| `/affirmation/[id]` | A claim: verdict (confirmed with a dialog; never colour alone), **Partager le verdict** (the 1080 × 1080 card in French or Malagasy and the post written from the verdict, through the share sheet; sharing moves a verified claim to Publié, as in the desk), status, AI source analysis, sources (add a link or a file), comments |
| `/verifier` | **Avant l'antenne** (default): the caller's claim, typed or dictated with the keyboard's microphone, is matched against published verdicts (`/public/match`, then the newsroom's own through `/items/similar`). A match shows « Déjà vérifié : … » with the newsroom, the date and a two-sentence radio line to copy; with none, it never says « Faux »: it says nothing is published, gives a neutral line for the air, shows whether the desk already follows it, and offers **Suivre dans le desk** (origin radio, queued offline). **Nos sources**: ask every source of the newsroom; the answer streams and cites its passages |
| `/reglages` | Language, account, newsroom switch and its verification status, Mode léger, offline sync, service health, demo reset, sign out |
| `/assistant` | Checky's assistant, opened by the Checky button (desk tabs and citizen home), as on the web: the visitors' guide without an account (`/public/agent`: cited published verdicts, a tip drafted then sent by the citizen, their tips' follow-up) or the newsroom copilot (`/workspaces/{ws}/copilot`, proposals confirmed through `copilot/act`). Pages it opens map to the app's screens, else the web. No voice mode yet |
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

## From any app (Android)

The journalist never leaves the app they are in.

- **The text-selection menu (`modules/checky-text`).** Select a sentence in Chrome, Messages or any app with the standard menu: three entries appear, « Checky », « Traduire FR ↔ MG » and « Remplacer par le démenti » (one `PROCESS_TEXT` activity plus two `activity-alias`, declared in the local module's manifest, which Gradle merges into the app; labels in `res/values*/strings.xml`, Malagasy to be reread). The activity is a translucent `ReactActivity` that renders the JS component `checky-sheet` (`src/sheet/process-text.tsx`, registered in `index.ts`) on the app's own React host, so it shares the app's session and memory. The answer slides up as a sheet; « Retour », the back key or a tap outside go back where the journalist was.
  - « Checky »: a journalist gets the link check on the text (or the link) with the reading dashed, plus any verdict a newsroom published; a citizen gets published verdicts only. « Voir tout dans Checky » opens the full analysis without running it again.
  - « Traduire FR ↔ MG » (journalists): `POST /workspaces/{ws}/translate`; the direction is guessed from the text (`src/lib/lang.ts`) and can be flipped. The translation replaces the selection through `setResult(EXTRA_PROCESS_TEXT)`. Malagasy is flagged « À relire » and replaces nothing until « Relu en malgache » is ticked.
  - « Remplacer par le démenti »: `/public/match` on the selection; the journalist picks the published verdict, and its post (or its signed word and reason) and its link replace the rumour in the message being written (`src/lib/debunk.ts`). Nothing published matches: nothing is replaced, and « Introuvable » is not « Faux ».
  - Android shows every entry on every selection. On read-only text (a web page, a received message) nothing can be replaced, so translate and démenti offer « Copier » instead. WhatsApp and some Facebook screens use their own menu without these entries: the share sheet does the same job there.
- **Several screenshots at once.** Share up to 10 images from the gallery (`SEND_MULTIPLE`): they go into the queue together and `/lot` shows them grouped by rumour as their checks come back. The API reads no text in images yet (no OCR), so screenshots group by file, picture and followed claim until it does.
- **Check in the background.** « Continuer en arrière-plan » on a running check (and every batch) hands it to the queue and steps back to the app the journalist came from. A foreground service (`CheckWorkService`, type `dataSync`, notification « Vérification en cours… ») keeps the app from being frozen while it runs; when it is done a local notification (`expo-notifications`) says « Vérification prête · lecture : Trompeur » (the reading named as a reading) and opens the result. Android limits, honestly: the service has to start while Checky is on screen (Android 12+), Android 15 caps `dataSync` services at 6 hours a day, and a phone maker's battery saver can still kill the app. Then `expo-background-task` (WorkManager, every 15 minutes at best, often later, only with a network) sends what still waits, and the notification follows; otherwise it all resumes when Checky is opened. Notifications need the Android 13+ permission, asked the first time.
- **« Vérifier ce que vous venez de copier ? »** When Checky opens or comes back with a link or a sentence in the clipboard that it never offered, a card offers to check it (one tap « Non merci » dismisses it). The clipboard is read once per return and only when it holds text, so Android 13+ shows its « collé » toast at that moment; only a fingerprint is kept (`fanilo.clip`), never the text. Android only: iOS would ask permission to paste each time.

### La bulle over reels: not built yet

Spec 4.3 (a disc over other apps that records 15 s of a reel) needs native work that could not be tested on a device here, so none of it ships. The design, for whoever builds it:

1. Réglages » « Bulle Checky » asks `SYSTEM_ALERT_WINDOW` (`Settings.ACTION_MANAGE_OVERLAY_PERMISSION`); Android Go refuses it, and the menu and share sheet stay the way in.
2. A foreground service of type `mediaProjection` (Android 14+ requires the type, and a new consent each session) owns a `TYPE_APPLICATION_OVERLAY` view: the draggable disc, hidden while Checky is in front and during calls (`TelephonyManager` call state), put away by a long press.
3. A tap asks `MediaProjectionManager.createScreenCaptureIntent()` once per session, then records 15 s with `MediaRecorder` on a `VirtualDisplay` (picture) plus `AudioPlaybackCaptureConfiguration` (the reel's sound, Android 10+, only from apps that allow capture), or one frame through `ImageReader` for a photo. The disc shows « J'écoute… 15 s ».
4. The clip goes through the same queue as a shared video (upload, faces blurred server-side, transcription of French only, the check), and the disc opens into a small card over the reel with the main claim and « Déjà vérifié » when known; « Voir tout » opens `/analyse`.
5. The capture is deleted after the check unless the journalist follows it in the desk.

## Working without a network

For reporters in areas with weak or no coverage. The checks themselves (AI, search, file reading) run on the server, so the phone does not verify offline. Instead, nothing captured is lost and nothing already opened becomes unreadable.

- **"À envoyer" (`src/lib/outbox.tsx`)**: the queue lives at module level, so the background task can run it with no screen. With no network, `/analyse` and `/nouvelle` put the check or the new claim in a queue saved on the phone (`documentDirectory/outbox/`; files are copied there so a cleared share cache does not lose them). The queue is sent when the network comes back, when the app returns to the front, and every 30 s while something waits. A file is uploaded only once (`sourceId` is kept), and the link check runs in the background. The result shows up on the Analyser tab as "Analyse prête", and "Suivre" works as usual from there. Server failures back off up to 10 min, and refusals (too large, wrong type) are marked failed. Only in-app actions fill the queue, never a deep link. It runs while the app is open, while a background check holds the foreground service, and in the `expo-background-task` follow-up.
- **Cached reading (`src/lib/cache.ts`)**: the SWR cache is saved to `swr-cache.json`. Claims, files and verdicts already opened stay readable, and the app opens offline because `/me` and the Better Auth session (`fanilo_session_data`) are cached. SWR refetches when the network returns (`initReconnect` via `expo-network`).
- **Synced reading (`src/lib/offline.ts`)**: on opening and reconnecting, the phone stores published verdicts, issuer keys and revocations, the last 90 days of the registry, and a signed-in newsroom's Ma rubrique, directory, figures and cases. Each screen shows when its copy was saved. Réglages offers an immediate refresh. A public QR seal is checked against those saved keys with no network; the signed title, number and date are shown for comparison with the paper. An unknown or outdated key is never called fake. A photo of a printed notice joins the normal analysis or the outbox.
- **Mode léger**: text first, heavy media only after a tap, slower refresh and compressed photos when sending over a slow link. Compression strips EXIF and C2PA markers, and the switch says so. The setting is kept on the phone; a slow sync offers it once per launch.
- **Weak networks**: `api()` gives up after 60 s and a queued link check after 5 min, so a stalled request does not block the queue.
- **Sign-out** wipes the cache and the queue, after a confirmation when something is unsent.
- Photos are sent uncompressed unless Mode léger is on: recompression strips the EXIF, C2PA and AI markers the server checks.

## Layout

```
index.ts            Entry: Expo Router, the selection-menu sheet (`checky-sheet`) and the background task
modules/checky-text Local Expo module (Android): the PROCESS_TEXT activity and its aliases, the sheet's
                    translucent theme, the foreground service of background checks
src/sheet/          The selection-menu sheet (check, translate, démenti)
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
npx tsc --noEmit && npx eslint src index.ts modules && npm test
npx expo export --platform android   # the bundle builds
npm run gen:api     # after an API schema change in fanilo-base (expects it checked out next to this repo)
```

## Backend pieces this app relies on (fanilo-base)

- `POST /workspaces/{ws}/files/upload-url` then `…/complete`. Videos (`mp4`, `webm`, `quicktime`, `3gpp`) are accepted. Their soundtrack is pulled out with ffmpeg and transcribed by Groq Whisper; the container's tags are scanned for AI generators.
- `POST /workspaces/{ws}/link-check {source_id}` checks an uploaded file on its transcript (or text, or EXIF).
- `PATCH /workspaces/{ws}/sources/{id} {item_id}` attaches the analysed file to the claim created by **Suivre dans le desk**.
- `POST /workspaces/{ws}/copilot/act` creates the claim (next FAN ref) and attaches links.
- `POST /workspaces/{ws}/items/{id}/post {language}` writes the post for the verdict card.
- `POST /workspaces/{ws}/translate {text, to: fr|mg}` translates a selection (`reread_needed` for Malagasy).
- Citizen mode: `/public/newsrooms`, `/public/verdicts`, `/public/match`, `/public/ask`, `/public/tips`, `/public/tips/{token}`. Only newsrooms that publish their verdicts appear.
