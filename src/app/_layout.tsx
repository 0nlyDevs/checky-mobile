import { BricolageGrotesque_400Regular, BricolageGrotesque_500Medium, BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { CormorantGaramond_500Medium_Italic } from "@expo-google-fonts/cormorant-garamond";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SWRConfig } from "swr";

import { ClipboardOffer } from "@/components/clipboard-offer";
import { OfflineSync } from "@/components/offline-sync";
import { Button, Notice } from "@/components/ui";
import { authClient } from "@/lib/auth";
import { persistentCache } from "@/lib/cache";
import { type Check, handOff } from "@/lib/handoff";
import { useLangReady, useT } from "@/lib/i18n";
import { LightProvider } from "@/lib/light";
import { ModeProvider, useMode } from "@/lib/mode";
import { onReconnect } from "@/lib/network";
import { OutboxProvider } from "@/lib/outbox";
import { useTheme } from "@/lib/theme";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace";

SplashScreen.preventAutoHideAsync().catch(() => null);

export default function RootLayout() {
  const [loaded] = useFonts({
    BricolageGrotesque_400Regular,
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    CormorantGaramond_500Medium_Italic,
  });
  // The stored language is read first, so nothing opens in one language and turns into another.
  const langReady = useLangReady();
  if (!loaded || !langReady) return null;
  return (
    // Kept until the journalist is signed in, so a share made while signed out is not lost.
    <ShareIntentProvider options={{ resetOnBackground: false }}>
      <SafeAreaProvider>
        {/* The desk keeps lists fresh over Socket.IO; here a pull, a screen focus or the network coming back
            refetches. The cache is kept on the phone so what was opened stays readable offline. */}
        <SWRConfig value={{ revalidateOnFocus: false, dedupingInterval: 4000, provider: persistentCache, initReconnect: onReconnect }}>
          <ModeProvider>
            <LightProvider>
              <Session />
            </LightProvider>
          </ModeProvider>
        </SWRConfig>
      </SafeAreaProvider>
    </ShareIntentProvider>
  );
}

function Session() {
  const { data: session, isPending } = authClient.useSession();
  const signedIn = !!session;
  return (
    <WorkspaceProvider signedIn={signedIn}>
      <OutboxProvider>
        {/* A session cached on the phone opens the app at once: on a weak network the check can take long. */}
        <Routes signedIn={signedIn} pending={isPending && !signedIn} />
      </OutboxProvider>
    </WorkspaceProvider>
  );
}

function Routes({ signedIn, pending }: { signedIn: boolean; pending: boolean }) {
  const t = useT();
  const c = useTheme();
  const { current, loading, error, refresh } = useWorkspace();
  const { mode, loaded, setMode } = useMode();
  const ready = loaded && !pending && !(signedIn && loading && !current);

  // Signing out of the desk comes back to the sign-in screen, not the citizen side.
  useEffect(() => {
    if (signedIn && mode !== "journalist") setMode("journalist");
  }, [signedIn, mode, setMode]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => null);
  }, [ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.background }}>
        <ActivityIndicator color={c.foreground} />
      </View>
    );
  }
  if (signedIn && error && !current) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 16, gap: 12, backgroundColor: c.background }}>
        <Notice tone="error">{t.common.offline}</Notice>
        <Button label={t.common.retry} onPress={() => refresh()} />
      </View>
    );
  }
  const inDesk = signedIn && !!current;
  const citizen = !signedIn && mode === "citizen";
  return (
    <>
      <StatusBar style="auto" />
      <OfflineSync desk={inDesk} />
      {inDesk && <ShareForwarder to="/analyse" />}
      {citizen && <ShareForwarder to="/citoyen/verifier" />}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
        {/* The first screen allowed is where the app opens. */}
        <Stack.Protected guard={!signedIn && !mode}>
          <Stack.Screen name="accueil" />
        </Stack.Protected>
        <Stack.Protected guard={citizen}>
          <Stack.Screen name="citoyen/index" />
          <Stack.Screen name="citoyen/verifier" />
          <Stack.Screen name="citoyen/signaler" />
          <Stack.Screen name="citoyen/suivi/[token]" />
        </Stack.Protected>
        {/* Public, kept on the phone: readable by everyone, account or not. */}
        <Stack.Protected guard={citizen || inDesk}>
          <Stack.Screen name="citoyen/verdict/[id]" />
          <Stack.Screen name="registre" />
          <Stack.Screen name="verdicts" />
          <Stack.Screen name="scanner" />
          <Stack.Screen name="assistant" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="connexion" />
          <Stack.Screen name="inscription" />
        </Stack.Protected>
        <Stack.Protected guard={signedIn && !current}>
          <Stack.Screen name="bienvenue" />
        </Stack.Protected>
        <Stack.Protected guard={inDesk}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="analyse" />
          <Stack.Screen name="affirmation/[id]" />
          <Stack.Screen name="nouvelle" options={{ presentation: "modal" }} />
          <Stack.Screen name="annuaire" />
          <Stack.Screen name="chiffres" />
        </Stack.Protected>
      </Stack>
      {inDesk && <ClipboardOffer to="/analyse" />}
      {citizen && <ClipboardOffer to="/citoyen/verifier" />}
    </>
  );
}

/** Something shared to Checky from another app (a WhatsApp video, a TikTok link…) opens the analysis
 * in the desk, or the "already checked?" screen for a citizen. */
function ShareForwarder({ to }: { to: "/analyse" | "/citoyen/verifier" }) {
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  useEffect(() => {
    if (!hasShareIntent) return;
    const file = shareIntent.files?.[0];
    const check: Check = { shared: true };
    if (file) {
      check.file = {
        uri: file.path.startsWith("/") ? `file://${file.path}` : file.path,
        mime: file.mimeType,
        name: file.fileName,
        size: file.size,
      };
    } else {
      if (shareIntent.webUrl) check.url = shareIntent.webUrl;
      const text = (shareIntent.text ?? "").trim();
      if (text && text !== shareIntent.webUrl) check.text = text;
    }
    resetShareIntent();
    if (check.file || check.url || check.text) router.push({ pathname: to, params: { id: handOff(check) } });
  }, [hasShareIntent, shareIntent, resetShareIntent, router, to]);

  return null;
}
