import { View } from "react-native";

import { Brand } from "@/components/brand";
import { Button, Screen, T } from "@/components/ui";
import { useT } from "@/lib/i18n";

/** What the phone shows instead of Expo Router's « Unmatched Route » or a crash: the brand, a
 * plain title, one line, and the way back (Réessayer first after an error). Never a stack. */
export function StatusScreen({ kind, onRetry, onHome }: { kind: "notFound" | "error"; onRetry?: () => void; onHome?: () => void }) {
  const t = useT();
  const p = kind === "notFound" ? t.pages.notFound : t.pages.error;
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center", gap: 20, paddingTop: 48 }}>
        <Brand />
        <View style={{ gap: 8 }}>
          <T tone="title">{p.title}</T>
          <T tone="muted">{p.lead}</T>
        </View>
        {kind === "error" && onRetry && <Button label={t.pages.error.retry} onPress={onRetry} />}
        {onHome && <Button label={p.home} variant={kind === "error" && onRetry ? "outline" : "primary"} onPress={onHome} />}
      </View>
    </Screen>
  );
}
