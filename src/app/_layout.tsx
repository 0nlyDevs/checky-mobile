import { BricolageGrotesque_400Regular, BricolageGrotesque_500Medium, BricolageGrotesque_600SemiBold, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { CormorantGaramond_500Medium_Italic } from "@expo-google-fonts/cormorant-garamond";
import { useFonts } from "expo-font";
import { Stack, useRouter, usePathname, type ErrorBoundaryProps } from "expo-router";
import * as Notifications from "expo-notifications";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SWRConfig } from "swr";

import { CitizenBar } from "@/components/citizen-bar";
import { StatusScreen } from "@/components/status-screen";
import { ClipboardOffer } from "@/components/clipboard-offer";
import { NativeSurfaces } from "@/components/native-surfaces";
import { OfflineSync } from "@/components/offline-sync";
import { Button, Notice } from "@/components/ui";
import { authClient } from "@/lib/auth";
import { persistentCache } from "@/lib/cache";
import { MAX_BATCH } from "@/lib/group";
import { type Check, handOff } from "@/lib/handoff";
import { useLangReady, useT } from "@/lib/i18n";
import { LightProvider } from "@/lib/light";
import { ModeProvider, useMode } from "@/lib/mode";
import { onReconnect } from "@/lib/network";
import { askToNotify } from "@/lib/notify";
import { holdForBackground, OutboxProvider, useOutbox } from "@/lib/outbox";
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
  const router = useRouter();
  const chosen = useRef<string | null | undefined>(undefined);

  const path = usePathname();
  // Each account state has its own first screen. While the session and /me load, the routes
  // unmount; they come back on the screen the person was on (« inscription »), which signing in
  // just closed, and Expo Router showed its 404. Send them where they belong instead.
  useEffect(() => {
    if (!ready) return;
    if (signedIn && !current) {
      if (path !== "/bienvenue") router.replace("/bienvenue");
    } else if (signedIn && current && ["/accueil", "/connexion", "/inscription", "/bienvenue"].includes(path)) {
      router.replace("/");
    }
  }, [ready, signedIn, current, path, router]);

  // A mode chosen on the first screen opens its own home. Left to Stack.Protected, the
  // welcome screen gave way to whichever public screen it found first: the scanner.
  useEffect(() => {
    if (!ready) return;
    if (chosen.current === undefined) {
      chosen.current = mode;
      return;
    }
    if (chosen.current === null && !signedIn) {
      if (mode === "citizen") router.replace("/citoyen");
      else if (mode === "journalist") router.replace("/connexion");
    }
    chosen.current = mode;
  }, [ready, mode, signedIn, router]);

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
      {inDesk && <NotificationOpener />}
      {inDesk && <NativeSurfaces />}
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
          <Stack.Screen name="lot" />
          <Stack.Screen name="affirmation/[id]" />
          <Stack.Screen name="nouvelle" options={{ presentation: "modal" }} />
          <Stack.Screen name="annuaire" />
          <Stack.Screen name="chiffres" />
        </Stack.Protected>
      </Stack>
      {inDesk && <ClipboardOffer to="/analyse" />}
      {citizen && <ClipboardOffer to="/citoyen/verifier" />}
      {citizen && <CitizenBar />}
    </>
  );
}

/** Something shared to Checky from another app (a WhatsApp video, a TikTok link…) opens the analysis
 * in the desk, or the "already checked?" screen for a citizen. Several screenshots at once go to
 * the desk's queue together and open the batch screen, where they are grouped by rumour. */
function ShareForwarder({ to }: { to: "/analyse" | "/citoyen/verifier" }) {
  const router = useRouter();
  const outbox = useOutbox();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  useEffect(() => {
    if (!hasShareIntent) return;
    const files = (shareIntent.files ?? []).map((file) => ({
      uri: file.path.startsWith("/") ? `file://${file.path}` : file.path,
      mime: file.mimeType,
      name: file.fileName,
      size: file.size,
    }));
    resetShareIntent();
    if (to === "/analyse" && files.length > 1) {
      const batch = `b${Date.now().toString(36)}`;
      // Asked now, while Checky is on screen: Android refuses both from the background.
      void askToNotify();
      holdForBackground();
      for (const file of files.slice(0, MAX_BATCH)) {
        try {
          outbox.add({ kind: "check", check: { file }, notify: true, batch });
        } catch {
          // too large: left out of the batch
        }
      }
      router.push({ pathname: "/lot", params: { batch, more: files.length > MAX_BATCH ? "1" : undefined } });
      return;
    }
    const check: Check = { shared: true };
    if (files[0]) {
      check.file = files[0];
    } else {
      if (shareIntent.webUrl) check.url = shareIntent.webUrl;
      const text = (shareIntent.text ?? "").trim();
      if (text && text !== shareIntent.webUrl) check.text = text;
    }
    if (check.file || check.url || check.text) router.push({ pathname: to, params: { id: handOff(check) } });
  }, [hasShareIntent, shareIntent, resetShareIntent, router, to, outbox]);

  return null;
}

/** A tap on « Vérification prête » opens that check, or the batch of screenshots. */
function NotificationOpener() {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  const seen = useRef<string | null>(null);

  useEffect(() => {
    const id = response?.notification.request.identifier;
    if (!response || !id || seen.current === id) return;
    seen.current = id;
    const data = response.notification.request.content.data as { entry?: unknown; batch?: unknown };
    if (typeof data.batch === "string") router.push({ pathname: "/lot", params: { batch: data.batch } });
    else if (typeof data.entry === "string") router.push({ pathname: "/analyse", params: { id: handOff({ queued: data.entry }) } });
    Notifications.clearLastNotificationResponseAsync().catch(() => null);
  }, [response, router]);

  return null;
}

/** An error anywhere in the app shows Checky's own screen with Réessayer, instead of closing it.
 * Navigation itself may be what failed here, so the way out is to render again. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <StatusScreen kind="error" onRetry={() => void retry()} />;
}
