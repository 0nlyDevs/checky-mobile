import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui";
import { useTheme } from "@/lib/theme";

/** Fixed at the bottom while a suggested verdict waits for a journalist: one primary action. */
export function SignBar({ label, onPress, busy, disabled }: { label: string; onPress: () => void; busy?: boolean; disabled?: boolean }) {
  const c = useTheme();
  const { bottom } = useSafeAreaInsets();
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: Math.max(bottom, 10),
        backgroundColor: c.background,
        borderTopWidth: 1,
        borderTopColor: c.border,
      }}
    >
      <Button label={label} onPress={onPress} busy={busy} disabled={disabled} style={{ minHeight: 48 }} />
    </View>
  );
}

/** Height a screen must keep free beneath its content when the sign bar shows. */
export const SIGN_BAR_ROOM = 96;
