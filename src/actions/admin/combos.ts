"use server";

import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import {
  loadComboOptionGroups,
  resolveComboChoices,
  type ComboOptionsConfig,
} from "@/lib/combos/options";
import { requirePermission } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/integrations/supabase/client.server";

export type ComboItem = {
  produto_id: number;
  nome: string;
  quantidade: number;
  preco_base: number;
};
export type ComboAdmin = {
  opcoes_config?: ComboOptionsConfig | null;
  id: number;
  nome: string;
  descricao: string | null;
  preco: number;
  ativa: boolean;
  itens: ComboItem[];
};

export async function listCombos(): Promise<ComboAdmin[]> {
  await requirePermission("catalogo:read");
  const supabase = createServiceRoleClient();
  const { data: combos, error } = await supabase
    .from("combos")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Não foi possível carregar os combos.");
  if (!combos?.length) return [];

  const { data: links, error: linksError } = await supabase
    .from("combo_itens")
    .select("combo_id, produto_id, quantidade")
    .in(
      "combo_id",
      combos.map((combo) => combo.id),
    );
  if (linksError)
    throw new Error("Não foi possível carregar os itens dos combos.");
  const productIds = [...new Set((links ?? []).map((link) => link.produto_id))];
  const { data: products, error: productsError } = productIds.length
    ? await supabase
        .from("produtos")
        .select("id, nome, preco_base")
        .in("id", productIds)
    : { data: [], error: null };
  if (productsError)
    throw new Error("Não foi possível carregar os produtos dos combos.");
  const byId = new Map(
    (products ?? []).map((product) => [product.id, product]),
  );
  return combos.map((combo) => ({
    ...combo,
    preco: Number(combo.preco),
    itens: (links ?? [])
      .filter((link) => link.combo_id === combo.id)
      .flatMap((link) => {
        const product = byId.get(link.produto_id);
        return product
          ? [
              {
                produto_id: product.id,
                nome: product.nome,
                preco_base: Number(product.preco_base),
                quantidade: link.quantidade,
              },
            ]
          : [];
      }),
  })) as unknown as ComboAdmin[];
}

export async function createCombo(input: {
  nome: string;
  descricao: string;
  preco: number;
  itens: { produto_id: number; quantidade: number }[];
  opcoes_config?: ComboOptionsConfig;
}) {
  await requirePermission("catalogo:write");
  const nome = input.nome.trim();
  const itens = input.itens.filter(
    (item) =>
      Number.isInteger(item.produto_id) &&
      item.produto_id > 0 &&
      Number.isInteger(item.quantidade) &&
      item.quantidade > 0 &&
      item.quantidade <= 20,
  );
  if (!nome || nome.length > 100)
    throw new Error("Informe um nome de até 100 caracteres.");
  if (
    itens.length < 2 ||
    new Set(itens.map((item) => item.produto_id)).size !== itens.length
  )
    throw new Error("Selecione pelo menos dois produtos diferentes.");
  if (!Number.isFinite(input.preco) || input.preco <= 0)
    throw new Error("Informe um preço válido para o combo.");

  const supabase = createServiceRoleClient();
  const { data: products, error: productsError } = await supabase
    .from("produtos")
    .select("id, nome, preco_base")
    .in(
      "id",
      itens.map((item) => item.produto_id),
    );
  if (productsError || (products ?? []).length !== itens.length)
    throw new Error("Confira os produtos selecionados.");
  const config =
    input.opcoes_config == null
      ? null
      : z
          .object({
            modo: z.enum(["cliente", "fixo"]),
            selecoes: z.record(z.string(), z.array(z.string().regex(/^\d+$/)).max(100)),
          })
          .parse(input.opcoes_config);
  const groups = await loadComboOptionGroups(supabase, itens);
  const fixed =
    config?.modo === "fixo"
      ? resolveComboChoices(groups, config.selecoes)
      : { extras: 0 };
  if (config?.modo === "cliente" && Object.keys(config.selecoes).length)
    throw new Error("As opções deste combo serão escolhidas pelo cliente.");
  const referencePrice =
    fixed.extras +
    itens.reduce((sum, item) => {
      const product = products!.find((entry) => entry.id === item.produto_id)!;
      return sum + Number(product.preco_base) * item.quantidade;
    }, 0);
  if (input.preco >= referencePrice)
    throw new Error(
      `O preço do combo precisa ser menor que ${referencePrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
    );

  const { data: combo, error } = await supabase
    .from("combos")
    .insert({
      nome,
      descricao: input.descricao.trim() || null,
      preco: input.preco,
      ativa: true,
      ...(config ? { opcoes_config: config as unknown as Json } : {}),
    })
    .select("*")
    .single();
  if (error || !combo)
    throw new Error(
      error?.message?.includes("opcoes_config")
        ? "O banco precisa da atualização de opções dos combos antes de publicar. Aplique a migração 0015."
        : "Não foi possível criar o combo.",
    );

  const { error: itemsError } = await supabase
    .from("combo_itens")
    .insert(itens.map((item) => ({ ...item, combo_id: combo.id })));
  if (itemsError) {
    await supabase.from("combos").delete().eq("id", combo.id);
    throw new Error("Não foi possível salvar os produtos do combo.");
  }

  return {
    ...combo,
    preco: Number(combo.preco),
    itens: itens.map((item) => {
      const product = products!.find((entry) => entry.id === item.produto_id)!;
      return {
        produto_id: product.id,
        nome: product.nome,
        preco_base: Number(product.preco_base),
        quantidade: item.quantidade,
      };
    }),
  } as unknown as ComboAdmin;
}

export async function deleteCombo(id: number) {
  await requirePermission("catalogo:write");
  const { error } = await createServiceRoleClient()
    .from("combos")
    .delete()
    .eq("id", id);
  if (error) throw new Error("Não foi possível excluir o combo.");
}

export async function getComboProductOptions(
  items: { produto_id: number; quantidade: number }[],
) {
  await requirePermission("catalogo:read");
  if (
    items.length > 100 ||
    items.some(
      (item) =>
        !Number.isSafeInteger(item.produto_id) ||
        item.produto_id <= 0 ||
        !Number.isInteger(item.quantidade) ||
        item.quantidade < 1 ||
        item.quantidade > 20,
    )
  )
    throw new Error("Produtos inválidos.");
  return loadComboOptionGroups(createServiceRoleClient(), items);
}
