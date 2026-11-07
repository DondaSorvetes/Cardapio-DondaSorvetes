"use server";

import { requirePermission } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/integrations/supabase/client.server";
import { formatEndereco } from "@/lib/utils/formatters";
import type { Pedido } from "@/types/pedido";

export async function getAutomaticPrintOrders(since: string | null) {
  await requirePermission("pedido:update_status");
  const serverTime = new Date().toISOString();
  const db = createServiceRoleClient();
  const { data: config, error } = await db.from("configuracoes_loja")
    .select("imprimir_aceitar_automaticamente").order("id", { ascending: true }).limit(1).maybeSingle();
  if (error) throw new Error("Não foi possível consultar a impressão automática.");
  const enabled = Boolean(config?.imprimir_aceitar_automaticamente);
  // Starting a station must never print the entire historical order backlog.
  if (!enabled || !since) return { enabled, serverTime, orders: [] as Array<{ id: string; created_at: string }> };
  const date = new Date(since);
  if (!Number.isFinite(date.getTime())) throw new Error("Período de impressão inválido.");
  const from = new Date(Math.max(date.getTime() - 5000, Date.now() - 30 * 60_000)).toISOString();
  const { data, error: ordersError } = await db.from("pedidos").select("id, created_at")
    .gte("created_at", from).in("status", ["pendente", "confirmado", "preparando"])
    .order("created_at", { ascending: true }).order("id", { ascending: true }).limit(100);
  if (ordersError) throw new Error("Não foi possível consultar novos pedidos para impressão.");
  return { enabled, serverTime, orders: (data ?? []) as Array<{ id: string; created_at: string }> };
}

export async function prepareOrderForAutomaticPrint(id: string): Promise<Pedido | null> {
  await requirePermission("pedido:update_status");
  const db = createServiceRoleClient();
  const { data: config, error: configError } = await db.from("configuracoes_loja")
    .select("imprimir_aceitar_automaticamente").order("id", { ascending: true }).limit(1).maybeSingle();
  if (configError) throw new Error("Não foi possível confirmar a configuração de impressão.");
  if (!config?.imprimir_aceitar_automaticamente) return null;
  // Conditional update cannot move an already delivered/cancelled order backwards.
  const { error: updateError } = await db.from("pedidos").update({ status: "preparando", updated_at: new Date().toISOString() })
    .eq("id", id).in("status", ["pendente", "confirmado"]);
  if (updateError) throw new Error("Não foi possível colocar o pedido em preparo.");
  const { data, error } = await db.from("pedidos").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Não foi possível carregar a comanda.");
  if (!data || data.status !== "preparando") return null;
  return { ...data, endereco_completo: formatEndereco(data.endereco_completo as Parameters<typeof formatEndereco>[0]), itens: Array.isArray(data.itens) ? data.itens : [] } as unknown as Pedido;
}
