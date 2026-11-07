"use server";

import { requirePermission } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/integrations/supabase/client.server";

const STATUS_VALIDOS = [
  "pendente",
  "confirmado",
  "preparando",
  "saiu_entrega",
  "entregue",
  "cancelado",
] as const;

export type PedidoStatusUpdate = (typeof STATUS_VALIDOS)[number];

export async function updatePedidoStatus(
  id: string,
  status: PedidoStatusUpdate
) {
  await requirePermission("pedido:update_status");

  if (!STATUS_VALIDOS.includes(status)) {
    throw new Error("Status de pedido inválido");
  }

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("pedidos")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("Erro ao atualizar status do pedido:", error);
    throw new Error("Não foi possível atualizar o status do pedido");
  }

  if (!data) {
    throw new Error("Pedido não encontrado");
  }

  return data;
}

export async function listPedidosAdmin(limit = 100) {
  await requirePermission("pedido:read");
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("pedidos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Erro ao listar pedidos:", error);
    throw new Error("Não foi possível listar os pedidos");
  }

  return data || [];
}
