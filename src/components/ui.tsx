import { CircleCheck, CircleDashed, CircleHelp, CircleX, LoaderCircle, type LucideIcon, Radio, ShieldCheck, Timer, TriangleAlert } from "lucide-react-native";
import { type ReactNode, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  ScrollView,
  type ScrollViewProps,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  View,
  type ViewProps,
} from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { t } from "@/lib/i18n/fr";
import { fonts, radius, useTheme } from "@/lib/theme";
import type { Status, Verdict } from "@/lib/types";

type Tone = "default" | "muted" | "title" | "label" | "tabular";

export function T({ tone = "default", style, ...rest }: TextProps & { tone?: Tone }) {
  const c = useTheme();
  const base = {
    default: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, color: c.foreground },
    muted: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: c.mutedForeground },
    title: { fontFamily: fonts.title, fontSize: 30, lineHeight: 38, color: c.foreground, letterSpacing: 0.3 },
    label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: c.mutedForeground, letterSpacing: 0.4, textTransform: "uppercase" as const },
    tabular: { fontFamily: fonts.tabular, fontSize: 16, lineHeight: 20, color: c.foreground, fontVariant: ["tabular-nums" as const] },
  }[tone];
  return <Text style={[base, style]} {...rest} />;
}

export function Screen({ children, scroll = true, ...rest }: ScrollViewProps & { scroll?: boolean }) {
  const c = useTheme();
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.background }}>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }} {...rest}>
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ style, ...rest }: ViewProps) {
  const c = useTheme();
  return <View style={[{ backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius, padding: 14, gap: 10 }, style]} {...rest} />;
}

type ButtonProps = PressableProps & { label: string; icon?: LucideIcon; variant?: "primary" | "outline" | "ghost"; busy?: boolean };

export function Button({ label, icon: Icon, variant = "primary", busy, disabled, style, ...rest }: ButtonProps) {
  const c = useTheme();
  const fg = variant === "primary" ? c.primaryForeground : c.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || busy, busy }}
      disabled={disabled || busy}
      style={(state) => [
        {
          minHeight: 48,
          paddingHorizontal: 16,
          borderRadius: radius,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: variant === "primary" ? c.primary : "transparent",
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor: c.input,
          opacity: disabled ? 0.6 : state.pressed ? 0.85 : 1,
        },
        typeof style === "function" ? style(state) : style,
      ]}
      {...rest}
    >
      {busy ? <ActivityIndicator color={fg} /> : Icon ? <Icon size={18} color={fg} /> : null}
      <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: fg }}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, style, ...rest }: TextInputProps & { label?: string }) {
  const c = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label && <T style={{ fontFamily: fonts.medium, fontSize: 15 }}>{label}</T>}
      <TextInput
        placeholderTextColor={c.mutedForeground}
        selectionColor={c.signal}
        style={[
          {
            minHeight: 48,
            borderWidth: 1,
            borderColor: c.input,
            borderRadius: radius,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontFamily: fonts.body,
            fontSize: 16,
            color: c.foreground,
            backgroundColor: c.card,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

export function Notice({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "error" }) {
  const c = useTheme();
  const v = c.verdict.false;
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : undefined}
      style={{ flexDirection: "row", gap: 8, padding: 12, borderRadius: radius, backgroundColor: tone === "error" ? v.soft : c.muted }}
    >
      {tone === "error" && <TriangleAlert size={16} color={v.ink} style={{ marginTop: 3 }} />}
      <T style={{ flex: 1, color: tone === "error" ? v.ink : c.foreground, fontSize: 15 }}>{children}</T>
    </View>
  );
}

export const VERDICT_ICON: Record<Verdict, LucideIcon> = {
  true: CircleCheck,
  misleading: TriangleAlert,
  false: CircleX,
  unverifiable: CircleHelp,
};

/** Never colour alone: icon + label. Confirmed = solid fill; AI suggestion = dashed outline on soft ground. */
export function VerdictBadge({ verdict, suggested, large }: { verdict: Verdict; suggested?: boolean; large?: boolean }) {
  const c = useTheme();
  const v = c.verdict[verdict];
  const Icon = VERDICT_ICON[verdict];
  const fg = suggested ? v.ink : v.on;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 6,
        paddingHorizontal: large ? 12 : 8,
        paddingVertical: large ? 7 : 3,
        borderRadius: radius,
        backgroundColor: suggested ? v.soft : v.fill,
        borderWidth: suggested ? 1.5 : 0,
        borderStyle: "dashed",
        borderColor: v.ink,
      }}
    >
      <Icon size={large ? 20 : 15} color={fg} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: large ? 18 : 14, color: fg }}>
        {t.verdict[verdict]}
        {suggested ? ` · ${t.verdict.suggested}` : ""}
      </Text>
    </View>
  );
}

export const STATUS_ICON: Record<Status, LucideIcon> = {
  to_check: CircleDashed,
  in_progress: Timer,
  verified: ShieldCheck,
  published: Radio,
};

/** Status is not truth: ink icons, never verdict colours. */
export function StatusLabel({ status }: { status: string }) {
  const c = useTheme();
  const Icon = STATUS_ICON[status as Status] ?? CircleDashed;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
      <Icon size={15} color={c.foreground} />
      <T style={{ fontSize: 14, fontFamily: fonts.medium }}>{t.status[status] ?? status}</T>
    </View>
  );
}

function Spinner({ color }: { color: string }) {
  const turn = useSharedValue(0);
  useEffect(() => {
    turn.value = withRepeat(withTiming(360, { duration: 900, easing: Easing.linear }), -1);
    return () => cancelAnimation(turn);
  }, [turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <LoaderCircle size={18} color={color} />
    </Animated.View>
  );
}

export type StepState = "waiting" | "running" | "done" | "failed";

export function Step({ label, state, detail }: { label: string; state: StepState; detail?: string }) {
  const c = useTheme();
  const color = state === "waiting" ? c.mutedForeground : c.foreground;
  return (
    <View accessible accessibilityLabel={`${label}${detail ? `, ${detail}` : ""}`} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
      <View style={{ width: 18, marginTop: 2 }}>
        {state === "running" ? (
          <Spinner color={c.foreground} />
        ) : state === "done" ? (
          <CircleCheck size={18} color={c.foreground} />
        ) : state === "failed" ? (
          <CircleX size={18} color={c.verdict.false.ink} />
        ) : (
          <CircleDashed size={18} color={c.mutedForeground} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <T style={{ color, fontFamily: state === "running" ? fonts.semibold : fonts.body }}>{label}</T>
        {!!detail && <T tone="muted">{detail}</T>}
      </View>
    </View>
  );
}

export function Section({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <View style={{ gap: 8 }}>
      <View>
        <T tone="label">{title}</T>
        {note && <T tone="muted">{note}</T>}
      </View>
      {children}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const c = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 36,
        paddingHorizontal: 12,
        justifyContent: "center",
        borderRadius: 999,
        borderWidth: 1,
        // Selection is one of the three places the signal yellow may appear.
        borderColor: selected ? c.signal : c.border,
        backgroundColor: selected ? c.signal : c.card,
      }}
    >
      <Text style={{ fontFamily: selected ? fonts.semibold : fonts.medium, fontSize: 14, color: selected ? "#14201d" : c.foreground }}>{label}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
