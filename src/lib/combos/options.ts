import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { OptionGroup } from "@/data/tipos";

export type ComboOptionsConfig = {
  modo: "cliente" | "fixo";
  selecoes: Record<string, string[]>;
};
export type ComboOptionItem = { produto_id: number; quantidade: number };

export function isSharedComboAddon(group: OptionGroup, productName = "") {
  const name = (group.productName ?? productName)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    name.includes("acai") &&
    group.id !== "obs" &&
    !/tamanho|sabor/i.test(group.sourceGroupName ?? group.name)
  );
}

export function comboGroupLimit(
  group: OptionGroup,
  groups: OptionGroup[],
  selections: Record<string, string[]>,
  productName = "",
) {
  if (!isSharedComboAddon(group, productName)) return group.max;
  const size = groups.find(
    (g) =>
      g.comboUnitKey === group.comboUnitKey &&
      /tamanho/i.test(g.sourceGroupName ?? g.name),
  );
  const name =
    size?.items.find((item) => item.id === selections[size.id]?.[0])?.name ??
    "";
  return name.includes("300")
    ? 3
    : name.includes("400")
      ? 4
      : name.includes("500")
        ? 5
        : group.max;
}

/** Always resolves current database options; never trusts client prices or labels. */
export async function loadComboOptionGroups(
  client: SupabaseClient<Database>,
  items: ComboOptionItem[],
): Promise<OptionGroup[]> {
  if (!items.length) return [];
  return (
    await createComboOptionLoader(
      client,
      items.map((item) => item.produto_id),
    )
  )(items);
}

/** Fetch shared options once, validate each combo independently. */
export async function createComboOptionLoader(
  client: SupabaseClient<Database>,
  productIds: number[],
) {
  const ids = [...new Set(productIds)];
  const [{ data: products, error: pe }, { data: links, error: le }] =
    await Promise.all([
      client.from("produtos").select("id,nome,esta_disponivel").in("id", ids),
      client
        .from("produto_grupos")
        .select("produto_id,grupo_id,ordem")
        .in("produto_id", ids)
        .order("ordem"),
    ]);
  if (pe || le)
    throw new Error(
      "Não foi possível carregar as opções dos produtos do combo.",
    );
  const groupIds = [...new Set((links ?? []).map((link) => link.grupo_id))];
  const [{ data: groups, error: ge }, { data: options, error: oe }] =
    await Promise.all([
      client
        .from("grupos_opcoes")
        .select("id,nome,min_escolha,max_escolha")
        .in("id", groupIds),
      client
        .from("opcoes")
        .select("id,grupo_id,nome,preco_adicional,esta_disponivel,status,ordem")
        .in("grupo_id", groupIds)
        .order("ordem"),
    ]);
  if (ge || oe)
    throw new Error("Não foi possível carregar as opções do combo.");
  return (items: ComboOptionItem[]): OptionGroup[] => {
    const requested = [...new Set(items.map((item) => item.produto_id))];
    if (
      requested.some(
        (id) =>
          !products?.some((p) => p.id === id && p.esta_disponivel !== false),
      )
    )
      throw new Error("Um produto do combo não está disponível.");
    return items.flatMap((item) =>
      Array.from({ length: item.quantidade }, (_, unit) => {
        const product = products!.find((p) => p.id === item.produto_id)!;
        return (links ?? [])
          .filter((link) => link.produto_id === item.produto_id)
          .flatMap((link) => {
            const group = groups?.find((g) => g.id === link.grupo_id);
            if (!group)
              throw new Error(
                "Um grupo de opções do combo não está mais disponível.",
              );
            const min = group.min_escolha ?? 0,
              max = group.max_escolha ?? 0;
            return [
              {
                id: `p${item.produto_id}u${unit}g${group.id}`,
                name: `${product.nome}${item.quantidade > 1 ? ` ${unit + 1}/${item.quantidade}` : ""} · ${group.nome}`,
                productName: product.nome,
                comboUnitKey: `p${item.produto_id}u${unit}`,
                sourceGroupName: group.nome,
                min,
                max,
                required: min > 0,
                helper:
                  min > 0
                    ? `Escolha de ${min} a ${max} opções`
                    : `Escolha até ${max} opções`,
                items: (options ?? [])
                  .filter((option) => option.grupo_id === group.id)
                  .map((option) => ({
                    id: String(option.id),
                    name: option.nome,
                    priceDelta: Number(option.preco_adicional ?? 0),
                    disponivel:
                      option.esta_disponivel !== false &&
                      String(option.status ?? "ativo").toLowerCase() !==
                        "inativo",
                  })),
              },
            ];
          });
      }).flat(),
    );
  };
}

