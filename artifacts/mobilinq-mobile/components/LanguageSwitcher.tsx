import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useLocale } from "@/context/LocaleContext";
import { useColors } from "@/hooks/useColors";

export function LanguageSwitcher() {
  const { locale, toggleLocale, t } = useLocale();
  const colors = useColors();
  const nextLocale = locale === "en" ? "fr" : "en";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={nextLocale === "fr" ? t("Passer au français") : t("Switch to English")}
      onPress={toggleLocale}
      style={[styles.button, { borderColor: colors.border, backgroundColor: colors.card }]}
    >
      <Text style={[styles.label, { color: colors.primary }]}>{locale === "en" ? "FR" : "EN"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    minWidth: 56,
    paddingHorizontal: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
});