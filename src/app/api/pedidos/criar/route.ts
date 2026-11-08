import { after, NextRequest } from "next/server";
import { z } from "zod";
import { obterSessao } from "@/lib/auth";
import { notifyNewOrder } from "@/lib/push/pedido-push.server";
import { createServerClient } from "@/integrations/supabase/client.server";
import { withApiGuard } from "@/lib/security/with-api-guard";
import {
  RATE_LIMITS,
  rateLimitCheck,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";
import {
  apiError,
  apiOk,
  apiServerError,
  apiUnauthorized,
  apiValidation,
  apiRateLimited,
} from "@/lib/security/api-response";
import { sanitizePhone, sanitizeText } from "@/lib/security/sanitize";
import { securityLog } from "@/lib/security/logger";
import {
  getSaoPauloDateTime,
  isFreteCampaignActive,
} from "@/lib/promocoes/frete";
import { validarCupom } from "@/lib/cupons";
import {
  loadComboOptionGroups,
  resolveComboOrder,
  type ComboOptionsConfig,
} from "@/lib/combos/options";

import {
  checkoutItemSchema,
  resolveProductItem,
  cents,
  type CatalogProduct,
} from "@/lib/checkout/items";

import { checkoutIdentity, previousCheckout } from "@/lib/checkout/idempotency";
import { MEIOS_PAGAMENTO_ACEITOS } from "@/lib/pagamento";

const criarPedidoSchema = z.object({
  cliente_nome: z
    .string()
    .min(2)
    .max(120)
    .transform((s) => sanitizeText(s, 120)),
  cliente_telefone: z
    .string()
    .min(10)
    .max(20)
    .transform((s) => sanitizePhone(s)),
  tipo_entrega: z.enum(["entrega", "delivery", "retirada"]),
  /** Só retirada: início da janela agendada (ISO). Ausente/null = agora. */
  agendado_para: z.string().datetime({ offset: true }).optional().nullable(),
  endereco_id: z.string().max(64).optional().nullable(),
  endereco_completo: z.unknown().optional().nullable(),
  // Só pagamento na entrega: dinheiro, pix, débito ou crédito ("cartao" = sacolas antigas).
  meio_pagamento: z.enum(MEIOS_PAGAMENTO_ACEITOS),
  troco_para: z
    .union([z.string().max(20), z.number()])
    .optional()
    .nullable()
    .transform((t) => (typeof t === "string" ? sanitizeText(t, 20) : t)),
  subtotal: z.number().min(0).max(100_000),
  taxa_entrega: z.number().min(0).max(1_000),
  total: z.number().min(0).max(100_000),
  cupom_codigo: z.string().max(32).optional().nullable(),
  itens: z.array(checkoutItemSchema).min(1).max(50),
  observacoes: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((s) => (s ? sanitizeText(s, 500) : null)),
});

export const POST = withApiGuard(
  {
    methods: ["POST"],
    rateLimit: RATE_LIMITS.checkout,
    checkOrigin: true,
  },
  async (request: NextRequest, { ip }) => {
    try {
      const sessao = await obterSessao();
      if (!sessao) return apiUnauthorized();
      const customerLimit = await rateLimitCheck(sessao.id, {
        ...RATE_LIMITS.checkout,
        bucket: "api:checkout:customer",
      });
      if (!customerLimit.success)
        return apiRateLimited(rateLimitHeaders(customerLimit));

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return apiValidation("Corpo da requisição inválido");
      }

      const parsed = criarPedidoSchema.safeParse(body);
      if (!parsed.success) {
        return apiValidation("Dados do pedido inválidos");
      }

      const data = parsed.data;
      let identity: ReturnType<typeof checkoutIdentity>;
      try {
        identity = checkoutIdentity(
          request.headers?.get("Idempotency-Key") ?? null,
          data,
        );
      } catch {
        return apiValidation("Atualize o cardápio e confirme o pedido novamente.");
      }
      const supabase = createServerClient();
      if (identity) {
        try {
          const previous = await previousCheckout(
            supabase,
            sessao.id,
            identity,
          );
          if (previous) return apiOk({ pedido: previous, replayed: true }, 200);
        } catch (error) {
          return apiError(
            error instanceof Error ? error.message : "Confira seus pedidos.",
            409,
          );
        }
      }

      if (
        (data.tipo_entrega === "entrega" || data.tipo_entrega === "delivery") &&
        !data.endereco_completo
      ) {
        return apiValidation("Endereço é obrigatório para entrega");
      }

      let agendadoPara: string | null = null;
      if (data.agendado_para) {
        if (data.tipo_entrega !== "retirada")
          return apiValidation("Agendamento disponível apenas para retirada");
        const inicio = new Date(data.agendado_para).getTime();
        const agora = Date.now();
        // Tolera alguns minutos de relógio/demora no checkout; até 8 dias à frente.
        if (inicio < agora - 10 * 60_000 || inicio > agora + 8 * 86_400_000)
          return apiValidation("Horário de retirada inválido. Escolha outro horário.");
        agendadoPara = new Date(inicio).toISOString();
      }

      // Sanitiza nome no endereço se string
      let enderecoCompleto = data.endereco_completo;
      if (typeof enderecoCompleto === "string") {
        enderecoCompleto = sanitizeText(enderecoCompleto, 500);
      }

      type ConfigRow = {
        esta_aberto?: boolean | null;
        aceitar_pedidos_automaticamente?: boolean | null;
        imprimir_aceitar_automaticamente?: boolean | null;
        aceitando_pedidos?: boolean | null;
        taxa_entrega?: number | null;
      };

      let configLoja: ConfigRow | null = null;
      {
        const full = await supabase
          .from("configuracoes_loja")
          .select(
            "esta_aberto, aceitar_pedidos_automaticamente, imprimir_aceitar_automaticamente, aceitando_pedidos, taxa_entrega",
          )
          .order("id", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (!full.error && full.data) {
          configLoja = full.data as ConfigRow;
        } else {
          const basic = await supabase
            .from("configuracoes_loja")
            .select(
              "esta_aberto, aceitar_pedidos_automaticamente, taxa_entrega",
            )
            .order("id", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (!basic.error && basic.data) {
            configLoja = basic.data as ConfigRow;
          }
        }
      }

      if (
        !configLoja ||
        typeof configLoja.esta_aberto !== "boolean" ||
        !Number.isFinite(Number(configLoja.taxa_entrega)) ||
        Number(configLoja.taxa_entrega) < 0
      )
        return apiError(
          "Não foi possível confirmar o funcionamento da loja. Tente novamente.",
          503,
          { codigo: "STORE_UNAVAILABLE" },
        );
      if (configLoja) {
        const lojaAberta = configLoja.esta_aberto !== false;
        const aceitando =
          configLoja.aceitando_pedidos !== undefined &&
          configLoja.aceitando_pedidos !== null
            ? Boolean(configLoja.aceitando_pedidos)
            : lojaAberta;

        if (!lojaAberta || !aceitando) {
          return apiError(
            "A loja está fechada no momento e não está aceitando pedidos.",
            403,
            { codigo: "STORE_CLOSED" },
          );
        }
      }

      const getComboId = (raw: Record<string, unknown>) => {
        const product = raw.produto as
          { id?: unknown; comboId?: unknown } | undefined;
        const match =
          typeof product?.id === "string"
            ? /^combo-(\d+)$/.exec(product.id)
            : null;
        return match ? Number(match[1]) : Number(product?.comboId) || 0;
      };
      const comboIds = [
        ...new Set(data.itens.map(getComboId).filter((id) => id > 0)),
      ];
      let comboLinks: {
        combo_id: number;
        produto_id: number;
        quantidade: number;
      }[] = [];
      if (comboIds.length) {
        const [
          { data: activeCombos, error: comboError },
          { data: links, error: linksError },
        ] = await Promise.all([
          supabase.from("combos").select("*").in("id", comboIds),
          supabase
            .from("combo_itens")
            .select("combo_id, produto_id, quantidade")
            .in("combo_id", comboIds),
        ]);
        if (comboError || linksError)
          return apiServerError(comboError || linksError);
        if (
          (activeCombos ?? []).length !== comboIds.length ||
          activeCombos?.some((combo) => !combo.ativa)
        )
          return apiError(
            "Um dos combos não está mais disponível. Atualize a sacola.",
            409,
            { codigo: "COMBO_UNAVAILABLE" },
          );
        comboLinks = links ?? [];
        try {
          const configurations = new Map(
            await Promise.all(
              (activeCombos ?? []).map(async (combo) => {
                const items = comboLinks.filter(
                  (link) => link.combo_id === combo.id,
                );
                if (items.length < 2)
                  throw new Error("Um combo não está mais disponível.");
                return [
                  combo.id,
                  {
                    combo,
                    groups: await loadComboOptionGroups(supabase, items),
                  },
                ] as const;
              }),
            ),
          );
          for (const item of data.itens) {
            const comboId = getComboId(item);
            if (!comboId) continue;
            const { combo, groups } = configurations.get(comboId)!;
            const resolved = resolveComboOrder(
              groups,
              combo.opcoes_config as ComboOptionsConfig | null,
              item.selections,
              item.qty,
              item.total,
              Number(combo.preco),
            );
            Object.assign(item, resolved, {
              produto: {
                id: "combo-" + comboId,
                comboId,
                name: combo.nome,
                price: Number(combo.preco),
              },
            });
          }
          const itemsTotal = data.itens.reduce(
            (sum, item) => sum + Number(item.total),
            0,
          );
          if (
            !Number.isFinite(itemsTotal) ||
            Math.abs(itemsTotal - data.subtotal) > 0.01
          )
            return apiValidation("Confira o subtotal da sacola.");
        } catch (error) {
          return apiError(
            error instanceof Error
              ? error.message
              : "Confira as opções do combo.",
            409,
            { codigo: "COMBO_UPDATED" },
          );
        }
      }
      const regularItems = data.itens.filter((item) => !getComboId(item));
      const productIds = [
        ...new Set(regularItems.map((item) => Number(item.produto.id))),
      ];
      if (
        regularItems.some((item) => !/^[1-9]\d*$/.test(item.produto.id)) ||
        productIds.some((id) => !Number.isSafeInteger(id) || id <= 0)
      )
        return apiValidation("Produto inválido.");
      let canonicalItems: (
        ReturnType<typeof resolveProductItem> | (typeof data.itens)[number]
      )[];
      try {
        const { data: products, error: productsError } = productIds.length
          ? await supabase
              .from("produtos")
              .select(
                "id,nome,descricao,preco_base,preco_promocional,esta_disponivel,imagem_url",
              )
              .in("id", productIds)
          : { data: [], error: null };
        if (productsError) return apiServerError(productsError);
        if (products?.length !== productIds.length)
          return apiError(
            "Um produto não está disponível. Atualize a sacola.",
            409,
          );
        const groups = await loadComboOptionGroups(
          supabase,
          productIds.map((produto_id) => ({ produto_id, quantidade: 1 })),
        );
        canonicalItems = data.itens.map((item) => {
          if (getComboId(item))
            return {
              ...item,
              observacoes: sanitizeText(item.observacoes, 500),
            };
          const product = products!.find(
            (product) => String(product.id) === item.produto.id,
          )!;
          const prefix = "p" + product.id + "u0g";
          const productGroups = groups
            .filter((group) => group.id.startsWith(prefix))
            .map((group) => ({
              ...group,
              id: group.id.slice(prefix.length),
              name: group.sourceGroupName ?? group.name,
            }));
          return resolveProductItem(
            item,
            product as CatalogProduct,
            productGroups,
          );
        });
      } catch (error) {
        return apiError(
          error instanceof Error
            ? error.message
            : "Confira os produtos da sacola.",
          409,
          { codigo: "CART_UPDATED" },
        );
      }
      const canonicalSubtotal =
        canonicalItems.reduce(
          (sum, item) => sum + cents(Number(item.total)),
          0,
        ) / 100;
      if (cents(canonicalSubtotal) !== cents(data.subtotal))
        return apiError("Confira o subtotal da sacola.", 409, {
          codigo: "CART_UPDATED",
        });
      data.subtotal = canonicalSubtotal;
      if (data.cupom_codigo) {
        try {
          await validarCupom(data.cupom_codigo, data.subtotal);
        } catch (error) {
          return apiError(
            error instanceof Error ? error.message : "Cupom inválido.",
            400,
          );
        }
      }

      const idsNoCarrinho = new Set(
        data.itens.flatMap((raw) => {
          const item = raw as { produto?: { id?: unknown; comboId?: unknown } };
          return item.produto?.comboId != null || item.produto?.id == null
            ? []
            : [String(item.produto.id)];
        }),
      );
      for (const link of comboLinks) idsNoCarrinho.add(String(link.produto_id));
      const agoraBrasil = getSaoPauloDateTime();
      const { data: campanhasFrete, error: freightError } = await supabase
        .from("promocoes_frete_gratis")
        .select("produto_id, data_inicio, data_fim, hora_inicio, hora_fim")
        .eq("ativa", true)
        .lte("data_inicio", agoraBrasil.date)
        .gte("data_fim", agoraBrasil.date);
      if (freightError) return apiServerError(freightError);
      const freteElegivel = (campanhasFrete ?? []).some(
        (campaign) =>
          isFreteCampaignActive(campaign, agoraBrasil) &&
          (campaign.produto_id == null ||
            idsNoCarrinho.has(String(campaign.produto_id))),
      );
      const entrega =
        data.tipo_entrega === "entrega" || data.tipo_entrega === "delivery";
      const taxaEntregaCalculada = entrega
        ? freteElegivel
          ? 0
          : Number(configLoja?.taxa_entrega ?? data.taxa_entrega)
        : 0;
      if (Math.abs(data.taxa_entrega - taxaEntregaCalculada) > 0.01) {
        return apiError(
          "O frete foi atualizado. Confira o valor na sacola e tente novamente.",
          409,
          { codigo: "SHIPPING_UPDATED" },
        );
      }

      const autoAceite = Boolean(
        configLoja?.aceitar_pedidos_automaticamente ||
        configLoja?.imprimir_aceitar_automaticamente,
      );
      const initialStatus: "pendente" | "preparando" = autoAceite
        ? "preparando"
        : "pendente";

      const { data: pedido, error } = await supabase
        .from("pedidos")
        .insert({
          ...(identity
            ? { idempotency_key: identity.key, idempotency_hash: identity.hash }
            : {}),
          cliente_id: sessao.id,
          cliente_nome: data.cliente_nome,
          cliente_telefone: data.cliente_telefone,
          tipo_entrega: data.tipo_entrega,
          // Só envia quando agendado: pedidos "agora" funcionam mesmo antes da migration 0023.
          ...(agendadoPara ? { agendado_para: agendadoPara } : {}),
          endereco_id: data.endereco_id,
          endereco_completo: enderecoCompleto as never,
          meio_pagamento: data.meio_pagamento,
          troco_para: data.troco_para != null ? String(data.troco_para) : null,
          subtotal: data.subtotal,
          taxa_entrega: taxaEntregaCalculada,
          total: cents(data.subtotal + taxaEntregaCalculada) / 100,
          cupom_codigo: data.cupom_codigo?.trim().toUpperCase() || null,
          itens: canonicalItems,
          status: initialStatus,
          observacoes: data.observacoes,
        })
        .select("id, status, total, desconto_cupom, cupom_codigo, created_at")
        .single();

      if (error || !pedido) {
        if (error?.code === "23505" && identity) {
          const previous = await previousCheckout(
            supabase,
            sessao.id,
            identity,
          );
          if (previous) return apiOk({ pedido: previous, replayed: true }, 200);
        }
        const message = error?.message ?? "";
        if (message.includes("CUPOM_INVALIDO"))
          return apiError("Esse cupom não é válido.", 400);
        if (message.includes("CUPOM_FORA_DA_VALIDADE"))
          return apiError("Esse cupom está fora do período de validade.", 400);
        if (message.includes("CUPOM_ESGOTADO"))
          return apiError(
            "Esse cupom acabou de atingir o limite de usos.",
            409,
          );
        if (message.includes("CUPOM_VALOR_MINIMO"))
          return apiError(
            "O pedido não atingiu o valor mínimo deste cupom.",
            400,
          );
        return apiServerError(error);
      }

      securityLog({
        event: "pedido.create",
        ip,
        userId: sessao.id,
        path: "/api/pedidos/criar",
        result: "ok",
        meta: { pedidoId: pedido.id, total: pedido.total },
      });

      // Avisa o celular da equipe depois de responder ao cliente (não atrasa o checkout).
      const pedidoId = pedido.id;
      const pedidoTotal = pedido.total;
      after(() =>
        notifyNewOrder({
          id: pedidoId,
          total: pedidoTotal,
          tipo_entrega: data.tipo_entrega,
          agendado_para: agendadoPara,
        }),
      );

      return apiOk(
        {
          mensagem: "Pedido criado com sucesso",
          pedido,
          auto_aceito: autoAceite,
        },
        201,
      );
    } catch (erro) {
      return apiServerError(erro);
    }
  },
);
