import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { publicRead } from "@/lib/public-read.server";
import { createServerClient } from "@/integrations/supabase/client.server";
import {
  notesOptionGroup,
  type Category,
  type Product,
  type Tag,
  type OptionGroup,
} from "./tipos";
import {
  getFreteDeadlineLabel,
  getSaoPauloDateTime,
  isFreteCampaignActive,
  nextFreteRefresh,
} from "@/lib/promocoes/frete";
import { imageProxyUrl } from "@/lib/image/proxy-url";
import {
  createComboOptionLoader,
  resolveComboChoices,
  type ComboOptionsConfig,
} from "@/lib/combos/options";

async function readData() {
  const supabase = createServerClient();
  const agoraBrasil = getSaoPauloDateTime();
  const [
    categoriesResult,
    productsResult,
    combosResult,
    freightResult,
    tagsResult,
  ] = await Promise.all([
    supabase
      .from("categorias")
      .select("id, nome, ordem")
      .order("ordem", { ascending: true }),
    supabase
      .from("produtos")
      .select(
        "id, nome, descricao, preco_base, preco_promocional, esta_disponivel, ordem, imagem_url, categoria_id, tag_id, pergunta_colher",
      )
      .order("ordem", { ascending: true }),
    supabase
      .from("combos")
      .select(
        "id,nome,descricao,preco,imagem_url,ativa,created_at,opcoes_config",
      )
      .eq("ativa", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("promocoes_frete_gratis")
      .select("produto_id, data_inicio, data_fim, hora_inicio, hora_fim")
      .eq("ativa", true)
      .gte("data_fim", agoraBrasil.date),
    // "*" mantém o cardápio funcionando antes da migration 0021 (destaque_cardapio).
    supabase.from("tags").select("*"),
  ]);
  const { data: categorias, error: catError } = categoriesResult;
  const { data: produtos, error: prodError } = productsResult;
  if (catError) throw catError;
  if (prodError) throw prodError;
  for (const result of [combosResult, freightResult, tagsResult])
    if (result.error) throw result.error;
  const combos = combosResult.data;
  const comboLinksResult = combos?.length
    ? await supabase
        .from("combo_itens")
        .select("combo_id, produto_id, quantidade")
        .in(
          "combo_id",
          combos.map((combo) => combo.id),
        )
    : null;
  if (comboLinksResult?.error) throw comboLinksResult.error;
  const comboLinks = comboLinksResult?.data ?? [];
  const campanhasAtivas = (freightResult.data ?? []).filter((campaign) =>
    isFreteCampaignActive(campaign, agoraBrasil),
  );
  type Campaign = (typeof campanhasAtivas)[number];
  const campaignKey = (c: Campaign) =>
    c.data_fim + "T" + (c.hora_fim ?? "23:59");
  campanhasAtivas.sort((a, b) => campaignKey(a).localeCompare(campaignKey(b)));
  const globals = campanhasAtivas.filter((c) => c.produto_id == null);
  const campaignsByProduct = new Map<number, Campaign[]>();
  for (const campaign of campanhasAtivas)
    if (campaign.produto_id != null) {
      const list = campaignsByProduct.get(campaign.produto_id) ?? [];
      list.push(campaign);
      campaignsByProduct.set(campaign.produto_id, list);
    }
  const freightFor = (ids: number[]) => {
    const relevant = [
      ...globals,
      ...ids.flatMap((id) => campaignsByProduct.get(id) ?? []),
    ];
    const first = relevant.reduce<Campaign | undefined>(
      (best, c) => (!best || campaignKey(c) < campaignKey(best) ? c : best),
      undefined,
    );
    return {
      freteGratis: Boolean(first),
      freteGratisPrazo: first
        ? getFreteDeadlineLabel(
            first.data_fim,
            first.hora_fim ?? "23:59",
            agoraBrasil.date,
          )
        : undefined,
    };
  };
  const freightByProduct = new Map(
    (produtos ?? []).map((p) => [p.id, freightFor([p.id])]),
  );
  const tags = tagsResult.data;
  const tagsMap = new Map<number, Tag>(
    (tags ?? []).map((t) => [
      t.id,
      {
        id: t.id,
        nome: t.nome,
        cor_fundo: t.cor_fundo,
        cor_texto: t.cor_texto ?? "",
        ...((t as { destaque_cardapio?: boolean }).destaque_cardapio
          ? { destaque: true }
          : {}),
        ...((t as { icone?: string | null }).icone
          ? { icone: (t as { icone: string }).icone }
          : {}),
      } satisfies Tag,
    ]),
  );

  const menuCategories = (categorias ?? []).map((cat) => {
    const catProdutos = (produtos ?? []).filter(
      (p) => p.categoria_id === cat.id,
    );

    return {
      id: String(cat.id),
      name: cat.nome,
      products: catProdutos.map((prod): Product => {
        const precoPromo =
          prod.preco_promocional != null
            ? Number(prod.preco_promocional)
            : null;

        return {
          id: String(prod.id),
          name: prod.nome,
          description: prod.descricao ?? "",
          price: Number(prod.preco_base),
          precoPromocional:
            precoPromo != null && Number.isFinite(precoPromo)
              ? precoPromo
              : null,
          ...freightByProduct.get(prod.id),
          image: imageProxyUrl(prod.imagem_url) ?? undefined,
          tag: prod.tag_id ? tagsMap.get(prod.tag_id) : undefined,
          // Opções e adicionais são carregados só quando o cliente abre este produto.
          optionGroups: [notesOptionGroup],
          disponivel: prod.esta_disponivel ?? undefined,
          perguntaColher: prod.pergunta_colher !== false,
        };
      }),
    };
  });

  const productById = new Map(
    (produtos ?? []).map((product) => [product.id, product]),
  );
  const optionLinks = comboLinks.filter((link) =>
    combos?.some((c) => c.id === link.combo_id && c.opcoes_config),
  );
  const loadOptions = optionLinks.length
    ? await createComboOptionLoader(
        supabase,
        optionLinks.map((link) => link.produto_id),
      )
    : () => [] as OptionGroup[];
  const linksByCombo = new Map<number, typeof comboLinks>();
  for (const link of comboLinks) {
    const list = linksByCombo.get(link.combo_id) ?? [];
    list.push(link);
    linksByCombo.set(link.combo_id, list);
  }
  const comboOptions = new Map(
    await Promise.all(
      (combos ?? []).map(async (combo) => {
        const config = combo.opcoes_config as ComboOptionsConfig | null;
        try {
          const groups = config
            ? loadOptions(linksByCombo.get(combo.id) ?? [])
            : [];
          const fixed =
            config?.modo === "fixo"
              ? resolveComboChoices(groups, config.selecoes)
              : null;
          return [
            combo.id,
            { config, groups, fixed, available: true as boolean },
          ] as const;
        } catch {
          console.warn("[catalog] Um combo foi ocultado por opções inválidas.");
          return [
            combo.id,
            {
              config,
              groups: [] as OptionGroup[],
              fixed: null,
              available: false as boolean,
            },
          ] as const;
        }
      }),
    ),
  );
  const comboProducts: Product[] = (combos ?? []).flatMap((combo) => {
    const options = comboOptions.get(combo.id)!;
    const links = linksByCombo.get(combo.id) ?? [];
    const selected = links.flatMap((link) => {
      const product = productById.get(link.produto_id);
      return product ? [{ product, quantity: link.quantidade }] : [];
    });
    if (selected.length < 2) return [];
    const referencePrice =
      selected.reduce(
        (sum, item) => sum + Number(item.product.preco_base) * item.quantity,
        0,
      ) + (options.fixed?.extras ?? 0);
    const comboItems = selected.map(({ product, quantity }) => ({
      productId: product.id,
      name: product.nome,
      quantity,
    }));
    const details = comboItems
      .map((item) => `${item.quantity}× ${item.name}`)
      .join(" · ");
    const freight = freightFor(selected.map(({ product }) => product.id));
    const firstImage =
      selected.find(({ product }) => product.imagem_url)?.product.imagem_url ??
      null;
    return [
      {
        id: `combo-${combo.id}`,
        comboId: combo.id,
        comboOptionsMode: options.config?.modo,
        comboFixedChoices: options.fixed?.resolved.map((choice) => ({
          ...choice,
          price: 0,
        })),
        comboItems,
        name: combo.nome,
        description: [combo.descricao, `Inclui: ${details}`]
          .filter(Boolean)
          .join(" "),
        price: Math.max(referencePrice, Number(combo.preco)),
        precoPromocional:
          Number(combo.preco) < referencePrice ? Number(combo.preco) : null,
        image: imageProxyUrl(combo.imagem_url ?? firstImage) ?? undefined,
        ...freight,
        tag: undefined,
        optionGroups: [
          ...(options.config?.modo === "cliente" ? options.groups : []),
          notesOptionGroup,
        ],
        disponivel:
          options.available &&
          selected.every(({ product }) => product.esta_disponivel !== false),
        // Combo pergunta se algum produto dele pergunta.
        perguntaColher: selected.some(
          ({ product }) => product.pergunta_colher !== false,
        ),
      } satisfies Product,
    ];
  });

  const categoriasMenu: Category[] = comboProducts.length
    ? [
        ...menuCategories,
        { id: "combos", name: "Combos", products: comboProducts },
      ]
    : menuCategories;
  return {
    categorias: categoriasMenu,
    nextRefreshAt: nextFreteRefresh(freightResult.data ?? []),
  };
}

const cachedMenu = unstable_cache(
  readData,
  ["public-menu-v4", process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""],
  { tags: ["public-catalog"], revalidate: 120 },
);
export function fetchMenuSnapshot() {
  return publicRead("menu", async () => {
    const snapshot = await cachedMenu();
    if (snapshot.nextRefreshAt <= Date.now()) {
      revalidateTag("public-catalog");
      return readData();
    }
    return snapshot;
  });
}
export async function fetchMenu(): Promise<Category[]> {
  return (await fetchMenuSnapshot()).categorias;
}
