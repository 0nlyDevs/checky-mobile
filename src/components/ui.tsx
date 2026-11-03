import { Broadcast, Check, CheckCircle, CircleDashed, type Icon, MagnifyingGlass, Question, SealCheck, SpinnerGap, Warning, X, XCircle } from "@/lib/icons";
import { type ComponentProps, type ComponentRef, type ReactNode, type Ref, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { useCitizenBar } from "@/components/citizen-bar";
import { useAppChrome } from "@/components/app-header";
import { TAB_BAR_HEIGHT } from "@/components/tab-bar";
import { useT } from "@/lib/i18n";
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

export function Screen({ children, scroll = true, bottomInset = 48, fixedHeader, scrollRef, ...rest }: ScrollViewProps & { scroll?: boolean; bottomInset?: number; fixedHeader?: ReactNode; scrollRef?: Ref<ComponentRef<typeof ScrollView>> }) {
  const c = useTheme();
  // The citizen's bottom bar sits over the screen: the last row must clear it.
  const { bottom } = useSafeAreaInsets();
  const bar = useCitizenBar() ? TAB_BAR_HEIGHT + bottom : 0;
  const chrome = useAppChrome();
  return (
    <SafeAreaView edges={chrome ? [] : ["top"]} style={{ flex: 1, backgroundColor: c.background }}>
      {fixedHeader}
      {scroll ? (
        // The app draws edge to edge, so Android no longer shrinks the window for the keyboard:
        // the field being typed in is lifted above it here, on both platforms.
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
          <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: bottomInset + bar, gap: 20 }} {...rest}>
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
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
          transform: [{ scale: state.pressed ? 0.97 : 1 }],
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
export function VerdictBadge({ verdict, suggested, large, bare }: { verdict: Verdict; suggested?: boolean; large?: boolean; bare?: boolean }) {
  const t = useT();
  const c = useTheme();
  const v = c.verdict[verdict];
  const Icon = VERDICT_ICON[verdict];
  const fg = suggested || bare ? v.ink : v.on;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        gap: 6,
        paddingHorizontal: bare ? 0 : large ? 12 : 8,
        paddingVertical: large ? 7 : 3,
        borderRadius: radius.tag,
        backgroundColor: bare ? "transparent" : suggested ? v.soft : v.fill,
        borderWidth: suggested && !bare ? 2 : 0,
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

/** Spec 4.5: a suggestion is a dashed 2 px frame in the verdict ink on its wash; a confirmed verdict is solid. */
export function VerdictPanel({ verdict, suggested, children }: { verdict: Verdict; suggested?: boolean; children?: ReactNode }) {
  const t = useT();
  const c = useTheme();
  const v = c.verdict[verdict];
  return (
    <View
      style={{
        gap: 10,
        padding: 14,
        borderRadius: radius.card,
        borderWidth: 2,
        borderStyle: suggested ? "dashed" : "solid",
        borderColor: v.ink,
        backgroundColor: v.soft,
      }}
    >
      <VerdictBadge verdict={verdict} large bare />
      <T style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: v.ink }}>{suggested ? t.verdict.suggestedLabel : t.verdict.confirmedLabel}</T>
      {children}
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
  const t = useT();
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

export function Section({ title, children, note, onLayout }: { title: string; children: ReactNode; note?: string; onLayout?: ViewProps["onLayout"] }) {
  return (
    <View onLayout={onLayout} style={{ gap: 14, marginTop: 12, marginBottom: 8 }}>
      <View>
        <T accessibilityRole="header" style={{ fontFamily: fonts.bold, fontSize: 22, lineHeight: 29 }}>{title}</T>
        {note && <T tone="muted">{note}</T>}
      </View>
      {children}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  const c = useTheme();
  const [pressed, setPressed] = useState(false);
  const on = selected || pressed;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        minHeight: 44,
        paddingHorizontal: 16,
        justifyContent: "center",
        borderRadius: radius.control,
        borderWidth: 1,
        // Selected = the ink primary with its paired label; pressed = primaryPressed fill.
        borderColor: selected || pressed ? c.primary : c.border,
        backgroundColor: pressed ? c.primaryPressed : selected ? c.primary : c.card,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      }}
    >
      <Text style={{ fontFamily: selected ? fonts.semibold : fonts.medium, fontSize: 14, color: on ? c.primaryForeground : c.foreground }}>{label}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
