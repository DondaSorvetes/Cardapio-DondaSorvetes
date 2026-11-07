import type { Product } from "@/data/tipos";

export type ComplementoResolvido = {
  id?: string;
  name: string;
  price: number;
  groupId?: string;
  groupName?: string;
};

export type OpcaoLookup = {
  id: string | number;
  nome: string;
  preco_adicional?: number | null;
  grupo_id?: string | number | null;
  grupo?: { id?: string | number; nome?: string } | null;
};

export type GrupoLookup = {
  id: string | number;
  nome: string;
};

/** Resolve selections do carrinho (grupoId → optionIds) usando os grupos do produto. */
export function resolveSelectionsFromProduct(
  produto: Product,
  selections: Record<string, string[]> | undefined | null
): ComplementoResolvido[] {
  if (produto.comboOptionsMode === "fixo") return produto.comboFixedChoices ?? [];
  if (!selections || !produto?.optionGroups) return [];

  const result: ComplementoResolvido[] = [];

  for (const grupo of produto.optionGroups) {
    if (grupo.id === "obs") continue;
    const ids = selections[grupo.id] ?? selections[String(grupo.id)] ?? [];
    for (const id of ids) {
      const item = grupo.items.find(
        (i) => String(i.id) === String(id)
      );
      if (item) {
        result.push({
          id: String(item.id),
          name: item.name,
          price: Number(item.priceDelta ?? 0),
          groupId: String(grupo.id),
          groupName: grupo.name,
        });
      }
    }
  }

  return result;
}

/** Resolve selections (IDs) usando mapas de opções/grupos do banco. */
export function resolveSelectionsFromLookup(
  selections: Record<string, string[] | number[]> | undefined | null,
  opcoesById: Map<string, OpcaoLookup>,
  gruposById?: Map<string, GrupoLookup>
): ComplementoResolvido[] {
  if (!selections || typeof selections !== "object") return [];

  const result: ComplementoResolvido[] = [];

  for (const [groupId, optionIds] of Object.entries(selections)) {
    if (groupId === "obs") continue;
    if (!Array.isArray(optionIds)) continue;

    const grupoNome =
      gruposById?.get(String(groupId))?.nome ??
      opcoesById.get(String(optionIds[0]))?.grupo?.nome;

    for (const rawId of optionIds) {
      const id = String(rawId);
      const opcao = opcoesById.get(id);
      if (opcao) {
        result.push({
          id,
          name: opcao.nome,
          price: Number(opcao.preco_adicional ?? 0),
          groupId: String(groupId),
          groupName:
            opcao.grupo?.nome ||
            grupoNome ||
            gruposById?.get(String(opcao.grupo_id ?? groupId))?.nome,
        });
      } else {
        // Fallback: ainda mostra o ID se não achar (melhor que sumir)
        result.push({
          id,
          name: `Opção #${id}`,
          price: 0,
          groupId: String(groupId),
          groupName: grupoNome,
        });
      }
    }
  }

  return result;
}

function isNamedComplemento(value: unknown): value is ComplementoResolvido {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === "string" && v.name.length > 0;
}

function normalizeNamed(value: Record<string, unknown>): ComplementoResolvido {
  const grupo = value.grupo as { nome?: string } | undefined;
  return {
    id: value.id != null ? String(value.id) : undefined,
    name: String(value.name ?? value.nome ?? ""),
    price: Number(value.price ?? value.preco ?? value.preco_adicional ?? 0),
    groupId:
      value.groupId != null
        ? String(value.groupId)
        : value.group_id != null
          ? String(value.group_id)
          : undefined,
    groupName:
      (value.groupName as string | undefined) ??
      (value.group_name as string | undefined) ??
      grupo?.nome ??
      (value.grupoNome as string | undefined),
  };
}

/**
 * Extrai complementos/adicionais de um item de pedido.
 * Suporta:
 * - adicionais: [{ name, price, groupName }]
 * - selections: [{ name, price }] (array resolvido)
 * - selections: { grupoId: [opcaoId, ...] } (precisa de lookup)
 * - complementos: JSON legado
 */
