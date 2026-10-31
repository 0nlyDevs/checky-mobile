// Where the FANILO web app (Better Auth) and API live. On a phone plugged into the dev machine,
// `adb reverse tcp:3000 tcp:3000 && adb reverse tcp:8000 tcp:8000` keeps these localhost URLs working.
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
