"use server";

/**
 * Preferências operacionais da loja (painel de pedidos).
 * Persistidas em `configuracoes_loja.aceitar_pedidos_automaticamente`.
 */

import { requireAdmin, requirePermission } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/integrations/supabase/client.server";

export type PreferenciasOperacionais = {
  id: number;
  aceitar_pedidos_automaticamente: boolean;
};

/** @deprecated Use PreferenciasOperacionais — mantido por compatibilidade */
export type StoreSettings = {
  id: string | number;
  auto_accept_orders: boolean;
  aceitar_pedidos_automaticamente?: boolean;
};

async function buscarLinhaConfig() {
  const supabase = createServiceRoleClient();
  // Sempre a mesma linha (menor id) — evita inconsistência se houver duplicatas
  const { data, error } = await supabase
    .from("configuracoes_loja")
    .select("id, aceitar_pedidos_automaticamente")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    // coluna pode ainda não existir se a migration não foi aplicada
    console.error("Erro ao buscar aceitar_pedidos_automaticamente:", error);
    throw new Error(
      "Não foi possível carregar as preferências. Aplique a migration em configuracoes_loja."
    );
  }

  return data as {
    id: number;
    aceitar_pedidos_automaticamente?: boolean | null;
  } | null;
}

export async function getPreferenciasOperacionais(): Promise<PreferenciasOperacionais> {
  await requireAdmin();
  const row = await buscarLinhaConfig();

  if (!row) {
    return { id: 0, aceitar_pedidos_automaticamente: false };
  }

  return {
    id: row.id,
    aceitar_pedidos_automaticamente: Boolean(
      row.aceitar_pedidos_automaticamente
    ),
  };
}

/** Compat: API antiga usada pelo PedidosManager */
export async function getStoreSettings(): Promise<StoreSettings> {
  const pref = await getPreferenciasOperacionais();
  return {
    id: pref.id,
    auto_accept_orders: pref.aceitar_pedidos_automaticamente,
    aceitar_pedidos_automaticamente: pref.aceitar_pedidos_automaticamente,
  };
}

export async function setAceitarPedidosAutomaticamente(
  ativo: boolean
): Promise<PreferenciasOperacionais> {
  await requirePermission("config:write");
  const supabase = createServiceRoleClient();
  const row = await buscarLinhaConfig();

  if (!row?.id) {
    throw new Error("Configurações da loja não encontradas");
  }

  const { data, error } = await supabase
    .from("configuracoes_loja")
    .update({
      aceitar_pedidos_automaticamente: ativo,
      ...(!ativo ? { imprimir_aceitar_automaticamente: false } : {}),
    } as never)
    .eq("id", row.id)
    .select("id, aceitar_pedidos_automaticamente")
    .maybeSingle();

  if (error || !data) {
    console.error("Erro ao atualizar aceitar_pedidos_automaticamente:", error);
    throw new Error("Não foi possível atualizar o aceite automático");
  }

  const result = data as {
    id: number;
    aceitar_pedidos_automaticamente?: boolean | null;
  };

  return {
    id: result.id,
    aceitar_pedidos_automaticamente: Boolean(
      result.aceitar_pedidos_automaticamente
    ),
  };
}

/** Compat: API antiga */
export async function setAutoAcceptOrders(
  enabled: boolean
): Promise<StoreSettings> {
  const pref = await setAceitarPedidosAutomaticamente(enabled);
  return {
    id: pref.id,
    auto_accept_orders: pref.aceitar_pedidos_automaticamente,
    aceitar_pedidos_automaticamente: pref.aceitar_pedidos_automaticamente,
  };
}

/** Uso na criação de pedido (sem requireAdmin) */
export async function getAutoAcceptOrdersPublic(): Promise<boolean> {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("configuracoes_loja")
      .select("aceitar_pedidos_automaticamente")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      if (error) {
        console.error("getAutoAcceptOrdersPublic:", error.message);
      }
      return false;
    }

    return Boolean(
      (data as { aceitar_pedidos_automaticamente?: boolean | null })
        .aceitar_pedidos_automaticamente
    );
  } catch (e) {
    console.error("getAutoAcceptOrdersPublic falhou:", e);
    return false;
  }
}

export async function estaAceiteAutomaticoAtivo(): Promise<boolean> {
  return getAutoAcceptOrdersPublic();
}
