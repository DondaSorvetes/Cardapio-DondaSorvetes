import { z } from "zod";
import type { OptionGroup } from "@/data/tipos";
import { getProductUnitPrice } from "@/data/tipos";
import { resolveComboChoices } from "@/lib/combos/options";
import { sanitizeText } from "@/lib/security/sanitize";

export const checkoutItemSchema = z.object({
  produto: z.object({
    id: z.string().min(1).max(64),
    comboId: z.number().int().positive().optional(),
  }),
  qty: z.number().int().min(1).max(100),
  total: z.number().finite().min(0).max(100_000),
  selections: z
    .record(z.string(), z.array(z.string().min(1).max(64)).max(100))
    .default({}),
  observacoes: z.string().max(500).optional().default(""),
  /** "Deseja colher?" — não altera preço; ausente quando o produto não pergunta. */
  colher: z.boolean().optional(),
});
export type CheckoutItem = z.infer<typeof checkoutItemSchema>;
export type CatalogProduct = {
  id: number;
  nome: string;
  descricao: string | null;
  preco_base: number;
  preco_promocional: number | null;
  esta_disponivel: boolean | null;
  imagem_url: string | null;
};
export const cents = (value: number) => Math.round(value * 100);

/** Rebuild the saved snapshot exclusively from current catalog data. */
export function resolveProductItem(
  item: CheckoutItem,
  product: CatalogProduct,
  groups: OptionGroup[],
) {
  if (
    String(product.id) !== item.produto.id ||
    product.esta_disponivel === false
  )
    throw new Error("Um produto não está disponível. Atualize a sacola.");
  const choices = resolveComboChoices(groups, item.selections);
  const price = getProductUnitPrice({
    id: String(product.id),
    name: product.nome,
    description: product.descricao ?? "",
    price: Number(product.preco_base),
    precoPromocional: product.preco_promocional,
  });
  if (
    !Number.isFinite(price) ||
    price < 0 ||
    choices.resolved.some(
      (option) => !Number.isFinite(option.price) || option.price < 0,
    )
  )
    throw new Error("Não foi possível confirmar o preço do produto.");
  const total = cents((price + choices.extras) * item.qty) / 100;
  if (cents(item.total) !== cents(total))
    throw new Error("O preço ou as opções mudaram. Atualize a sacola.");
  return {
    produto: {
      id: String(product.id),
      name: product.nome,
      description: product.descricao ?? "",
      price: Number(product.preco_base),
      precoPromocional: product.preco_promocional,
      image: product.imagem_url,
    },
    qty: item.qty,
    selections: item.selections,
    observacoes: sanitizeText(item.observacoes, 500),
    ...(typeof item.colher === "boolean" ? { colher: item.colher } : {}),
    total,
    adicionais: choices.resolved,
  };
}