type PedidoItemLike = {
  adicionais?: unknown;
  selections?: unknown;
  complementos?: unknown;
  produto?: Product;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function extractComplementos(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  item: PedidoItemLike | Record<string, unknown> | object | null | undefined,
  lookup?: {
    opcoesById?: Map<string, OpcaoLookup>;
    gruposById?: Map<string, GrupoLookup>;
  }
): ComplementoResolvido[] {
  if (!item) return [];
  const complementos: ComplementoResolvido[] = [];
  const row = item as PedidoItemLike;

  // 1) Campo adicionais (preferencial — gravado com nomes)
  if (row.adicionais) {
    const list = Array.isArray(row.adicionais)
      ? row.adicionais
      : typeof row.adicionais === "string"
        ? safeParseArray(row.adicionais)
        : [];
    for (const entry of list) {
      const rec = asRecord(entry);
      if (rec && (isNamedComplemento(rec) || typeof rec.nome === "string")) {
        const n = normalizeNamed(rec);
        if (n.name) complementos.push(n);
      }
    }
    if (complementos.length > 0) return complementos;
  }

  // 2) selections como array de objetos nomeados
  if (Array.isArray(row.selections)) {
    for (const entry of row.selections) {
      const rec = asRecord(entry);
      if (rec && (isNamedComplemento(rec) || typeof rec.nome === "string")) {
        const n = normalizeNamed(rec);
        if (n.name) complementos.push(n);
      }
    }
    if (complementos.length > 0) return complementos;
  }

  // 3) selections como mapa grupoId → optionIds
  if (
    row.selections &&
    typeof row.selections === "object" &&
    !Array.isArray(row.selections)
  ) {
    const map = row.selections as Record<string, string[] | number[]>;
    const keys = Object.keys(map);
    const values = Object.values(map);
    const looksLikeIdMap =
      keys.length > 0 &&
      values.every(
        (v) =>
          Array.isArray(v) &&
          v.every((x) => typeof x === "string" || typeof x === "number")
      );

    if (looksLikeIdMap) {
      if (lookup?.opcoesById) {
        return resolveSelectionsFromLookup(
          map,
          lookup.opcoesById,
          lookup.gruposById
        );
      }
      if (row.produto?.optionGroups) {
        return resolveSelectionsFromProduct(
          row.produto,
          map as Record<string, string[]>
        );
      }
    }
  }

  // 4) complementos JSONB legado
  if (row.complementos) {
    const parsed =
      typeof row.complementos === "string"
        ? safeParse(row.complementos)
        : row.complementos;

    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        const rec = asRecord(entry);
        if (rec && (isNamedComplemento(rec) || typeof rec.nome === "string")) {
          const n = normalizeNamed(rec);
          if (n.name) complementos.push(n);
        }
      }
    } else if (parsed && typeof parsed === "object") {
      Object.values(parsed as Record<string, unknown>).forEach((grupo) => {
        if (Array.isArray(grupo)) {
          for (const entry of grupo) {
            const rec = asRecord(entry);
            if (rec && (isNamedComplemento(rec) || typeof rec.nome === "string")) {
              const n = normalizeNamed(rec);
              if (n.name) complementos.push(n);
            }
          }
        } else {
          const rec = asRecord(grupo);
          if (rec && (isNamedComplemento(rec) || typeof rec.nome === "string")) {
            const n = normalizeNamed(rec);
            if (n.name) complementos.push(n);
          }
        }
      });
    }
  }

  return complementos;
}

/** Agrupa complementos por grupo para exibição. */
export function groupComplementos(complementos: ComplementoResolvido[]) {
  const groups = new Map<
    string,
    { groupName: string; items: ComplementoResolvido[] }
  >();

  for (const c of complementos) {
    const key = c.groupId || c.groupName || "_outros";
    const name = c.groupName || "Adicionais";
    if (!groups.has(key)) {
      groups.set(key, { groupName: name, items: [] });
    }
    groups.get(key)!.items.push(c);
  }

  return Array.from(groups.values());
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function safeParseArray(value: string): unknown[] {
  const parsed = safeParse(value);
  return Array.isArray(parsed) ? parsed : [];
}

export type EnrichedPedidoItem = Record<string, unknown> & {
  adicionais: ComplementoResolvido[];
  selectionsResolved: ComplementoResolvido[];
};

/** Enriquece itens de pedido resolvendo IDs de opções para nomes. */
export function enrichPedidoItens(
  itens: unknown[],
  opcoes: OpcaoLookup[],
  grupos?: GrupoLookup[]
): EnrichedPedidoItem[] {
  const opcoesById = new Map(
    opcoes.map((o) => [String(o.id), o] as const)
  );
  const gruposById = new Map(
    (grupos ?? []).map((g) => [String(g.id), g] as const)
  );

  // Preenche grupo nos maps a partir da relação embutida
  for (const o of opcoes) {
    if (o.grupo?.id != null && o.grupo.nome && !gruposById.has(String(o.grupo.id))) {
      gruposById.set(String(o.grupo.id), {
        id: o.grupo.id,
        nome: o.grupo.nome,
      });
    }
  }

  return (itens ?? []).map((raw) => {
    const item = (asRecord(raw) ?? {}) as PedidoItemLike & Record<string, unknown>;
    const adicionais = extractComplementos(item, { opcoesById, gruposById });
    return {
      ...item,
      adicionais,
      selectionsResolved: adicionais,
    };
  });
}
