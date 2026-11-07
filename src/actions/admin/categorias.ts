"use server";

import { requirePermission } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/integrations/supabase/client.server";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

function toId(id: string | number): number {
  const n = typeof id === "string" ? parseInt(id, 10) : id;
  if (!Number.isFinite(n)) throw new Error("ID inválido");
  return n;
}

async function getNextId(supabase: ServiceClient, table: "categorias") {
  const { data } = await supabase
    .from(table)
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (Number(data?.id) || 0) + 1;
}

export async function listCategorias() {
  await requirePermission("catalogo:read");
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("categorias")
    .select("*")
    .order("ordem", { ascending: true });

  if (error) throw new Error("Não foi possível listar categorias");
  return data || [];
}

export async function createCategoria(input: {
  nome: string;
  ordem?: number;
}) {
  await requirePermission("catalogo:write");
  const supabase = createServiceRoleClient();
  const nome = input.nome.trim();
  if (!nome) throw new Error("Nome é obrigatório");

  const id = await getNextId(supabase, "categorias");

  let ordem = input.ordem;
  if (ordem == null) {
    const { data: last } = await supabase
      .from("categorias")
      .select("ordem")
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();
    ordem = (Number(last?.ordem) || 0) + 1;
  }

  const { data, error } = await supabase
    .from("categorias")
    .insert({
      id,
      nome,
      ordem,
    } as never)
    .select("*")
    .single();

  if (error || !data) {
    console.error(error);
    throw new Error("Não foi possível criar a categoria");
  }
  return data;
}

export async function updateCategoria(
  id: string | number,
  updates: { nome?: string; ordem?: number }
) {
  await requirePermission("catalogo:write");
  const supabase = createServiceRoleClient();
  const payload: Record<string, unknown> = {};
  if (updates.nome !== undefined) payload.nome = updates.nome.trim();
  if (updates.ordem !== undefined) payload.ordem = Number(updates.ordem);

  if (Object.keys(payload).length === 0) {
    throw new Error("Nenhum campo para atualizar");
  }

  const { data, error } = await supabase
    .from("categorias")
    .update(payload as never)
    .eq("id", toId(id))
    .select("*")
    .maybeSingle();

  if (error || !data) {
    throw new Error("Não foi possível atualizar a categoria");
  }
  return data;
}

export async function deleteCategoria(id: string | number) {
  await requirePermission("catalogo:write");
  const supabase = createServiceRoleClient();
  const catId = toId(id);

  // Produtos vinculados ficam sem categoria
  await supabase
    .from("produtos")
    .update({ categoria_id: null } as never)
    .eq("categoria_id", catId);

  const { error } = await supabase.from("categorias").delete().eq("id", catId);
  if (error) {
    throw new Error("Não foi possível excluir a categoria");
  }
  return { success: true };
}

export async function duplicateCategoria(id: string | number) {
  await requirePermission("catalogo:write");
  const supabase = createServiceRoleClient();
  const catId = toId(id);

  const { data: original } = await supabase
    .from("categorias")
    .select("*")
    .eq("id", catId)
    .maybeSingle();

  if (!original) throw new Error("Categoria não encontrada");

  return createCategoria({
    nome: `${original.nome} (cópia)`,
  });
}

export async function reorderCategorias(orderedIds: (string | number)[]) {
  await requirePermission("catalogo:write");
  const supabase = createServiceRoleClient();

  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("categorias")
        .update({ ordem: index + 1 } as never)
        .eq("id", toId(id))
    )
  );

  return { success: true };
}
