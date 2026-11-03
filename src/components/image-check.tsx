import { File } from "expo-file-system";
import { Image } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";

import { Card, Notice, Step, T, styles } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { openWeb } from "@/lib/handoff";
import { tr, useT } from "@/lib/i18n";
import { ArrowSquareOut } from "@/lib/icons";
import { IMAGE_TYPES, type ImageCheck, MAX_IMAGE_BYTES, publicImageCheck } from "@/lib/public";
import { fonts, radius, useTheme } from "@/lib/theme";

type Picked = { uri: string; mime: string; name: string; size?: number | null };

const EDGE = 2048;

/** A photo the check cannot take as it is (HEIC, or over 5 MB) is re-encoded as a JPEG of at most
 * 2048 px. Its pixels still go to the detector; its EXIF, C2PA and generator tags are lost, which
 * the card says. */
async function sendable(p: Picked): Promise<{ uri: string; mime: string; reduced: boolean }> {
  const mime = p.mime === "image/jpg" ? "image/jpeg" : p.mime;
  let size = p.size ?? null;
  if (!size) {
    try {
      size = new File(p.uri).size;
    } catch {
      size = null;
    }
  }
  if (IMAGE_TYPES.includes(mime) && size !== null && size <= MAX_IMAGE_BYTES) return { uri: p.uri, mime, reduced: false };
  const first = await ImageManipulator.manipulate(p.uri).renderAsync();
  const ref =
    Math.max(first.width, first.height) > EDGE
      ? await ImageManipulator.manipulate(p.uri)
          .resize(first.width >= first.height ? { width: EDGE } : { height: EDGE })
          .renderAsync()
      : first;
  const out = await ref.saveAsync({ compress: 0.85, format: SaveFormat.JPEG });
  return { uri: out.uri, mime: "image/jpeg", reduced: true };
}

/** What a shared photo's file and the detector say, as the extension shows it: hints, the
 * detector's own score, and where to search the picture. Never a verdict; nothing is stored. */
export function ImageCheckCard({ file }: { file: Picked }) {
  const t = useT();
  const c = useTheme();
  const i = t.image;
  const [result, setResult] = useState<ImageCheck | null>(null);
  const [reduced, setReduced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const i = tr().image;
      try {
        const ready = await sendable(file);
        const res = await publicImageCheck(ready.uri, ready.mime);
        if (!live) return;
        setReduced(ready.reduced);
        setResult(res);
      } catch (e) {
        if (!live) return;
        const status = e instanceof ApiError ? e.status : 0;
        setError(status === 415 ? i.unsupported : status === 429 ? tr().citizen.tooMany : i.failed);
      }
    })();
    return () => {
      live = false;
    };
  }, [file]);

  const d = result?.detector;
  const scored = d?.status === "assessed" && typeof d.score === "number";
  const markers = result?.image.ai_markers ?? [];

  return (
    <Card>
      {/* The photo being examined, so there is no doubt which one the hints are about. */}
      <Image
        source={{ uri: file.uri }}
        contentFit="cover"
        accessibilityLabel={i.thumbnail}
        style={{ width: "100%", height: 200, borderRadius: radius.card, backgroundColor: c.muted }}
      />
      <T style={{ fontFamily: fonts.bold, fontSize: 17 }}>{i.title}</T>
      <T tone="muted">{i.lead}</T>
      {!result && !error && <Step label={i.checking} state="running" />}
      {error && <Notice tone="error">{error}</Notice>}
      {result && (
        <View style={{ gap: 10 }}>
          <View style={{ gap: 2 }}>
            <T style={{ fontFamily: fonts.semibold, fontSize: 14 }}>{i.detector}</T>
            {scored ? (
              <>
                <T style={{ fontFamily: fonts.bold, fontSize: 17 }}>{i.score(Math.round((d.score ?? 0) * 100))}</T>
                <T>{d.assessment === "detected" ? i.detected : d.assessment === "none" ? i.none : i.inconclusive}</T>
                <T tone="muted" style={{ fontSize: 13 }}>
                  {i.scoreHint}
                </T>
              </>
            ) : (
              <T tone="muted">{i.unassessed}</T>
            )}
          </View>
          <View style={{ gap: 2 }}>
            <T style={{ fontFamily: fonts.semibold, fontSize: 14 }}>{i.markers}</T>
            {markers.length > 0 ? <T>{markers.join(", ")}</T> : !result.image.content_credentials && <T tone="muted">{i.noMarkers}</T>}
            {result.image.content_credentials && <T>{i.credentials}</T>}
          </View>
          {reduced && (
            <T tone="muted" style={{ fontSize: 13 }}>
              {i.reduced}
            </T>
          )}
          {result.reverse_search.length > 0 && (
            <View style={{ gap: 6 }}>
              <T style={{ fontFamily: fonts.semibold, fontSize: 14 }}>{i.reverse}</T>
              {result.reverse_search.map((link) => (
                <Pressable key={link.url} accessibilityRole="link" onPress={() => openWeb(link.url)} hitSlop={6} style={[styles.row, { gap: 6, alignSelf: "flex-start" }]}>
                  <T style={{ fontFamily: fonts.semibold, textDecorationLine: "underline" }}>{link.name}</T>
                  <ArrowSquareOut size={16} color={c.foreground} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}
    </Card>
  );
}
