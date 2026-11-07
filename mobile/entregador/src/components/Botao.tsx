import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from "react-native";
import { font, radius, useTheme } from "../theme";

/** Botão principal: alto (área de toque confortável), cor da marca, estado de carregando. */
export function Botao({
  titulo,
  onPress,
  carregando = false,
  desabilitado = false,
  variante = "primario",
  style,
  accessibilityHint,
}: {
  titulo: string;
  onPress: () => void;
  carregando?: boolean;
  desabilitado?: boolean;
  variante?: "primario" | "texto";
  style?: ViewStyle;
  accessibilityHint?: string;
}) {
  const t = useTheme();
  const off = desabilitado || carregando;
  if (variante === "texto") {
    return (
      <Pressable
        onPress={onPress}
        disabled={off}
        hitSlop={10}
        accessibilityRole="button"
        style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, paddingVertical: 6, paddingHorizontal: 4 }, style]}
      >
        <Text style={{ color: t.muted, fontFamily: font.medium, fontSize: 15 }}>{titulo}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: carregando }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed ? t.brandPressed : t.brand, opacity: off && !carregando ? 0.5 : 1 },
        pressed && { transform: [{ scale: 0.985 }] },
        style,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={t.onBrand} />
      ) : (
        <Text style={[styles.label, { color: t.onBrand }]}>{titulo}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { height: 54, borderRadius: radius.button, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  label: { fontFamily: font.semibold, fontSize: 16, letterSpacing: 0.1 },
});
