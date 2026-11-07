import { memo } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import ChevronRight from "lucide-react-native/icons/chevron-right";
import { font, radius, useTheme } from "../theme";
import { formatarEndereco, horaSaida, resumoPagamento, type Entrega } from "../lib/entregas";

/** Card compacto: só o básico. Tocar abre os detalhes (onde se marca a entrega). */
export const EntregaCard = memo(function EntregaCard({
  entrega,
  agora,
  onAbrir,
}: {
  entrega: Entrega;
  agora: number;
  onAbrir: (id: string) => void;
}) {
  const t = useTheme();
  const { fontScale } = useWindowDimensions();
  // Letra grande no celular: deixa quebrar linha em vez de cortar o texto.
  const linhas = fontScale > 1.2 ? 3 : 1;
  const end = formatarEndereco(entrega.endereco);
  const pag = resumoPagamento(entrega);
  const hora = horaSaida(entrega.saiu_entrega_at, agora);
  const rotulo = [
    `Pedido ${entrega.numero}`,
    entrega.cliente_nome,
    end.linha1,
    `${pag.forma}, ${pag.valor}`,
    pag.valorTroco ? `levar troco de ${pag.valorTroco}` : null,
    hora,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <Pressable
      onPress={() => onAbrir(entrega.id)}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityHint="Abre os detalhes e a opção de marcar como entregue"
      style={({ pressed }) => [
        styles.card,
        { borderColor: t.border, backgroundColor: pressed ? t.brandSoft : t.card },
      ]}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.topo}>
          <Text style={[styles.numero, { color: t.brand }]} maxFontSizeMultiplier={1.6}>
            #{entrega.numero}
          </Text>
          <Text style={[styles.hora, { color: t.muted }]} numberOfLines={linhas} maxFontSizeMultiplier={1.6}>
            {hora}
          </Text>
        </View>
        <Text style={[styles.cliente, { color: t.text }]} numberOfLines={linhas === 1 ? 1 : 2}>
          {entrega.cliente_nome}
        </Text>
        <Text style={[styles.endereco, { color: t.muted }]} numberOfLines={linhas}>
          {end.linha1}
        </Text>
        <View style={styles.chips}>
          <Text style={[styles.chip, { color: t.text, backgroundColor: t.brandSoft }]} maxFontSizeMultiplier={1.6}>
            {pag.forma} · {pag.valor}
          </Text>
          {pag.valorTroco ? (
            <Text
              style={[styles.chip, { color: t.warn, backgroundColor: t.warnSoft, fontFamily: font.semibold }]}
              maxFontSizeMultiplier={1.6}
            >
              Troco {pag.valorTroco}
            </Text>
          ) : null}
        </View>
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <ChevronRight color={t.muted} size={20} />
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 64,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 10,
  },
  topo: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  numero: { fontFamily: font.semibold, fontSize: 13, letterSpacing: 0.3 },
  hora: { fontFamily: font.regular, fontSize: 12, flexShrink: 1, textAlign: "right" },
  cliente: { fontFamily: font.semibold, fontSize: 17 },
  endereco: { fontFamily: font.regular, fontSize: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 5 },
  chip: { fontFamily: font.medium, fontSize: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: "hidden" },
});
