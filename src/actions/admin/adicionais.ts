"use server";

import { requirePermission } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/integrations/supabase/client.server";

export type OpcaoUpdate = {
  nome?: string;
  preco_adicional?: number;
  grupo_id?: number | string;
  status?: "ativo" | "inativo" | string;
  esta_disponivel?: boolean;
  ordem?: number;
  tag_id?: number | string | null;
};

function toId(id: string | number): number {
  const n = typeof id === "string" ? parseInt(id, 10) : id;
  if (!Number.isFinite(n)) {
    throw new Error("ID de adicional inválido");
  }
  return n;
}

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

/**
 * Próximo ID numérico livre.
 * Necessário quando a sequence do Postgres ficou atrás dos IDs inseridos
 * manualmente (erro: duplicate key ... pkey).
 */
async function getNextNumericId(
  supabase: ServiceClient,
  table: "grupos_opcoes" | "opcoes"
): Promise<number> {
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`getNextNumericId(${table})`, error);
    throw new Error(`Não foi possível gerar ID para ${table}`);
  }

  const max = Number((data as { id?: number } | null)?.id ?? 0);
  return (Number.isFinite(max) ? max : 0) + 1;
}

function sanitizeOpcaoUpdate(updates: OpcaoUpdate) {
  const payload: Record<string, unknown> = {};

  if (updates.nome !== undefined) payload.nome = updates.nome;
  if (updates.preco_adicional !== undefined) {
    payload.preco_adicional = updates.preco_adicional;
  }
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.esta_disponivel !== undefined) {
    payload.esta_disponivel = updates.esta_disponivel;
  }
  if (updates.ordem !== undefined) payload.ordem = updates.ordem;

  if (updates.grupo_id !== undefined) {
    payload.grupo_id = toId(updates.grupo_id);
  }

  if (updates.tag_id !== undefined) {
    payload.tag_id =
      updates.tag_id === null || updates.tag_id === ""
        ? null
        : toId(updates.tag_id);
  }

  return payload;
}

export async function updateOpcao(id: string | number, updates: OpcaoUpdate) {
  await requirePermission("catalogo:write");
  const supabase = createServiceRoleClient();
  const opcaoId = toId(id);
  const payload = sanitizeOpcaoUpdate(updates);

  if (Object.keys(payload).length === 0) {
    throw new Error("Nenhum campo para atualizar");
  }

  const { data, error } = await supabase
    .from("opcoes")
    .update(payload as never)
    .eq("id", opcaoId)
    .select(
      `
      *,
      grupo:grupos_opcoes(id, nome),
      tag:tags(*)
    `
    )
    .maybeSingle();

  if (error) {
    console.error("Erro ao atualizar adicional:", error);
    throw new Error("Não foi possível atualizar o adicional");
  }

  if (!data) {
    throw new Error("Adicional não encontrado ou não atualizado");
  }

  return data;
}

export async function deleteOpcao(id: string | number) {
  await requirePermission("catalogo:write");
  const supabase = createServiceRoleClient();
  const opcaoId = toId(id);

  const { error } = await supabase.from("opcoes").delete().eq("id", opcaoId);

  if (error) {
    console.error("Erro ao excluir adicional:", error);
    throw new Error("Não foi possível excluir o adicional");
  }

  return { success: true, mode: "deleted" as const };
}

/**
 * Remove um adicional apenas do produto informado.
 * - Se o grupo for exclusivo desse produto → exclui a opção de verdade.
 * - Se o grupo for compartilhado → cria um grupo próprio para o produto
 *   (cópia sem essa opção) e mantém o original nos demais produtos.
 */
