import { Pressable, StyleSheet, TextInput, View } from "react-native";
import Search from "lucide-react-native/icons/search";
import X from "lucide-react-native/icons/x";
import { font, radius, useTheme } from "../theme";

/** Busca por cliente, número do pedido ou rua. */
export function BarraBusca({ valor, onChange }: { valor: string; onChange: (texto: string) => void }) {
  const t = useTheme();
  return (
    <View style={[styles.caixa, { backgroundColor: t.brandSoft }]}>
      <Search color={t.muted} size={18} accessibilityElementsHidden importantForAccessibility="no" />
      <TextInput
        value={valor}
        onChangeText={onChange}
        placeholder="Buscar cliente, pedido ou rua"
        placeholderTextColor={t.muted}
        style={[styles.input, { color: t.text }]}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="never"
        maxFontSizeMultiplier={1.6}
        accessibilityLabel="Buscar entrega"
        accessibilityHint="Filtra a lista pelo nome do cliente, número do pedido ou rua"
      />
      {valor.length > 0 && (
        <Pressable
          onPress={() => onChange("")}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Limpar busca"
          style={({ pressed }) => [styles.limpar, { opacity: pressed ? 0.5 : 1 }]}
        >
          <X color={t.muted} size={18} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  caixa: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: radius.input,
    paddingLeft: 14,
    paddingRight: 6,
  },
  input: { flex: 1, fontFamily: font.regular, fontSize: 16, paddingVertical: 12 },
  limpar: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});
