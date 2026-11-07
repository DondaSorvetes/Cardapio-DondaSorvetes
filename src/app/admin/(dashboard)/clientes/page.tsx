import { requirePageAccess } from "@/lib/admin/auth";
import { createServerClient } from "@/integrations/supabase/client.server";
import { ClientesManager } from "@/components/admin/clientes/ClientesManager";
import type { Cliente } from "@/types/cliente";

export default async function AdminClientsPage() {
  await requirePageAccess("clientes");
  const supabase = createServerClient();

  const [{ data: clientes }, { data: pedidos }] = await Promise.all([
    supabase
      .from("clientes")
      .select("*")
      .order("created_at", { ascending: false }),
    // Só os campos usados nas estatísticas (payload menor = mais rápido)
    supabase
      .from("pedidos")
      .select("cliente_id, total, created_at"),
  ]);

  // Calcular estatísticas por cliente
  const estatisticasPorCliente = new Map<string, {
    total_pedidos: number;
    total_gasto: number;
    ultimo_pedido: string;
  }>();

  (pedidos || []).forEach((pedido) => {
    const clienteId = pedido.cliente_id;
    if (!clienteId) return;

    const stats = estatisticasPorCliente.get(clienteId) || {
      total_pedidos: 0,
      total_gasto: 0,
      ultimo_pedido: pedido.created_at,
    };

    stats.total_pedidos++;
    stats.total_gasto += parseFloat(String(pedido.total || 0));

    // Manter o pedido mais recente
    if (new Date(pedido.created_at) > new Date(stats.ultimo_pedido)) {
      stats.ultimo_pedido = pedido.created_at;
    }

    estatisticasPorCliente.set(clienteId, stats);
  });

  // Converter para o formato tipado com estatísticas
  const clientesFormatados: Cliente[] = (clientes || []).map((c) => {
    const stats = estatisticasPorCliente.get(c.id);
    const totalPedidos = stats?.total_pedidos || 0;
    const totalGasto = stats?.total_gasto || 0;

    // Determinar status do cliente
    let status_cliente: Cliente["status_cliente"] = "novo";
    if (totalPedidos === 0) {
      status_cliente = "novo";
    } else if (totalPedidos >= 10 || totalGasto >= 500) {
      status_cliente = "vip";
    } else if (totalPedidos >= 3) {
      status_cliente = "frequente";
    } else {
      // Verificar se está inativo (último pedido há mais de 30 dias)
      if (stats?.ultimo_pedido) {
        const diasDesdeUltimoPedido = Math.floor(
          (Date.now() - new Date(stats.ultimo_pedido).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diasDesdeUltimoPedido > 30) {
          status_cliente = "inativo";
        }
      }
    }

    return {
      id: c.id,
      nome: c.nome || "Cliente",
      telefone: c.telefone || "",
      email: c.email ?? undefined,
      created_at: c.created_at,
      endereco: c.endereco ?? undefined,
      enderecos_adicionais: Array.isArray(c.enderecos_adicionais)
        ? (c.enderecos_adicionais as unknown as Cliente["enderecos_adicionais"])
        : [],
      total_pedidos: totalPedidos,
      total_gasto: totalGasto,
      ticket_medio: totalPedidos > 0 ? totalGasto / totalPedidos : 0,
      ultimo_pedido: stats?.ultimo_pedido,
      status_cliente,
    };
  });

  return <ClientesManager clientesIniciais={clientesFormatados} />;
}
