import { ImageIcon, PenLine, Share2 } from "lucide-react-native";
import { useRef, useState } from "react";
import { Share, useWindowDimensions, View } from "react-native";

import { Button, Card, Chip, Field, Notice, T, styles } from "@/components/ui";
import { type CardLang, type CardRef, shareCard, VerdictCardView } from "@/components/verdict-card";
import { api, ApiError } from "@/lib/api";
import { t } from "@/lib/i18n/fr";
import type { ClaimData, Item, Source, Verdict } from "@/lib/types";

/** F5 on the phone: the 1080 × 1080 card and its post, shared to WhatsApp, Facebook… once the verdict is confirmed. */
export function ShareVerdict({ ws, item, verdict, sources, desk, onShared }: { ws: string; item: Item; verdict: Verdict; sources: Source[]; desk: string; onShared: () => void }) {
  const { width } = useWindowDimensions();
  const d = item.data as ClaimData & { posts?: Partial<Record<CardLang, string>> };
  const [lang, setLang] = useState<CardLang>("fr");
  const [reason, setReason] = useState((d.analysis?.reason ?? "").slice(0, 280));
  const [post, setPost] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef: CardRef = useRef(null);
  const text = post ?? d.posts?.[lang] ?? "";

  async function write() {
    setWriting(true);
    setError(null);
    try {
      const r = await api<{ text: string }>(`/workspaces/${ws}/items/${item.id}/post`, { method: "POST", body: JSON.stringify({ language: lang }) });
      setPost(r.text);
    } catch (e) {
      setError(e instanceof ApiError && e.code === "ai_unavailable" ? t.card.aiDown : t.card.failed);
    } finally {
      setWriting(false);
    }
  }

  async function image() {
    setSharing(true);
    setError(null);
    try {
      if (await shareCard(cardRef, t.card.title)) onShared();
    } catch {
      setError(t.card.exportFailed);
    } finally {
      setSharing(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.wrap}>
        {(["fr", "mg"] as const).map((l) => (
          <Chip
            key={l}
            label={t.card.languages[l]}
            selected={lang === l}
            onPress={() => {
              setLang(l);
              setPost(null);
            }}
          />
        ))}
      </View>
      <VerdictCardView
        width={width - 32}
        cardRef={cardRef}
        verdict={verdict}
        title={item.title}
        reason={reason}
        sources={sources.map((s) => s.title ?? "").filter(Boolean)}
        refLabel={d.ref}
        desk={desk}
        lang={lang}
      />
      <Field label={t.card.reason} value={reason} onChangeText={(v) => setReason(v.slice(0, 280))} multiline style={{ minHeight: 80, textAlignVertical: "top" }} />
      <Button label={t.card.shareImage} icon={ImageIcon} busy={sharing} onPress={image} />
      <T tone="label">{t.card.post}</T>
      {text ? (
        <Card>
          <T selectable>{text}</T>
        </Card>
      ) : (
        <T tone="muted">{t.card.postEmpty}</T>
      )}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label={text ? t.card.rewrite : t.card.write} icon={PenLine} variant="outline" busy={writing} style={{ flex: 1 }} onPress={write} />
        {!!text && (
          <Button
            label={t.card.shareText}
            icon={Share2}
            variant="outline"
            style={{ flex: 1 }}
            onPress={async () => {
              const r = await Share.share({ message: text });
              if (r.action === Share.sharedAction) onShared();
            }}
          />
        )}
      </View>
      {error && <Notice tone="error">{error}</Notice>}
    </View>
  );
}
