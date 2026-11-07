"use server";

import { requirePermission } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/integrations/supabase/client.server";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

function toId(id: string | number): number {
  const n = typeof id === "string" ? parseInt(id, 10) : id;
  if (!Number.isFinite(n)) throw new Error("ID inválido");
  return n;
}

async function getNextId(
  supabase: ServiceClient,
  table: "grupos_opcoes" | "opcoes"
) {
  const { data } = await supabase
    .from(table)
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (Number(data?.id) || 0) + 1;
}

export async function listGruposOpcoes() {
  await requirePermission("catalogo:read");
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("grupos_opcoes")
    .select("*")
    .order("nome", { ascending: true });
  if (error) throw new Error("Não foi possível listar categorias de adicionais");
  return data || [];
}

export async function createGrupoOpcoes(input: {
  nome: string;
  min_escolha?: number;
  max_escolha?: number;
  tag_id?: number | string | null;
}) {
  await requirePermission("catalogo:write");
  const supabase = createServiceRoleClient();
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome é obrigatório");

  const min = Math.max(0, Number(input.min_escolha ?? 0));
  let max = Math.max(1, Number(input.max_escolha ?? 1));
  if (max < min) max = min || 1;

  const id = await getNextId(supabase, "grupos_opcoes");
  const { data, error } = await supabase
    .from("grupos_opcoes")
    .insert({
      id,
      nome,
      min_escolha: min,
      max_escolha: max,
      tag_id:
        input.tag_id == null || input.tag_id === ""
          ? null
          : toId(input.tag_id),
    } as never)
    .select("*")
    .single();

  if (error || !data) {
    console.error(error);
    throw new Error("Não foi possível criar a categoria");
  }
  return data;
}

export async function updateGrupoOpcoes(
  id: string | number,
  updates: {
    nome?: string;
    min_escolha?: number;
    max_escolha?: number;
    tag_id?: number | string | null;
  }
) {
  await requirePermission("catalogo:write");
  const supabase = createServiceRoleClient();
  const payload: Record<string, unknown> = {};
  if (updates.nome !== undefined) payload.nome = updates.nome.trim();
  if (updates.min_escolha !== undefined)
    payload.min_escolha = Math.max(0, Number(updates.min_escolha));
  if (updates.max_escolha !== undefined)
    payload.max_escolha = Math.max(1, Number(updates.max_escolha));
  if (updates.tag_id !== undefined) {
    payload.tag_id =
      updates.tag_id === null || updates.tag_id === ""
        ? null
        : toId(updates.tag_id);
  }

  if (Object.keys(payload).length === 0) {
    throw new Error("Nenhum campo para atualizar");
  }

  const { data, error } = await supabase
    .from("grupos_opcoes")
    .update(payload as never)
    .eq("id", toId(id))
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error("Não foi possível atualizar");
  }
  return data;
}

export async function deleteGrupoOpcoes(id: string | number) {
  await requirePermission("catalogo:write");
  const supabase = createServiceRoleClient();
  const gid = toId(id);

  // Remove vínculos com produtos
  await supabase.from("produto_grupos").delete().eq("grupo_id", gid);
  // Remove opções do grupo
  await supabase.from("opcoes").delete().eq("grupo_id", gid);

  const { error } = await supabase.from("grupos_opcoes").delete().eq("id", gid);
  if (error) throw new Error("Não foi possível excluir");
  return { success: true };
}

/** Vincula / desvincula grupos de adicionais a um produto */
export async function setProdutoGrupos(
  produtoId: string | number,
  grupoIds: (string | number)[]
) {
  await requirePermission("catalogo:write");
  const supabase = createServiceRoleClient();
  const pid = toId(produtoId);
  const ids = grupoIds.map(toId);

  const { error: delError } = await supabase
    .from("produto_grupos")
    .delete()
    .eq("produto_id", pid);

  if (delError) {
    throw new Error("Não foi possível atualizar vínculos do produto");
  }

  if (ids.length === 0) return { success: true };

  const rows = ids.map((grupo_id, index) => ({
    produto_id: pid,
    grupo_id,
    ordem: index,
  }));

  const { error: insError } = await supabase
    .from("produto_grupos")
    .insert(rows as never);

  if (insError) {
    console.error(insError);
    throw new Error(insError.message || "Não foi possível vincular categorias");
  }

  return { success: true };
}

export async function getProdutoGrupoIds(produtoId: string | number) {
  await requirePermission("catalogo:read");
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("produto_grupos")
    .select("grupo_id, ordem")
    .eq("produto_id", toId(produtoId))
    .order("ordem", { ascending: true });

  if (error) throw new Error("Não foi possível carregar vínculos");
  return (data || []).map((r) => r.grupo_id);
}

export async function createOpcaoInGrupo(input: {
  nome: string;
  grupo_id: string | number;
  preco_adicional?: number;
  ordem?: number;
  tag_id?: number | string | null;
}) {
  await requirePermission("catalogo:write");
  const supabase = createServiceRoleClient();
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome é obrigatório");

  const id = await getNextId(supabase, "opcoes");
  const { data, error } = await supabase
    .from("opcoes")
    .insert({
      id,
      nome,
      grupo_id: toId(input.grupo_id),
      preco_adicional: Number(input.preco_adicional ?? 0),
      ordem: Number(input.ordem ?? 0),
      status: "ativo",
      esta_disponivel: true,
      tag_id:
        input.tag_id == null || input.tag_id === ""
          ? null
          : toId(input.tag_id),
    } as never)
    .select("*, grupo:grupos_opcoes(id, nome), tag:tags(*)")
    .single();

  if (error || !data) {
    console.error(error);
    throw new Error("Não foi possível criar o adicional");
  }
  return data;
}
