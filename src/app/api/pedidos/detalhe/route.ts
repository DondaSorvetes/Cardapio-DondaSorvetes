import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  apiOk,
  apiServerError,
  apiUnauthorized,
  apiError,
} from "@/lib/security/api-response";
import { obterSessao } from "@/lib/auth";
import { createServerClient } from "@/integrations/supabase/client.server";
const headers = { "Cache-Control": "private, no-store" };
import { primeiroNome } from "@/lib/entregadores";
import {
  enrichPedidoItens,
  type OpcaoLookup,
  type GrupoLookup,
} from "@/lib/utils/pedido";
export const GET = withApiGuard(
  { methods: ["GET"], rateLimit: RATE_LIMITS.apiStrict, checkOrigin: false },
  async (request) => {
    try {
      const sessao = await obterSessao();
      if (!sessao) return apiUnauthorized();
      const id = new URL(request.url).searchParams.get("id");
      if (!id || id.length > 100) return apiError("Pedido inválido", 400);
      const db = createServerClient();
      const { data: pedido, error } = await db
        .from("pedidos")
        .select(
          "id, cliente_nome, cliente_telefone, tipo_entrega, agendado_para, endereco_completo, meio_pagamento, troco_para, subtotal, taxa_entrega, total, itens, status, created_at, updated_at, entregador_id",
        )
        .eq("cliente_id", sessao.id)
        .eq("id", id)
        .maybeSingle();
      if (error) return apiServerError(error);
      if (!pedido) return apiError("Pedido não encontrado", 404);
      const itens = Array.isArray(pedido.itens) ? pedido.itens : [];
      // Modern snapshots already contain names. Resolve only legacy ID selections, and only their IDs.
      const optionIds = new Set<string>(),
        groupIds = new Set<string>();
      for (const item of itens) {
        if (
          !item ||
          typeof item !== "object" ||
          Array.isArray(item) ||
          (Array.isArray(item.adicionais) && item.adicionais.length)
        )
          continue;
        if (
          item.selections &&
          !Array.isArray(item.selections) &&
          typeof item.selections === "object"
        ) {
          for (const [group, values] of Object.entries(item.selections)) {
            if (group === "obs" || !Array.isArray(values)) continue;
            groupIds.add(group);
            for (const value of values)
              if (typeof value === "string" || typeof value === "number")
                optionIds.add(String(value));
          }
        }
      }
      let opcoes: OpcaoLookup[] = [],
        grupos: GrupoLookup[] = [];
      if (optionIds.size) {
        const [options, groups] = await Promise.all([
          db
            .from("opcoes")
            .select(
              "id, nome, preco_adicional, grupo_id, grupo:grupos_opcoes(id, nome)",
            )
            .in("id", [...optionIds].map(Number).filter(Number.isFinite)),
          db
            .from("grupos_opcoes")
            .select("id, nome")
            .in("id", [...groupIds].map(Number).filter(Number.isFinite)),
        ]);
        if (options.error || groups.error)
          return apiServerError(options.error || groups.error);
        opcoes = (options.data ?? []) as unknown as OpcaoLookup[];
        grupos = (groups.data ?? []) as GrupoLookup[];
      }
      // Quem está levando: só o primeiro nome e só depois que saiu para entrega.
      // O id do entregador nunca vai para o cliente.
      const { entregador_id, ...publico } = pedido;
      let entregador_nome: string | null = null;
      if (entregador_id && (pedido.status === "saiu_entrega" || pedido.status === "entregue")) {
        const { data: entregador } = await db
          .from("entregadores")
          .select("nome")
          .eq("id", entregador_id)
          .maybeSingle();
        entregador_nome = primeiroNome(entregador?.nome);
      }
      return apiOk(
        {
          pedido: {
            ...publico,
            entregador_nome,
            itens: enrichPedidoItens(itens, opcoes, grupos),
          },
        },
        200,
        { ...headers, "X-Customer-Id": sessao.id },
      );
    } catch (error) {
      return apiServerError(error);
    }
  },
);
