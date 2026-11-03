import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, View } from "react-native";

import { Brand } from "@/components/brand";
import { Button, Field, Notice, Screen, T } from "@/components/ui";
import { clearApiToken } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { useMode } from "@/lib/mode";

export function AuthForm({ mode }: { mode: "in" | "up" }) {
  const t = useT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { mode: who, setMode } = useMode();

  // The citizen screens only exist in citizen mode, so move once the mode has switched.
  useEffect(() => {
    if (who === "citizen") router.replace("/citizen");
  }, [who, router]);

  async function submit() {
    setBusy(true);
    setError(null);
    clearApiToken();
    try {
      const res =
        mode === "in"
          ? await authClient.signIn.email({ email: email.trim(), password })
          : await authClient.signUp.email({ email: email.trim(), password, name: name.trim() || email.trim() });
      if (res.error) {
        const code = res.error.code ?? "";
        setError(
          code === "INVALID_EMAIL_OR_PASSWORD"
            ? t.auth.invalid
            : code.includes("ALREADY_EXISTS")
              ? t.auth.exists
              : code.includes("PASSWORD_TOO_SHORT")
                ? t.auth.weak
                : t.auth.failed,
        );
      }
    } catch {
      setError(t.auth.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen contentContainerStyle={{ padding: 16, paddingTop: 48, gap: 20 }}>
        <Brand />
        <View style={{ gap: 6 }}>
          <T tone="title">{mode === "in" ? t.auth.signIn : t.auth.signUp}</T>
          <T tone="muted">{t.auth.lead}</T>
        </View>
        {mode === "up" && <Field label={t.auth.name} placeholder={t.auth.namePlaceholder} value={name} onChangeText={setName} autoComplete="name" textContentType="name" />}
        <Field
          label={t.auth.email}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <Field
          label={t.auth.password}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          textContentType={mode === "in" ? "password" : "newPassword"}
          onSubmitEditing={submit}
        />
        {error && <Notice tone="error">{error}</Notice>}
        <Button
          label={busy ? (mode === "in" ? t.auth.signingIn : t.auth.creating) : mode === "in" ? t.auth.signIn : t.auth.signUp}
          busy={busy}
          disabled={!email || password.length < 1}
          onPress={submit}
        />
        <Link href={mode === "in" ? "/sign-up" : "/sign-in"} replace style={{ alignSelf: "center", padding: 12 }}>
          <T style={{ textDecorationLine: "underline" }}>{mode === "in" ? t.auth.noAccount : t.auth.haveAccount}</T>
        </Link>
        <Button label={t.auth.citizen} variant="outline" onPress={() => setMode("citizen")} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
