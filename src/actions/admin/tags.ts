"use server";

import { requirePermission } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/integrations/supabase/client.server";

export type TagRow = {
  id: number;
  nome: string;
  cor_fundo: string;
  cor_texto: string | null;
  /** Carrossel do topo do cardápio (no máximo uma tag). */
  destaque_cardapio?: boolean;
  /** Chave do ícone (TAG_ICONES); null = automático pelo nome. */
  icone?: string | null;
};

const ICONE_RE = /^[a-z_]{1,32}$/;
function sanitizeIcone(icone: string | null | undefined) {
  return icone && ICONE_RE.test(icone) ? icone : null;
}

/** Erro de coluna inexistente (migration 0021 ainda não aplicada). */
function semColunaIcone(error: { message?: string } | null) {
  return Boolean(error?.message?.includes("icone"));
}

function toId(id: string | number): number {
  const n = typeof id === "string" ? parseInt(id, 10) : id;
  if (!Number.isFinite(n)) throw new Error("ID de tag inválido");
  return n;
}

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

async function getNextTagId(supabase: ServiceClient): Promise<number> {
  const { data } = await supabase
    .from("tags")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (Number(data?.id) || 0) + 1;
}

export async function listTags(): Promise<TagRow[]> {
  await requirePermission("catalogo:read");
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("tags")
    // "*" funciona antes e depois da migration 0021 (destaque_cardapio).
    .select("*")
    .order("nome", { ascending: true });

  if (error) {
    console.error("listTags", error);
    throw new Error("Não foi possível listar tags");
  }
  return (data || []) as TagRow[];
}

export async function createTag(input: {
  nome: string;
  cor_fundo?: string;
  cor_texto?: string | null;
  icone?: string | null;
}): Promise<TagRow> {
  await requirePermission("catalogo:write");
  const supabase = createServiceRoleClient();
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome da tag é obrigatório");

  // evita duplicata por nome (case-insensitive)
  const { data: existing } = await supabase
    .from("tags")
    .select("*")
    .ilike("nome", nome)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return existing as TagRow;
  }

  const id = await getNextTagId(supabase);
  const row = {
    id,
    nome,
    cor_fundo: input.cor_fundo?.trim() || "#FDF0F4",
    cor_texto: input.cor_texto?.trim() || "#C8285F",
  };
  const icone = sanitizeIcone(input.icone);
  let { data, error } = await supabase
    .from("tags")
    .insert((icone ? { ...row, icone } : row) as never)
    .select("*")
    .single();
  // Antes da migration 0021 a coluna "icone" não existe: salva sem ela.
  if (icone && semColunaIcone(error)) {
    ({ data, error } = await supabase
      .from("tags")
      .insert(row as never)
      .select("*")
      .single());
  }

  if (error || !data) {
    console.error("createTag", error);
    throw new Error("Não foi possível criar a tag");
  }
  return data as TagRow;
}

export async function updateTag(
  id: string | number,
  updates: {
    nome?: string;
    cor_fundo?: string;
    cor_texto?: string | null;
    icone?: string | null;
  }
): Promise<TagRow> {
  await requirePermission("catalogo:write");
  const supabase = createServiceRoleClient();
  const payload: Record<string, unknown> = {};
  if (updates.nome !== undefined) payload.nome = updates.nome.trim();
  if (updates.cor_fundo !== undefined) payload.cor_fundo = updates.cor_fundo;
  if (updates.cor_texto !== undefined) payload.cor_texto = updates.cor_texto;
  if (updates.icone !== undefined) payload.icone = sanitizeIcone(updates.icone);

  if (Object.keys(payload).length === 0) {
    throw new Error("Nenhum campo para atualizar");
  }

  const { data, error } = await supabase
    .from("tags")
    .update(payload as never)
    .eq("id", toId(id))
    .select("*")
    .maybeSingle();

  if (semColunaIcone(error)) {
    throw new Error("Aplique a migration 0021 para escolher o ícone da tag");
  }
  if (error || !data) {
    throw new Error("Não foi possível atualizar a tag");
  }
  return data as TagRow;
}

export async function deleteTag(id: string | number) {
  await requirePermission("catalogo:write");
  const supabase = createServiceRoleClient();
  const tagId = toId(id);

  // desvincula produtos
  await supabase
    .from("produtos")
    .update({ tag_id: null } as never)
    .eq("tag_id", tagId);

  const { error } = await supabase.from("tags").delete().eq("id", tagId);
  if (error) {
    throw new Error("Não foi possível excluir a tag");
  }
  return { success: true };
}

/**
 * Escolhe a tag que vira o carrossel do topo do cardápio. Só uma por vez:
 * desmarca as demais antes de marcar a nova. `null` remove o destaque.
 */
export async function setTagDestaque(id: string | number | null) {
  await requirePermission("catalogo:write");
  const supabase = createServiceRoleClient();
  const tagId = id == null ? null : toId(id);

  const clear = await supabase
    .from("tags")
    .update({ destaque_cardapio: false } as never)
    .eq("destaque_cardapio", true);
  if (clear.error) {
    console.error("setTagDestaque", clear.error);
    throw new Error(
      "Não foi possível alterar o destaque. A migration 0021 já foi aplicada?",
    );
  }
  if (tagId == null) return { success: true };

  const { error } = await supabase
    .from("tags")
    .update({ destaque_cardapio: true } as never)
    .eq("id", tagId);
  if (error) {
    console.error("setTagDestaque", error);
    throw new Error("Não foi possível marcar o destaque");
  }
  return { success: true };
}