export async function removeOpcaoDoProduto(
  opcaoId: string | number,
  produtoId: string | number
) {
  await requirePermission("catalogo:write");
  const supabase = createServiceRoleClient();
  const oid = toId(opcaoId);
  const pid = toId(produtoId);

  const { data: opcao, error: opcaoError } = await supabase
    .from("opcoes")
    .select("id, grupo_id, nome, preco_adicional, status, esta_disponivel, ordem, tag_id")
    .eq("id", oid)
    .maybeSingle();

  if (opcaoError || !opcao) {
    throw new Error("Adicional não encontrado");
  }

  const grupoId = opcao.grupo_id;
  if (grupoId == null) {
    // Sem grupo: só apaga a opção
    await deleteOpcao(oid);
    return { success: true, mode: "deleted" as const };
  }

  // Produtos que usam este grupo
  const { data: links, error: linksError } = await supabase
    .from("produto_grupos")
    .select("produto_id, ordem")
    .eq("grupo_id", grupoId);

  if (linksError) {
    console.error(linksError);
    throw new Error("Não foi possível verificar vínculos do grupo");
  }

  const productLinks = links || [];
  const usedByThis = productLinks.some((l) => Number(l.produto_id) === pid);
  if (!usedByThis) {
    throw new Error("Este adicional não está vinculado ao produto selecionado");
  }

  // Grupo só deste produto (ou só um produto no total) → exclui a opção
  if (productLinks.length <= 1) {
    await deleteOpcao(oid);
    return { success: true, mode: "deleted" as const };
  }

  // Grupo compartilhado → forkar grupo só para este produto, sem a opção removida
  const { data: grupo, error: grupoError } = await supabase
    .from("grupos_opcoes")
    .select("*")
    .eq("id", grupoId)
    .maybeSingle();

  if (grupoError || !grupo) {
    console.error("removeOpcaoDoProduto: grupo", grupoError);
    throw new Error("Grupo de opções não encontrado");
  }

  const { data: todasOpcoes, error: allOptsError } = await supabase
    .from("opcoes")
    .select("*")
    .eq("grupo_id", grupoId)
    .order("ordem", { ascending: true });

  if (allOptsError) {
    console.error("removeOpcaoDoProduto: opções", allOptsError);
    throw new Error("Não foi possível listar opções do grupo");
  }

  const opcoesRestantes = (todasOpcoes || []).filter(
    (o) => Number(o.id) !== oid
  );

  // max_escolha é NOT NULL no schema — nunca enviar null/undefined
  const minEscolha =
    grupo.min_escolha == null ? 0 : Number(grupo.min_escolha);
  let maxEscolha =
    grupo.max_escolha == null ? 1 : Number(grupo.max_escolha);
  if (!Number.isFinite(maxEscolha) || maxEscolha < 1) maxEscolha = 1;
  if (maxEscolha < minEscolha) maxEscolha = minEscolha || 1;

  // Sequence do Postgres costuma estar desatualizada após seeds/imports.
  // Inserimos com id explícito (MAX+1) para evitar "duplicate key ... pkey".
  const nextGrupoId = await getNextNumericId(supabase, "grupos_opcoes");

  const grupoInsert: Record<string, unknown> = {
    id: nextGrupoId,
    nome: String(grupo.nome || "Grupo de opções").trim() || "Grupo de opções",
    min_escolha: Number.isFinite(minEscolha) ? minEscolha : 0,
    max_escolha: maxEscolha,
  };

  // tag_id só se for número válido (evita FK inválida)
  if (grupo.tag_id != null && Number.isFinite(Number(grupo.tag_id))) {
    grupoInsert.tag_id = Number(grupo.tag_id);
  }

  let novoGrupo: { id: number } | null = null;
  {
    const { data, error: novoGrupoError } = await supabase
      .from("grupos_opcoes")
      .insert(grupoInsert as never)
      .select("id")
      .single();

    if (novoGrupoError || !data) {
      // Retry uma vez com MAX atualizado (corrida rara)
      const retryId = await getNextNumericId(supabase, "grupos_opcoes");
      const retryPayload = { ...grupoInsert, id: retryId };
      const retry = await supabase
        .from("grupos_opcoes")
        .insert(retryPayload as never)
        .select("id")
        .single();

      if (retry.error || !retry.data) {
        console.error("removeOpcaoDoProduto: insert grupo", {
          error: novoGrupoError,
          retryError: retry.error,
          payload: grupoInsert,
          retryPayload,
        });
        throw new Error(
          (retry.error || novoGrupoError)?.message
            ? `Não foi possível isolar o grupo: ${(retry.error || novoGrupoError)!.message}`
            : "Não foi possível isolar o grupo para este produto"
        );
      }
      novoGrupo = retry.data as { id: number };
    } else {
      novoGrupo = data as { id: number };
    }
  }

  if (opcoesRestantes.length > 0) {
    let nextOpcaoId = await getNextNumericId(supabase, "opcoes");

    const optsPayload = opcoesRestantes.map((o) => {
      const row: Record<string, unknown> = {
        id: nextOpcaoId++,
        nome: String(o.nome || "Opção"),
        preco_adicional: Number(o.preco_adicional ?? 0),
        status: o.status ?? "ativo",
        esta_disponivel:
          o.esta_disponivel === undefined || o.esta_disponivel === null
            ? true
            : Boolean(o.esta_disponivel),
        ordem: Number(o.ordem ?? 0),
        grupo_id: novoGrupo!.id,
      };
      if (o.tag_id != null && Number.isFinite(Number(o.tag_id))) {
        row.tag_id = Number(o.tag_id);
      }
      return row;
    });

    const { error: insertOptsError } = await supabase
      .from("opcoes")
      .insert(optsPayload as never);

    if (insertOptsError) {
      await supabase.from("grupos_opcoes").delete().eq("id", novoGrupo.id);
      console.error("removeOpcaoDoProduto: insert opções", insertOptsError);
      throw new Error(
        insertOptsError.message
          ? `Não foi possível copiar as opções: ${insertOptsError.message}`
          : "Não foi possível copiar as opções do grupo"
      );
    }
  }

  const linkAtual = productLinks.find((l) => Number(l.produto_id) === pid);
  const ordem = linkAtual?.ordem == null ? 0 : Number(linkAtual.ordem);

  const { error: unlinkError } = await supabase
    .from("produto_grupos")
    .delete()
    .eq("produto_id", pid)
    .eq("grupo_id", grupoId);

  if (unlinkError) {
    await supabase.from("opcoes").delete().eq("grupo_id", novoGrupo.id);
    await supabase.from("grupos_opcoes").delete().eq("id", novoGrupo.id);
    console.error("removeOpcaoDoProduto: unlink", unlinkError);
    throw new Error(
      unlinkError.message ||
        "Não foi possível desvincular o grupo do produto"
    );
  }

  const { error: linkError } = await supabase.from("produto_grupos").insert({
    produto_id: pid,
    grupo_id: novoGrupo.id,
    ordem,
  } as never);

  if (linkError) {
    console.error("removeOpcaoDoProduto: link", linkError);
    // restaura vínculo antigo e limpa fork
    await supabase.from("produto_grupos").insert({
      produto_id: pid,
      grupo_id: grupoId,
      ordem,
    } as never);
    await supabase.from("opcoes").delete().eq("grupo_id", novoGrupo.id);
    await supabase.from("grupos_opcoes").delete().eq("id", novoGrupo.id);
    throw new Error(
      linkError.message ||
        "Não foi possível vincular o novo grupo ao produto"
    );
  }

  return {
    success: true,
    mode: "isolated" as const,
    message:
      "Adicional removido apenas deste produto. Os demais produtos mantêm o item.",
  };
}
