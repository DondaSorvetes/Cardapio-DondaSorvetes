import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { font, useTheme } from "../theme";

/** Sem entregas: ilustração mínima (sacola com um check) e uma frase. */
export function EstadoVazio() {
  const t = useTheme();
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Svg width={132} height={132} viewBox="0 0 132 132" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Circle cx={66} cy={66} r={62} fill={t.brandSoft} />
        <Rect x={38} y={48} width={56} height={50} rx={10} fill={t.card} stroke={t.brand} strokeWidth={3} />
        <Path d="M52 48v-4a14 14 0 0 1 28 0v4" fill="none" stroke={t.brand} strokeWidth={3} strokeLinecap="round" />
        <Path d="M55 74l8 8 15-16" fill="none" stroke={t.success} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <Text style={[styles.title, { color: t.text }]}>Você não tem entregas no momento.</Text>
      <Text style={[styles.text, { color: t.muted }]}>Quando um pedido sair para entrega com você, ele aparece aqui sozinho.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingBottom: 48, gap: 10 },
  title: { fontFamily: font.semibold, fontSize: 18, textAlign: "center", marginTop: 12 },
  text: { fontFamily: font.regular, fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 300 },
});
