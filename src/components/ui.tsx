import { Broadcast, Check, CheckCircle, CircleDashed, type Icon, MagnifyingGlass, Question, SealCheck, SpinnerGap, Warning, X, XCircle } from "@/lib/icons";
import { type ComponentProps, type ReactNode, useEffect } from "react";
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
import { fonts, radius, tracking, useTheme } from "@/lib/theme";
import type { Status, Verdict } from "@/lib/types";

type Tone = "default" | "muted" | "title" | "label" | "tabular";

export function T({ tone = "default", style, ...rest }: TextProps & { tone?: Tone }) {
  const c = useTheme();
  const base = {
    default: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: c.foreground },
    muted: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: c.mutedForeground },
    title: { fontFamily: fonts.display, fontSize: 30, lineHeight: 38, color: c.foreground, letterSpacing: tracking(30) },
    label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: c.mutedForeground, letterSpacing: 0.4, textTransform: "uppercase" as const },
    tabular: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20, color: c.foreground, fontVariant: ["tabular-nums" as const] },
  }[tone];
  return <Text style={[base, style]} {...rest} />;
}

export function Screen({ children, scroll = true, bottomInset = 48, ...rest }: ScrollViewProps & { scroll?: boolean; bottomInset?: number }) {
  const c = useTheme();
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.background }}>
      {scroll ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: bottomInset, gap: 16 }} {...rest}>
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
  return <View style={[{ backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.card, padding: 14, gap: 10 }, style]} {...rest} />;
}

type ButtonProps = PressableProps & { label: string; icon?: Icon; variant?: "primary" | "outline" | "ghost"; busy?: boolean };

export function Button({ label, icon: Icon, variant = "primary", busy, disabled, style, ...rest }: ButtonProps) {
  const c = useTheme();
  const off = !!disabled && !busy;
  const fg = off ? c.mutedForeground : variant === "primary" ? c.primaryForeground : c.foreground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled || busy, busy }}
      disabled={disabled || busy}
      style={(state) => [
        {
          minHeight: 48,
          paddingHorizontal: 20,
          borderRadius: radius.control,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: off ? c.muted : variant === "primary" ? (state.pressed ? c.primaryPressed : c.primary) : state.pressed ? c.accent : "transparent",
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor: c.input,
        },
        typeof style === "function" ? style(state) : style,
      ]}
      {...rest}
    >
      {busy ? <ActivityIndicator color={fg} /> : Icon ? <Icon size={18} color={fg} style={{ flexShrink: 0 }} /> : null}
      <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: fg, flexShrink: 1, textAlign: "center" }} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, style, ...rest }: TextInputProps & { label?: string; ref?: ComponentProps<typeof TextInput>["ref"] }) {
  const c = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label && <T style={{ fontFamily: fonts.medium, fontSize: 15 }}>{label}</T>}
      <TextInput
        placeholderTextColor={c.mutedForeground}
        selectionColor={c.primary + "59"}
        cursorColor={c.primary}
        style={[
          {
            minHeight: 48,
            borderWidth: 1,
            borderColor: c.input,
            borderRadius: rest.multiline ? radius.card : radius.control,
            paddingHorizontal: 18,
            paddingVertical: 10,
            fontFamily: fonts.regular,
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
  return (
    <View
      accessibilityRole={tone === "error" ? "alert" : undefined}
      style={{
        flexDirection: "row",
        gap: 8,
        padding: 14,
        borderRadius: radius.card,
        backgroundColor: tone === "error" ? c.card : c.muted,
        borderWidth: tone === "error" ? 1 : 0,
        borderColor: c.destructive,
      }}
    >
      {tone === "error" && <Warning size={16} color={c.destructive} style={{ marginTop: 3 }} />}
      <T style={{ flex: 1, color: tone === "error" ? c.destructive : c.foreground, fontSize: 15 }}>{children}</T>
    </View>
  );
}

export const VERDICT_ICON: Record<Verdict, Icon> = {
  true: Check,
  misleading: Warning,
  false: X,
  unverifiable: Question,
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
        borderRadius: radius.control,
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

export const STATUS_ICON: Record<Status, Icon> = {
  to_check: Question,
  in_progress: MagnifyingGlass,
  verified: SealCheck,
  published: Broadcast,
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
      <SpinnerGap size={18} color={color} />
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
          <CheckCircle size={18} color={c.foreground} />
        ) : state === "failed" ? (
          <XCircle size={18} color={c.destructive} />
        ) : (
          <CircleDashed size={18} color={c.mutedForeground} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <T style={{ color, fontFamily: state === "running" ? fonts.semibold : fonts.regular }}>{label}</T>
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
        paddingHorizontal: 14,
        justifyContent: "center",
        borderRadius: radius.control,
        borderWidth: 1,
        // Selected = the ink primary with its paired label.
        borderColor: selected ? c.primary : c.border,
        backgroundColor: selected ? c.primary : c.card,
      }}
    >
      <Text style={{ fontFamily: selected ? fonts.semibold : fonts.medium, fontSize: 14, color: selected ? c.primaryForeground : c.foreground }}>{label}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
