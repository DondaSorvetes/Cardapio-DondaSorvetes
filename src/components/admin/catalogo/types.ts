import type { Produto, Categoria } from "@/types/produto";

export type CatalogTab =
  | "produtos"
  | "complementos"
  | "opcoes"
  | "combos"
  | "promocoes";

export type ProdutoStatusFilter =
  | "todos"
  | "ativo"
  | "inativo"
  | "promocao";

export type ProdutoSort =
  | "ordem"
  | "nome"
  | "preco_asc"
  | "preco_desc"
  | "recentes";

export type CatalogProduto = Produto & {
  /** Campos opcionais derivados / futuros */
  preco_promocional?: number | null;
  codigo?: string | null;
};

export type CatalogCategoria = Categoria;

export type { Produto, Categoria };

export function formatBRL(value: number | null | undefined) {
  const n = Number(value || 0);
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * null/undefined no banco = disponível (legado).
 * Só `false` significa desligado.
 */
export function isProdutoDisponivel(
  p: Pick<CatalogProduto, "esta_disponivel">
): boolean {
  return p.esta_disponivel !== false;
}

export function hasPrecoPromocional(p: CatalogProduto): boolean {
  const base = Number(p.preco_base) || 0;
  const promo = p.preco_promocional;
  return (
    promo != null &&
    Number.isFinite(Number(promo)) &&
    Number(promo) > 0 &&
    Number(promo) < base
  );
}

export function produtoStatus(
  p: CatalogProduto
): "ativo" | "inativo" | "promocao" {
  if (!isProdutoDisponivel(p)) return "inativo";
  if (hasPrecoPromocional(p)) return "promocao";
  const tagNome = p.tag?.nome?.toLowerCase() || "";
  if (tagNome.includes("promo")) return "promocao";
  return "ativo";
}
