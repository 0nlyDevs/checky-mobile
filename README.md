# FANILO mobile

The FANILO phone app for journalists in Madagascar. A video, photo, voice note or link received on WhatsApp, Facebook or TikTok goes through **Partager → FANILO**. The app then:

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
| `/citoyen/signaler` | Send a tip (`/public/tips`); its follow-up token is remembered on the phone |
| `/citoyen/suivi/[token]` | Where the tip stands, refreshed every 30 s, and its verdict once published |
| `/citoyen/verdict/[id]` | A published verdict: reason, post, sources; share the card image or the text with its web link |
| `/connexion`, `/inscription` | Sign in, sign up (same accounts as the desk) |
| `/bienvenue` | Create a newsroom (optionally with the demo claims) or join with an invitation link |
| `/` Analyser | Pick a video/photo from the gallery, or paste a link or text |
| `/analyse` | The check, step by step: upload → transcription → read → claims and warning signs → search → suggested verdict. Then the content, the dashed AI suggestion and the quotes it rests on, the warning signs, the file's AI traces (C2PA, generator tags such as Sora or Midjourney), reverse image search, and results to tick. **Suivre dans le desk** creates the claim and attaches the file and the ticked sources |
| `/affirmations` | The newsroom's claims, filtered by status, searchable |
| `/affirmation/[id]` | A claim: verdict (confirmed with a dialog; never colour alone), **Partager le verdict** (the 1080 × 1080 card in French or Malagasy and the post written from the verdict, through the share sheet; sharing moves a verified claim to Publié, as in the desk), status, AI source analysis, sources (add a link or a file), comments |
| `/verifier` | Ask every source of the newsroom; the answer streams and cites its passages |
| `/reglages` | Account, newsroom switch, service health, demo reset (admin), sign out |

Shared content arrives through [`expo-share-intent`](https://github.com/achorein/expo-share-intent) (Android intent filters for `text/*`, `image/*`, `video/*`, `audio/*` and PDF; an iOS share extension). `ShareForwarder` in `src/app/_layout.tsx` opens `/analyse` with the shared file or link in the desk, or `/citoyen/verifier` in citizen mode. A share made before a mode is chosen, or while a journalist is signed out, waits until then.

## Layout

```
src/app/            Expo Router screens (see above)
src/components/     ui.tsx (text, buttons, fields, verdict badge, status, steps), brand, claim row, auth form
src/lib/            config, auth (Better Auth client), api (JWT + fetch), sse (streams via expo/fetch),
                    upload (presigned PUT with progress, then wait for the ingest job), workspace context,
                    theme (DESIGN.md tokens from the desk), types, i18n/fr.ts (every string)
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
npx tsc --noEmit && npx eslint src
npm run gen:api     # after an API schema change in fanilo-base (expects it checked out next to this repo)
```

## Backend pieces this app relies on (fanilo-base)

- `POST /workspaces/{ws}/files/upload-url` then `…/complete`. Videos (`mp4`, `webm`, `quicktime`, `3gpp`) are accepted. Their soundtrack is pulled out with ffmpeg and transcribed by Groq Whisper; the container's tags are scanned for AI generators.
- `POST /workspaces/{ws}/link-check {source_id}` checks an uploaded file on its transcript (or text, or EXIF).
- `PATCH /workspaces/{ws}/sources/{id} {item_id}` attaches the analysed file to the claim created by **Suivre dans le desk**.
- `POST /workspaces/{ws}/copilot/act` creates the claim (next FAN ref) and attaches links.
- `POST /workspaces/{ws}/items/{id}/post {language}` writes the post for the verdict card.
- Citizen mode: `/public/newsrooms`, `/public/verdicts`, `/public/match`, `/public/ask`, `/public/tips`, `/public/tips/{token}`. Only newsrooms that publish their verdicts appear.
