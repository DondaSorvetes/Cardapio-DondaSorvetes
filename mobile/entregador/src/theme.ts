/**
 * Visual do app: branco, com o roxo da marca e os mesmos tons da tela de pedido
 * do cardápio (DetalhePedidoView). Sem modo escuro, por escolha da loja.
 */
const cores = {
  bg: "#FFFFFF",
  card: "#FFFFFF",
  border: "#F0E2E7",
  text: "#2A1A22",
  muted: "#86687A",
  subtle: "#B59FAA",
  brand: "#C8285F",
  brandPressed: "#9C1C4B",
  brandSoft: "#FDF1F5",
  onBrand: "#FFFFFF",
  success: "#0E7A4E",
  successSoft: "#E7F6EF",
  warn: "#8A4B00",
  warnSoft: "#FFF5E6",
  danger: "#B42318",
  dangerSoft: "#FEF3F2",
  input: "#FFFFFF",
};

export type Theme = typeof cores;

export function useTheme(): Theme {
  return cores;
}

export const font = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
};

export const radius = { card: 16, button: 14, input: 12, pill: 999 };