export function resolveComboChoices(
  groups: OptionGroup[],
  selections: Record<string, string[]>,
) {
  for (const [id, values] of Object.entries(selections)) {
    if (
      !groups.some((group) => group.id === id) ||
      !Array.isArray(values) ||
      values.some((v) => typeof v !== "string") ||
      new Set(values).size !== values.length
    )
      throw new Error("Confira as escolhas do combo.");
  }
  const resolved = groups.flatMap((group) => {
    const ids = selections[group.id] ?? [];
    const limit = comboGroupLimit(group, groups, selections);
    const sharedCount = groups
      .filter(
        (g) => g.comboUnitKey === group.comboUnitKey && isSharedComboAddon(g),
      )
      .reduce((sum, g) => sum + (selections[g.id] ?? []).length, 0);
    if (isSharedComboAddon(group) && sharedCount > limit)
      throw new Error(
        `${group.productName}: escolha até ${limit} adicionais no total para cada unidade.`,
      );
    if (
      ids.length < (group.min ?? (group.required ? 1 : 0)) ||
      ids.length > limit
    )
      throw new Error(
        `${group.name}: escolha de ${group.min ?? (group.required ? 1 : 0)} a ${limit} opções.`,
      );
    return ids.map((id) => {
      const option = group.items.find((item) => item.id === id);
      if (!option || option.disponivel === false)
        throw new Error(`Uma opção de ${group.name} não está disponível.`);
      return {
        id: option.id,
        name: option.name,
        price: Number(option.priceDelta ?? 0),
        groupId: group.id,
        groupName: group.name,
      };
    });
  });
  return {
    resolved,
    extras: resolved.reduce((sum, item) => sum + item.price, 0),
  };
}

export function resolveComboOrder(
  groups: OptionGroup[],
  config: ComboOptionsConfig | null,
  selections: unknown,
  qty: unknown,
  total: unknown,
  price: number,
) {
  if (
    !Number.isSafeInteger(qty) ||
    Number(qty) < 1 ||
    Number(qty) > 100 ||
    typeof total !== "number" ||
    !Number.isFinite(total)
  )
    throw new Error("Confira a quantidade e o valor do combo.");
  if (
    selections != null &&
    (typeof selections !== "object" || Array.isArray(selections))
  )
    throw new Error("Confira as escolhas do combo.");
  const map = (selections ?? {}) as Record<string, string[]>;
  if (config?.modo !== "cliente" && Object.keys(map).length)
    throw new Error(
      "As opções deste combo são fixas. Adicione o combo novamente à sacola.",
    );
  const choices = resolveComboChoices(
    config ? groups : [],
    config?.modo === "fixo" ? config.selecoes : map,
  );
  const extras = config?.modo === "cliente" ? choices.extras : 0;
  const expectedTotal = Math.round((price + extras) * Number(qty) * 100) / 100;
  if (Math.abs(total - expectedTotal) > 0.01)
    throw new Error(
      "O preço ou as opções do combo foram atualizados. Adicione o combo novamente à sacola.",
    );
  return {
    total: expectedTotal,
    selections: config?.modo === "fixo" ? config.selecoes : map,
    adicionais: choices.resolved.map((choice) => ({
      ...choice,
      price: config?.modo === "fixo" ? 0 : choice.price,
    })),
  };
}
