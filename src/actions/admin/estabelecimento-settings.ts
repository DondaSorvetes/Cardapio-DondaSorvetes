"use server";

/**
 * Preferências operacionais do estabelecimento.
 * Persistidas em `configuracoes_loja` (colunas da migration 0010).
 * Campos ausentes no banco são ignorados com fallback seguro.
 */

import { requireAdmin, requirePermission } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/integrations/supabase/client.server";
import {
  DEFAULT_PREFERENCIAS_ESTABELECIMENTO,
  normalizePreferenciasEstabelecimento,
  type PreferenciasEstabelecimento,
  type PreferenciasEstabelecimentoUpdate,
  type SomAlertaTipo,
} from "@/types/estabelecimento-settings";

const SELECT_COLS =
  "id, aceitar_pedidos_automaticamente, finalizar_pedidos_apos_24h, finalizar_agendados_apos_3_dias, imprimir_aceitar_automaticamente, notificar_novos_pedidos, som_alerta_ativo, som_alerta_tipo, som_alerta_volume, proximo_numero_pedido" as const;

/** Colunas mínimas que já existem há mais tempo */
const SELECT_MINIMAL = "id, aceitar_pedidos_automaticamente" as const;

async function buscarLinha(): Promise<Record<string, unknown> | null> {
  const supabase = createServiceRoleClient();

  const full = await supabase
    .from("configuracoes_loja")
    .select(SELECT_COLS)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!full.error && full.data) {
    return full.data as unknown as Record<string, unknown>;
  }

  // Migration ainda não aplicada — tenta só colunas legadas
  if (full.error) {
    console.warn(
      "estabelecimento-settings: select completo falhou, tentando mínimo:",
      full.error.message
    );
  }

  const minimal = await supabase
    .from("configuracoes_loja")
    .select(SELECT_MINIMAL)
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (minimal.error || !minimal.data) {
    if (minimal.error) {
      console.error("estabelecimento-settings: fetch falhou", minimal.error);
    }
    return null;
  }

  return minimal.data as unknown as Record<string, unknown>;
}

export async function getPreferenciasEstabelecimento(): Promise<PreferenciasEstabelecimento> {
  await requireAdmin();
  const row = await buscarLinha();
  if (!row) return { ...DEFAULT_PREFERENCIAS_ESTABELECIMENTO };
  return normalizePreferenciasEstabelecimento(row);
}

function sanitizeUpdate(
  updates: PreferenciasEstabelecimentoUpdate
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (updates.finalizar_pedidos_apos_24h !== undefined) {
    payload.finalizar_pedidos_apos_24h = Boolean(
      updates.finalizar_pedidos_apos_24h
    );
  }
  if (updates.finalizar_agendados_apos_3_dias !== undefined) {
    payload.finalizar_agendados_apos_3_dias = Boolean(
      updates.finalizar_agendados_apos_3_dias
    );
  }
  if (updates.imprimir_aceitar_automaticamente !== undefined) {
    payload.imprimir_aceitar_automaticamente = Boolean(
      updates.imprimir_aceitar_automaticamente
    );
    // Mantém sincronizado com a flag legada usada no fluxo de pedidos
    if (updates.imprimir_aceitar_automaticamente) payload.aceitar_pedidos_automaticamente = true;
  }
  if (updates.aceitar_pedidos_automaticamente !== undefined) {
    payload.aceitar_pedidos_automaticamente = Boolean(
      updates.aceitar_pedidos_automaticamente
    );
  }
  if (updates.notificar_novos_pedidos !== undefined) {
    payload.notificar_novos_pedidos = Boolean(updates.notificar_novos_pedidos);
  }
  if (updates.som_alerta_ativo !== undefined) {
    payload.som_alerta_ativo = Boolean(updates.som_alerta_ativo);
  }
  if (updates.som_alerta_tipo !== undefined) {
    const t = updates.som_alerta_tipo as SomAlertaTipo;
    payload.som_alerta_tipo =
      t === "suave" || t === "urgente" || t === "classico" ? t : "classico";
  }
  if (updates.som_alerta_volume !== undefined) {
    const v = Number(updates.som_alerta_volume);
    payload.som_alerta_volume = Number.isFinite(v)
      ? Math.min(100, Math.max(0, Math.round(v)))
      : 70;
  }
  if (updates.proximo_numero_pedido !== undefined) {
    const n = Number(updates.proximo_numero_pedido);
    payload.proximo_numero_pedido = Number.isFinite(n)
      ? Math.max(1, Math.floor(n))
      : 1;
  }

  return payload;
}

