"use server";

import { requireAdmin, requirePermission } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/integrations/supabase/client.server";
import { parseDiasFuncionamento } from "@/types/configuracoes";

export type ConfiguracoesUpdate = {
  nome?: string;
  descricao?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  estado?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  horario_abertura?: string | null;
  horario_fechamento?: string | null;
  dias_funcionamento?: string | string[] | null;
  taxa_entrega?: number | null;
  pedido_minimo?: number | null;
  tempo_entrega_min?: number | null;
  tempo_entrega_max?: number | null;
  esta_aberto?: boolean;
  aceitar_pedidos_automaticamente?: boolean;
  aceitando_pedidos?: boolean;
};

function toNumericId(id: string | number): number {
  const n = typeof id === "string" ? parseInt(id, 10) : id;
  if (!Number.isFinite(n)) {
    throw new Error("ID de configuração inválido");
  }
  return n;
}

function serializeDiasFuncionamento(
  value: string | string[] | null | undefined
): string | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const cleaned = value.map((d) => String(d).trim()).filter(Boolean);
    return cleaned.length ? cleaned.join(",") : null;
  }
  const dias = parseDiasFuncionamento(value);
  return dias.length ? dias.join(",") : null;
}

function sanitizeUpdates(updates: ConfiguracoesUpdate) {
  const payload: Record<string, unknown> = {};

  const stringFields = [
    "nome",
    "descricao",
    "logo_url",
    "banner_url",
    "endereco",
    "cidade",
    "estado",
    "telefone",
    "whatsapp",
    "instagram",
    "facebook",
    "horario_abertura",
    "horario_fechamento",
  ] as const;

  for (const key of stringFields) {
    if (updates[key] !== undefined) {
      payload[key] = updates[key];
    }
  }

  if (updates.dias_funcionamento !== undefined) {
    payload.dias_funcionamento = serializeDiasFuncionamento(
      updates.dias_funcionamento
    );
  }

  if (updates.taxa_entrega !== undefined) {
    payload.taxa_entrega =
      updates.taxa_entrega === null ? null : Number(updates.taxa_entrega);
  }
  if (updates.pedido_minimo !== undefined) {
    payload.pedido_minimo =
      updates.pedido_minimo === null ? null : Number(updates.pedido_minimo);
  }
  if (updates.tempo_entrega_min !== undefined) {
    payload.tempo_entrega_min =
      updates.tempo_entrega_min === null
        ? null
        : Number(updates.tempo_entrega_min);
  }
  if (updates.tempo_entrega_max !== undefined) {
    payload.tempo_entrega_max =
      updates.tempo_entrega_max === null
        ? null
        : Number(updates.tempo_entrega_max);
  }
  if (updates.esta_aberto !== undefined) {
    payload.esta_aberto = Boolean(updates.esta_aberto);
  }
  if (updates.aceitar_pedidos_automaticamente !== undefined) {
    payload.aceitar_pedidos_automaticamente = Boolean(
      updates.aceitar_pedidos_automaticamente
    );
  }
  if (updates.aceitando_pedidos !== undefined) {
    payload.aceitando_pedidos = Boolean(updates.aceitando_pedidos);
  }

  return payload;
}

/**
 * Abre ou fecha a loja rapidamente (sidebar).
 * Atualiza `esta_aberto` (sempre). Se a coluna existir, também `aceitando_pedidos`.
 */
export async function setLojaAberta(aberta: boolean) {
  // Só admin (config:write) — atendente/gerente não abrem/fecham a loja
  await requirePermission("config:write");
  const supabase = createServiceRoleClient();

  const { data: current, error: fetchError } = await supabase
    .from("configuracoes_loja")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (fetchError || !current) {
    console.error("setLojaAberta: fetch falhou", fetchError);
    throw new Error("Configurações da loja não encontradas");
  }

  const configId = current.id;

  // 1) Atualização mínima — só campos que já existem no banco
  const { data, error } = await supabase
    .from("configuracoes_loja")
    .update({ esta_aberto: aberta } as never)
    .eq("id", configId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("setLojaAberta: update esta_aberto falhou", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
      configId,
      aberta,
    });
    throw new Error(
      error.message || "Não foi possível atualizar o status da loja"
    );
  }

  if (!data) {
    console.error("setLojaAberta: update sem retorno", { configId, aberta });
    throw new Error("Configuração não encontrada ou não atualizada");
  }

  // 2) Opcional: alinhar aceitando_pedidos (ignora se a coluna ainda não existe)
  const { error: aceitandoError } = await supabase
    .from("configuracoes_loja")
    .update({ aceitando_pedidos: aberta } as never)
    .eq("id", configId);

  if (aceitandoError) {
    // Coluna ausente ou RLS — não bloqueia abrir/fechar
    console.warn(
      "setLojaAberta: não foi possível atualizar aceitando_pedidos (migration 0006?)",
      aceitandoError.message
    );
  }

  return data;
}

export async function getConfiguracoesLoja() {
  await requireAdmin();
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("configuracoes_loja")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar configurações da loja:", error);
    return null;
  }

  return data;
}

export async function ensureConfiguracoesLoja() {
  await requirePermission("config:write");
  const supabase = createServiceRoleClient();

  const existing = await getConfiguracoesLoja();
  if (existing) return existing;

  const { data, error } = await supabase
    .from("configuracoes_loja")
    .insert({
      nome: "Sorvetes Donda",
      descricao: "Seguindo a tradição desde 1953!",
      esta_aberto: true,
      taxa_entrega: 5.0,
      pedido_minimo: 20.0,
      tempo_entrega_min: 30,
      tempo_entrega_max: 45,
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar configurações:", error);
    throw new Error("Não foi possível criar as configurações da loja");
  }

  return data;
}

export async function updateConfiguracoesLoja(
  id: string | number,
  updates: ConfiguracoesUpdate
) {
  await requirePermission("config:write");
  const supabase = createServiceRoleClient();
  const configId = toNumericId(id);
  const payload = sanitizeUpdates(updates);

  if (Object.keys(payload).length === 0) {
    throw new Error("Nenhum campo para atualizar");
  }

  const { data, error } = await supabase
    .from("configuracoes_loja")
    .update(payload as never)
    .eq("id", configId)
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("Erro ao atualizar configurações da loja:", error);
    throw new Error("Não foi possível atualizar as configurações da loja");
  }

  if (!data) {
    throw new Error("Configuração não encontrada ou não atualizada");
  }

  return data;
}
