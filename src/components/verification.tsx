import { View } from "react-native";

import { Button, Card, T } from "@/components/ui";
import { WEB_URL } from "@/lib/config";
import { openWeb } from "@/lib/handoff";
import { useT } from "@/lib/i18n";
import { ArrowSquareOut, Hourglass, type Icon, LockSimple, SealCheck, Warning } from "@/lib/icons";
import { fonts, useTheme } from "@/lib/theme";
import type { Membership } from "@/lib/types";

const ICON: Record<string, Icon> = { none: LockSimple, pending: Hourglass, refused: Warning, approved: SealCheck };

/**
 * Same rule as the desk's banner: until Checky has verified the newsroom it works privately and
 * nothing of it is published. The request itself is made on the web (Réglages of the desk).
 * Renders nothing once the newsroom is verified, unless `always` (Réglages shows the badge too).
 */
export function VerificationNotice({ membership, always }: { membership: Membership; always?: boolean }) {
  const c = useTheme();
  const v = useT().verification;
  const status = membership.verification in ICON ? membership.verification : "none";
  if (status === "approved" && !always) return null;
  const Icon = ICON[status];
  const action = status === "pending" ? v.see : status === "refused" ? v.fix : status === "none" ? v.ask : null;
  return (
    <Card accessibilityRole={status === "approved" ? undefined : "summary"}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Icon size={18} color={c.foreground} style={{ marginTop: 2, flexShrink: 0 }} />
        <T style={{ flex: 1, fontFamily: status === "approved" ? fonts.semibold : fonts.regular }}>{v.banner[status]}</T>
      </View>
      {action && (
        <Button
          label={action}
          icon={ArrowSquareOut}
          variant="outline"
          accessibilityHint={v.onWeb}
          onPress={() => openWeb(`${WEB_URL}/w/${membership.workspace_id}/parametres#verification`)}
        />
      )}
    </Card>
  );
}
