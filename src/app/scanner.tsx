import { type BarcodeScanningResult, CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useIsFocused, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, View } from "react-native";

import { AgeLine } from "@/components/age-line";
import { Button, Card, Notice, Screen, T, VerdictBadge, styles } from "@/components/ui";
import { day, stamp } from "@/lib/format";
import { handOff } from "@/lib/handoff";
import { useT } from "@/lib/i18n";
import { ArrowLeft, Camera, type Icon, LockSimple, Question, SealCheck, WarningOctagon } from "@/lib/icons";
import { useSealStore } from "@/lib/offline";
import { checkNumber, checkSeal, type SealResult } from "@/lib/seal";
import { fonts, radius, useTheme } from "@/lib/theme";
import type { Verdict } from "@/lib/types";
import { VERDICTS } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace";
import { goBack } from "@/lib/nav";

/** « Scanner » (brief 4.6): a QR seal is checked on the phone against the issuer keys it keeps,
 * with no network; a journalist can also photograph a printed notice, which goes to the
 * ordinary analysis (or waits in « À envoyer »). Open to everyone: no account needed for a QR. */
export default function Scanner() {
  const t = useT();
  const c = useTheme();
  const router = useRouter();
  const focused = useIsFocused();
  const ws = useWorkspace().current?.workspace_id ?? null;
  const { store, at } = useSealStore(ws);
  const [permission, request] = useCameraPermissions();
  const [result, setResult] = useState<SealResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);

  function scanned({ data }: BarcodeScanningResult) {
    if (locked.current || !data) return;
    locked.current = true;
    setResult(checkSeal(data, store));
  }

  function again() {
    setResult(null);
    locked.current = false;
  }

  async function paper() {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setError(t.scanner.permission);
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 });
    const a = res.assets?.[0];
    if (res.canceled || !a) return;
    const mime = a.mimeType ?? "image/jpeg";
    router.push({ pathname: "/analyse", params: { id: handOff({ file: { uri: a.uri, mime, name: a.fileName ?? `papier.${mime.split("/")[1] ?? "jpg"}`, size: a.fileSize } }) } });
  }

  return (
    <Screen>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={t.common.back} onPress={goBack} hitSlop={12} style={{ padding: 4 }}>
          <ArrowLeft size={24} color={c.foreground} />
        </Pressable>
        <T tone="title" style={{ flex: 1 }}>
          {t.scanner.title}
        </T>
      </View>
      <T tone="muted">{t.scanner.lead}</T>
      {at ? <AgeLine at={at} /> : <Notice>{t.scanner.noKeys}</Notice>}

      {result ? (
        <>
          <ResultCard result={result} desk={!!ws} />
          <Button label={t.scanner.again} onPress={again} />
        </>
      ) : !permission ? null : !permission.granted ? (
        <Card>
          <T>{t.scanner.permission}</T>
          <Button label={t.scanner.allow} onPress={() => void request()} />
        </Card>
      ) : (
        <View style={{ height: 320, borderRadius: radius.card, overflow: "hidden", backgroundColor: "#000" }}>
          <CameraView style={{ flex: 1 }} facing="back" active={focused} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={scanned} />
        </View>
      )}

      {!!ws && (
        <View style={{ gap: 8 }}>
          <Button label={t.scanner.paper} icon={Camera} variant="outline" onPress={() => void paper()} />
          <T tone="muted">{t.scanner.paperHint}</T>
        </View>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </Screen>
  );
}

const HEAD: Record<SealResult["status"], Icon> = {
  authentic: SealCheck,
  mismatch: WarningOctagon,
  revoked: LockSimple,
  unknown_issuer: Question,
  not_cached: Question,
  not_seal: Question,
};

/** Every outcome is an icon and a word, never a colour alone; only « Authentique » shows what was signed. */
function ResultCard({ result, desk }: { result: SealResult; desk: boolean }) {
  const t = useT();
  const c = useTheme();
  const router = useRouter();
  const Head = HEAD[result.status];
  const refused = result.status === "mismatch" || result.status === "revoked";
  return (
    <Card accessibilityRole="alert" style={{ gap: 12, borderWidth: 2, borderColor: refused ? c.destructive : c.foreground }}>
      <View style={styles.row}>
        <Head size={28} color={refused ? c.destructive : c.foreground} />
        <T style={{ fontFamily: fonts.display, fontSize: 24, lineHeight: 30, flex: 1, color: refused ? c.destructive : c.foreground }}>{t.scanner.status[result.status]}</T>
      </View>
      {result.status === "authentic" ? (
        <Authentic result={result} />
      ) : result.status === "revoked" ? (
        <T>{t.scanner.explain.revoked(result.signer.startsWith("checky:") ? t.scanner.newsroomKey(result.newsroom.name) : result.signer, stamp(result.revokedAt))}</T>
      ) : result.status === "not_seal" ? (
        <>
          <T>{t.scanner.explain.not_seal}</T>
          <T tone="muted" numberOfLines={4} selectable>
            {result.text}
          </T>
          {/^https?:\/\/\S+$/i.test(result.text.trim()) && (
            <Button
              label={desk ? t.scanner.analyse : t.citizen.check}
              variant="outline"
              onPress={() => router.push({ pathname: desk ? "/analyse" : "/citoyen/verifier", params: { id: handOff({ url: result.text.trim() }) } })}
            />
          )}
        </>
      ) : (
        <T>{t.scanner.explain[result.status]}</T>
      )}
    </Card>
  );
}

function Authentic({ result }: { result: Extract<SealResult, { status: "authentic" }> }) {
  const t = useT();
  const f = result.fields;
  const signer = result.kind === "verdict" ? t.scanner.newsroomKey(result.newsroom.name) : `${result.signer} · ${result.newsroom.name}`;
  const n = result.kind === "verdict" ? checkNumber(f.ref) : null;
  const rows: [string, string | null | undefined][] =
    result.kind === "verdict"
      ? [
          [t.scanner.fields.title, f.title],
          [t.scanner.fields.check, n !== null ? t.scanner.check(n) : f.ref],
          [t.scanner.fields.date, stamp(f.date)],
        ]
      : [
          [t.scanner.fields.issuer, f.issuer],
          [t.scanner.fields.title, f.title],
          [t.scanner.fields.number, f.number],
          [t.scanner.fields.date, day(f.date)],
        ];
  return (
    <View style={{ gap: 10 }}>
      <T style={{ fontFamily: fonts.semibold }}>
        {t.scanner.signedBy(signer)}
        {result.demo ? ` · ${t.offline.demo}` : ""}
      </T>
      {result.kind === "verdict" && f.verdict && (VERDICTS as readonly string[]).includes(f.verdict) && <VerdictBadge verdict={f.verdict as Verdict} large />}
      {rows
        .filter(([, v]) => !!v)
        .map(([label, value]) => (
          <View key={label} style={{ gap: 2 }}>
            <T tone="label">{label}</T>
            <T style={{ fontSize: 18, lineHeight: 25, fontFamily: fonts.medium }} selectable>
              {value}
            </T>
          </View>
        ))}
      <T tone="muted">{t.scanner.compare}</T>
      <T tone="muted">{t.scanner.proves}</T>
    </View>
  );
}
