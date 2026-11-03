import * as ImagePicker from "expo-image-picker";
import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, View } from "react-native";

import { Brand } from "@/components/brand";
import { Button, Field, Notice, Screen, T } from "@/components/ui";
import { clearApiToken } from "@/lib/api";
import { authClient } from "@/lib/auth";
import { Camera, Images } from "@/lib/icons";
import { useT } from "@/lib/i18n";
import { useMode } from "@/lib/mode";
import { type Card, cardProblem, discardQueuedProfile, queueProfile, toCard } from "@/lib/press-card";

export function AuthForm({ mode }: { mode: "in" | "up" }) {
  const t = useT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [outlet, setOutlet] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [card, setCard] = useState<Card | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { mode: who, setMode } = useMode();

  // The citizen screens only exist in citizen mode, so move once the mode has switched.
  useEffect(() => {
    if (who === "citizen") router.replace("/citizen");
  }, [who, router]);

  async function pick(source: "camera" | "library") {
    setError(null);
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setError(t.auth.cameraDenied);
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.9, allowsEditing: false };
    const res = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!res.canceled && res.assets[0]) setCard(toCard(res.assets[0]));
  }

  async function submit() {
    setError(null);
    if (mode === "up") {
      const problem = cardProblem(card);
      if (problem) return setError(t.auth[problem]);
    }
    setBusy(true);
    clearApiToken();
    try {
      if (mode === "up" && card) queueProfile({ phone, outlet, cardNumber, card });
      const res =
        mode === "in"
          ? await authClient.signIn.email({ email: email.trim(), password })
          : await authClient.signUp.email({ email: email.trim(), password, name: name.trim() || email.trim() });
      if (res.error) {
        discardQueuedProfile();
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
        return;
      }
    } catch {
      discardQueuedProfile();
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
        {mode === "up" && (
          <View style={{ gap: 16 }}>
            <T tone="title" style={{ fontSize: 18 }}>{t.auth.proof}</T>
            <Field label={t.auth.phone} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" placeholder="+261 34 00 000 00" />
            <Field label={t.auth.outlet} value={outlet} onChangeText={setOutlet} autoComplete="organization" textContentType="organizationName" />
            <Field label={t.auth.cardNumber} value={cardNumber} onChangeText={setCardNumber} autoCapitalize="characters" />
            <View style={{ gap: 8 }}>
              <T style={{ fontSize: 15 }}>{t.auth.card}</T>
              {card && <Image source={{ uri: card.uri }} accessibilityLabel={t.auth.card} style={{ width: "100%", aspectRatio: 1.6, borderRadius: 12 }} resizeMode="cover" />}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button label={t.auth.cardCamera} icon={Camera} variant="outline" style={{ flex: 1 }} onPress={() => pick("camera")} />
                <Button label={t.auth.cardLibrary} icon={Images} variant="outline" style={{ flex: 1 }} onPress={() => pick("library")} />
              </View>
              <T tone="muted" style={{ fontSize: 14 }}>{t.auth.cardHint}</T>
            </View>
          </View>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        <Button
          label={busy ? (mode === "in" ? t.auth.signingIn : t.auth.creating) : mode === "in" ? t.auth.signIn : t.auth.signUp}
          busy={busy}
          disabled={!email || password.length < 1 || (mode === "up" && (!phone.trim() || outlet.trim().length < 2))}
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
