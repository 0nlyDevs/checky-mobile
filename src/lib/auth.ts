import { expoClient } from "@better-auth/expo/client";
import { jwtClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";

import { WEB_URL } from "@/lib/config";

// Same Better Auth as the web desk; the session cookie lives in SecureStore.
export const authClient = createAuthClient({
  baseURL: WEB_URL,
  plugins: [expoClient({ scheme: "fanilo", storagePrefix: "fanilo", storage: SecureStore }), jwtClient()],
});