/**
 * Atualiza preferências. Tenta gravar todos os campos; se a migration
 * ainda não existir, grava apenas colunas legadas e devolve estado mesclado.
 */
export async function updatePreferenciasEstabelecimento(
  updates: PreferenciasEstabelecimentoUpdate
): Promise<PreferenciasEstabelecimento> {
  await requirePermission("config:write");
  const supabase = createServiceRoleClient();
  const row = await buscarLinha();

  if (!row?.id) {
    throw new Error("Configurações da loja não encontradas");
  }

  const id = Number(row.id);
  const payload = sanitizeUpdate(updates);

  if (Object.keys(payload).length === 0) {
    return normalizePreferenciasEstabelecimento(row);
  }

  const { data, error } = await supabase
    .from("configuracoes_loja")
    .update(payload as never)
    .eq("id", id)
    .select(SELECT_COLS)
    .maybeSingle();

  if (!error && data) {
    return normalizePreferenciasEstabelecimento(
      data as unknown as Record<string, unknown>
    );
  }

  if (updates.imprimir_aceitar_automaticamente !== undefined) {
    throw new Error("Não foi possível salvar a impressão automática. Confira se a migração 0010 está aplicada no banco.");
  }

  // Fallback: só campos legados (aceitar automático / numeração se existir)
  if (error) {
    console.warn(
      "updatePreferenciasEstabelecimento: update completo falhou, tentando parcial:",
      error.message
    );
  }

  const legacyPayload: Record<string, unknown> = {};
  if (payload.aceitar_pedidos_automaticamente !== undefined) {
    legacyPayload.aceitar_pedidos_automaticamente =
      payload.aceitar_pedidos_automaticamente;
  }

  if (Object.keys(legacyPayload).length > 0) {
    const { data: legacyData, error: legacyError } = await supabase
      .from("configuracoes_loja")
      .update(legacyPayload as never)
      .eq("id", id)
      .select(SELECT_MINIMAL)
      .maybeSingle();

    if (legacyError) {
      console.error("updatePreferenciasEstabelecimento legacy:", legacyError);
      throw new Error("Não foi possível salvar as preferências");
    }

    // Mescla: o que salvamos no banco + o que o usuário pediu (UI otimista)
    return normalizePreferenciasEstabelecimento({
      ...row,
      ...(legacyData as Record<string, unknown>),
      ...updates,
      id,
    });
  }

  // Sem coluna legada para gravar — ainda assim reflete na UI (estado mesclado)
  // e avisa no log que a migration 0010 precisa ser aplicada para persistência total
  console.warn(
    "updatePreferenciasEstabelecimento: migration 0010 pode não estar aplicada; " +
      "preferências extras não persistidas no banco."
  );

  return normalizePreferenciasEstabelecimento({
    ...row,
    ...updates,
    id,
  });
}

/** Reinicia a contagem de pedidos para 1 (ou valor informado). */
export async function reiniciarNumeracaoPedidos(
  valor = 1
): Promise<PreferenciasEstabelecimento> {
  const n = Number.isFinite(valor) ? Math.max(1, Math.floor(valor)) : 1;
  return updatePreferenciasEstabelecimento({ proximo_numero_pedido: n });
}
