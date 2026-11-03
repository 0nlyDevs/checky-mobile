import { createContext, useContext, useState } from "react";
import { usePathname, useRouter, type Href } from "expo-router";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AddressBook, ArrowLeft, ChartBar, ChatTeardropText, Gear, List, ListChecks, Microphone, Newspaper, PaperPlaneTilt, QrCode, Scan, SealCheck, Stamp, X, type Icon } from "@/lib/icons";
import { useT } from "@/lib/i18n";
import { useMode } from "@/lib/mode";
import { fonts, useTheme } from "@/lib/theme";
import { useWorkspace } from "@/lib/workspace";

export const AppChromeContext = createContext(false);
export const useAppChrome = () => useContext(AppChromeContext);

/** Visible outside the scroll area on every working screen, including nested detail screens. */
export function AppHeader() {
  const t = useT();
  const c = useTheme();
  const router = useRouter();
  const path = usePathname();
  const { width, fontScale } = useWindowDimensions();
  const { mode, setMode } = useMode();
  const { current, me } = useWorkspace();
  const [open, setOpen] = useState(false);
  const desk = mode === "journalist" && !!current;
  const home: Href = desk ? "/rubrique" : mode === "journalist" ? "/bienvenue" : "/citoyen";
  const root = ["/", "/rubrique", "/affirmations", "/verifier", "/reglages", "/citoyen"].includes(path);
  const go = (href: Href) => { setOpen(false); router.navigate(href); };
  const rows: { label: string; detail?: string; icon: Icon; href: Href }[] = [
    { label: t.navigation.home, icon: Newspaper, href: home },
    ...(desk || mode === "citizen" ? [{ label: desk ? t.analyse.title : t.citizen.check, icon: Scan, href: (desk ? "/" : "/citoyen/verifier") as Href }] : []),
    ...(desk ? [
      { label: t.claims.title, icon: ListChecks, href: "/affirmations" as Href },
      { label: t.tabs.ask, icon: ChatTeardropText, href: "/verifier" as Href },
      { label: t.directory.title, icon: AddressBook, href: "/annuaire" as Href },
      { label: t.figures.title, icon: ChartBar, href: "/chiffres" as Href },
    ] : mode === "citizen" ? [{ label: t.tip.title, icon: PaperPlaneTilt, href: "/citoyen/signaler" as Href }, { label: t.citizen.mine, icon: ListChecks, href: "/citoyen/signalements" as Href }] : []),
    { label: t.citizen.latest, icon: SealCheck, href: "/verdicts" },
    { label: t.registry.title, icon: Stamp, href: "/registre" },
    { label: t.scanner.title, icon: QrCode, href: "/scanner" },
    { label: t.assistant.title, icon: Microphone, href: "/assistant" },
    { label: t.navigation.account, icon: Gear, href: desk ? "/reglages" : "/preferences" },
    ...(me?.platform_admin ? [{ label: t.navigation.admin, detail: t.navigation.adminHint, icon: SealCheck, href: "/administration" as Href }] : []),
  ];
  const control = { minHeight: 44, paddingHorizontal: 10, flexDirection: "row" as const, alignItems: "center" as const, gap: 6, borderRadius: 99 };
  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: c.card }}>
      <View style={{ minHeight: 64, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
        {!root && <Pressable accessibilityRole="button" accessibilityLabel={t.common.back} style={control} onPress={() => router.canGoBack() ? router.back() : router.replace(home)}><ArrowLeft size={22} color={c.foreground} /></Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel={t.navigation.home} onPress={() => go(home)} style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 6 }}>
          <Text allowFontScaling={false} style={{ fontFamily: fonts.display, fontSize: 25, letterSpacing: -1, color: c.foreground }}>Checky.</Text>
          <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ fontFamily: fonts.medium, fontSize: 11, color: c.mutedForeground }}>{desk ? current?.name : t.navigation.public}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t.navigation.speak} style={[control, { backgroundColor: c.muted }]} onPress={() => go({ pathname: "/assistant", params: { voice: "1" } })}><Microphone size={19} color={c.foreground} />{width > 330 && fontScale <= 1.3 && <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: c.foreground }}>{t.navigation.speak}</Text>}</Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t.navigation.menu} accessibilityState={{ expanded: open }} style={control} onPress={() => setOpen(true)}><List size={21} color={c.foreground} /><Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: c.foreground }}>{t.navigation.menu}</Text></Pressable>
      </View>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, borderBottomWidth: 1, borderBottomColor: c.border }}><Text accessibilityRole="header" style={{ fontFamily: fonts.display, color: c.foreground, fontSize: 30 }}>{t.navigation.menu}</Text><Pressable accessibilityRole="button" accessibilityLabel={t.navigation.close} style={control} onPress={() => setOpen(false)}><X size={24} color={c.foreground} /></Pressable></View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 8 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: c.mutedForeground, marginBottom: 10 }}>{desk ? current?.name : t.navigation.public}</Text>
            {rows.map(({ href, label, detail, icon: Glyph }) => <Pressable key={String(href)} accessibilityRole="button" onPress={() => go(href)} style={({ pressed }) => ({ flexDirection: "row", gap: 16, alignItems: "center", minHeight: 58, padding: 16, borderRadius: 16, backgroundColor: pressed ? c.accent : c.card, borderWidth: 1, borderColor: c.border })}><Glyph size={23} color={c.foreground} /><View style={{ flex: 1 }}><Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: c.foreground }}>{label}</Text>{detail && <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: c.mutedForeground }}>{detail}</Text>}</View></Pressable>)}
            {!desk && <Pressable accessibilityRole="button" onPress={() => { setOpen(false); setMode("journalist"); router.replace("/connexion"); }} style={{ padding: 20, minHeight: 56 }}><Text style={{ fontFamily: fonts.semibold, color: c.foreground }}>{t.citizen.journalist}</Text></Pressable>}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
