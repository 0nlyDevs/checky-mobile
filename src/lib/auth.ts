import { expoClient } from "@better-auth/expo/client";
import { jwtClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { kv } from "@/lib/kv";

import { WEB_URL } from "@/lib/config";

// Same Better Auth as the web desk; the session cookie lives in `lib/kv` (SecureStore, else a private file).
export const authClient = createAuthClient({
  baseURL: WEB_URL,
  plugins: [expoClient({ scheme: "fanilo", storagePrefix: "fanilo", storage: kv }), jwtClient()],
});
