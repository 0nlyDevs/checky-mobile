import { Anton_400Regular } from "@expo-google-fonts/anton";
import { BarlowCondensed_600SemiBold } from "@expo-google-fonts/barlow-condensed";
import { PublicSans_400Regular, PublicSans_500Medium, PublicSans_600SemiBold, PublicSans_700Bold } from "@expo-google-fonts/public-sans";
import { useFonts } from "expo-font";
import { Stack, useRouter } from "expo-router";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SWRConfig } from "swr";

import { Button, Notice } from "@/components/ui";
import { authClient } from "@/lib/auth";
import { t } from "@/lib/i18n/fr";
import { useTheme } from "@/lib/theme";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace";

SplashScreen.preventAutoHideAsync().catch(() => null);

export default function RootLayout() {
  const [loaded] = useFonts({
    PublicSans_400Regular,
    PublicSans_500Medium,
    PublicSans_600SemiBold,
    PublicSans_700Bold,
    BarlowCondensed_600SemiBold,
    Anton_400Regular,
  });
  if (!loaded) return null;
  return (
    // Kept until the journalist is signed in, so a share made while signed out is not lost.
    <ShareIntentProvider options={{ resetOnBackground: false }}>
      <SafeAreaProvider>
        {/* The desk keeps lists fresh over Socket.IO; here a pull or a screen focus refetches. */}
        <SWRConfig value={{ revalidateOnFocus: false, dedupingInterval: 4000 }}>
          <Session />
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
      <Routes signedIn={signedIn} pending={isPending} />
    </WorkspaceProvider>
  );
}

function Routes({ signedIn, pending }: { signedIn: boolean; pending: boolean }) {
  const c = useTheme();
  const { current, loading, error, refresh } = useWorkspace();
  const ready = !pending && !(signedIn && loading && !current);

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
  return (
    <>
      <StatusBar style="auto" />
      {inDesk && <ShareForwarder />}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.background } }}>
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
        </Stack.Protected>
      </Stack>
    </>
  );
}

/** Something shared to FANILO from another app (a WhatsApp video, a TikTok link…) opens the analysis. */
function ShareForwarder() {
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  useEffect(() => {
    if (!hasShareIntent) return;
    const file = shareIntent.files?.[0];
    const params: Record<string, string> = { shared: "1" };
    if (file) {
      params.file = file.path.startsWith("/") ? `file://${file.path}` : file.path;
      params.mime = file.mimeType;
      params.name = file.fileName;
      if (file.size) params.size = String(file.size);
    } else {
      if (shareIntent.webUrl) params.url = shareIntent.webUrl;
      const text = (shareIntent.text ?? "").trim();
      if (text && text !== shareIntent.webUrl) params.text = text;
    }
    resetShareIntent();
    if (params.file || params.url || params.text) router.push({ pathname: "/analyse", params });
  }, [hasShareIntent, shareIntent, resetShareIntent, router]);

  return null;
}
