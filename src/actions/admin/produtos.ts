"use server";

import { requirePermission } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/integrations/supabase/client.server";

export type ProdutoUpdate = {
  nome?: string;
  descricao?: string | null;
  preco_base?: number;
  preco_promocional?: number | null;
  categoria_id?: number | string | null;
  esta_disponivel?: boolean;
  pergunta_colher?: boolean;
  ordem?: number;
  imagem_url?: string | null;
  tag_id?: number | string | null;
};

export type ProdutoCreate = {
  nome: string;
  descricao?: string | null;
  preco_base: number;
  preco_promocional?: number | null;
  categoria_id?: number | string | null;
  esta_disponivel?: boolean;
  pergunta_colher?: boolean;
  ordem?: number;
  imagem_url?: string | null;
  tag_id?: number | string | null;
};

const PRODUTO_SELECT = `
  *,
  categoria:categorias(id, nome),
  tag:tags(*)
`;

function toId(id: string | number): number {
  const n = typeof id === "string" ? parseInt(id, 10) : id;
  if (!Number.isFinite(n)) {
    throw new Error("ID de produto inválido");
  }
  return n;
}

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

async function getNextProdutoId(supabase: ServiceClient): Promise<number> {
  const { data } = await supabase
    .from("produtos")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (Number(data?.id) || 0) + 1;
}

function sanitizeProdutoUpdate(updates: ProdutoUpdate) {
  const payload: Record<string, unknown> = {};

  if (updates.nome !== undefined) payload.nome = updates.nome.trim();
  if (updates.descricao !== undefined) payload.descricao = updates.descricao;
  if (updates.preco_base !== undefined) {
    payload.preco_base = Number(updates.preco_base);
  }
  if (updates.preco_promocional !== undefined) {
    if (
      updates.preco_promocional === null ||
      updates.preco_promocional === ("" as unknown as number)
    ) {
      payload.preco_promocional = null;
    } else {
      const n = Number(updates.preco_promocional);
      payload.preco_promocional =
        Number.isFinite(n) && n > 0 ? n : null;
    }
  }
  if (updates.esta_disponivel !== undefined) {
    payload.esta_disponivel = Boolean(updates.esta_disponivel);
  }
  if (updates.pergunta_colher !== undefined) {
    payload.pergunta_colher = Boolean(updates.pergunta_colher);
  }
  if (updates.ordem !== undefined) payload.ordem = Number(updates.ordem);
  if (updates.imagem_url !== undefined) payload.imagem_url = updates.imagem_url;

  if (updates.categoria_id !== undefined) {
    payload.categoria_id =
      updates.categoria_id === null || updates.categoria_id === ""
        ? null
        : toId(updates.categoria_id);
  }

  if (updates.tag_id !== undefined) {
    payload.tag_id =
      updates.tag_id === null || updates.tag_id === ""
        ? null
        : toId(updates.tag_id);
  }

  return payload;
}

export async function listProdutosAdmin(limit = 500) {
  await requirePermission("catalogo:read");
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("produtos")
    .select(PRODUTO_SELECT)
    .order("ordem", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("listProdutosAdmin", error);
    throw new Error("Não foi possível listar produtos");
  }
  return data || [];
}

export async function createProduto(input: ProdutoCreate) {
  await requirePermission("catalogo:write");
  const supabase = createServiceRoleClient();

  const nome = input.nome?.trim();
  if (!nome) throw new Error("Nome é obrigatório");
  if (!Number.isFinite(Number(input.preco_base)) || Number(input.preco_base) < 0) {
    throw new Error("Preço inválido");
  }

  let precoPromo: number | null = null;
  if (
    input.preco_promocional != null &&
    input.preco_promocional !== ("" as unknown as number)
  ) {
    const n = Number(input.preco_promocional);
    if (Number.isFinite(n) && n > 0) {
      if (n >= Number(input.preco_base)) {
        throw new Error(
          "Preço promocional deve ser menor que o preço base"
        );
      }
      precoPromo = n;
    }
  }

  const id = await getNextProdutoId(supabase);

  // ordem no fim da categoria
  let ordem = input.ordem;
  if (ordem == null) {
    const catId =
      input.categoria_id != null && input.categoria_id !== ""
        ? toId(input.categoria_id)
        : null;
    let q = supabase
      .from("produtos")
      .select("ordem")
      .order("ordem", { ascending: false })
      .limit(1);
    if (catId != null) q = q.eq("categoria_id", catId);
    const { data: last } = await q.maybeSingle();
    ordem = (Number(last?.ordem) || 0) + 1;
  }

  const { data, error } = await supabase
    .from("produtos")
    .insert({
      id,
      nome,
      descricao: input.descricao?.trim() || null,
      preco_base: Number(input.preco_base),
      preco_promocional: precoPromo,
      categoria_id:
        input.categoria_id == null || input.categoria_id === ""
          ? null
          : toId(input.categoria_id),
      esta_disponivel: input.esta_disponivel ?? true,
      pergunta_colher: input.pergunta_colher ?? true,
      ordem,
      imagem_url: input.imagem_url || null,
      tag_id:
        input.tag_id == null || input.tag_id === ""
          ? null
          : toId(input.tag_id),
    } as never)
    .select(PRODUTO_SELECT)
    .single();

  if (error || !data) {
    console.error("createProduto", error);
    throw new Error("Não foi possível criar o produto");
  }
  return data;
}

export async function updateProduto(
  id: string | number,
  updates: ProdutoUpdate
) {
  await requirePermission("catalogo:write");
  const supabase = createServiceRoleClient();
  const produtoId = toId(id);
  const payload = sanitizeProdutoUpdate(updates);

  if (Object.keys(payload).length === 0) {
    throw new Error("Nenhum campo para atualizar");
  }

  // Se está atualizando a imagem, remove a antiga do storage (se existir)
  if (
    updates.imagem_url !== undefined &&
    updates.imagem_url !== null &&
    updates.imagem_url !== ""
  ) {
    const { data: oldProduto } = await supabase
      .from("produtos")
      .select("imagem_url")
      .eq("id", produtoId)
      .maybeSingle();

    if (
      oldProduto?.imagem_url &&
      oldProduto.imagem_url !== updates.imagem_url &&
      oldProduto.imagem_url.startsWith("Produtos/")
    ) {
      // Remove a imagem antiga do storage de forma assíncrona (não bloqueia a atualização)
      void (async () => {
        try {
          await supabase.storage
            .from("DondaSorvetes")
            .remove([oldProduto.imagem_url!]);
        } catch (err) {
          console.error("Erro ao remover imagem antiga:", err);
        }
      })();
    }
  }

  const { data, error } = await supabase
    .from("produtos")
    .update(payload as never)
    .eq("id", produtoId)
    .select(PRODUTO_SELECT)
    .maybeSingle();

  if (error) {
    console.error("Erro ao atualizar produto:", error);
    throw new Error("Não foi possível atualizar o produto");
  }

  if (!data) {
    throw new Error("Produto não encontrado ou não atualizado");
  }

  return data;
}

export async function deleteProduto(id: string | number) {
  await requirePermission("catalogo:write");
  const supabase = createServiceRoleClient();
  const produtoId = toId(id);

  // Busca a imagem antes de deletar
  const { data: produto } = await supabase
    .from("produtos")
    .select("imagem_url")
    .eq("id", produtoId)
    .maybeSingle();

  // Remove vínculos de grupos
  await supabase.from("produto_grupos").delete().eq("produto_id", produtoId);

  const { error } = await supabase.from("produtos").delete().eq("id", produtoId);

  if (error) {
    console.error("Erro ao excluir produto:", error);
    throw new Error("Não foi possível excluir o produto");
  }

  // Remove a imagem do storage se existir (não bloqueia o delete)
  if (produto?.imagem_url && produto.imagem_url.startsWith("Produtos/")) {
    void (async () => {
      try {
        await supabase.storage
          .from("DondaSorvetes")
          .remove([produto.imagem_url!]);
      } catch (err) {
        console.error("Erro ao remover imagem do produto deletado:", err);
      }
    })();
  }

  return { success: true };
}

export async function duplicateProduto(id: string | number) {
  await requirePermission("catalogo:write");
  const supabase = createServiceRoleClient();
  const produtoId = toId(id);

  const { data: original, error } = await supabase
    .from("produtos")
    .select("*")
    .eq("id", produtoId)
    .maybeSingle();

  if (error || !original) {
    throw new Error("Produto não encontrado");
  }

  const created = await createProduto({
    nome: `${original.nome} (cópia)`,
    descricao: original.descricao,
    preco_base: Number(original.preco_base),
    preco_promocional:
      original.preco_promocional != null
        ? Number(original.preco_promocional)
        : null,
    categoria_id: original.categoria_id,
    esta_disponivel: false,
    pergunta_colher: original.pergunta_colher !== false,
    imagem_url: original.imagem_url,
    tag_id: original.tag_id,
  });

  // copia grupos de opções
  const { data: grupos } = await supabase
    .from("produto_grupos")
    .select("grupo_id, ordem")
    .eq("produto_id", produtoId);

  if (grupos && grupos.length > 0) {
    await supabase.from("produto_grupos").insert(
      grupos.map((g) => ({
        produto_id: Number(created.id),
        grupo_id: g.grupo_id,
        ordem: g.ordem,
      })) as never
    );
  }

  return created;
}

/** Reordena produtos (lista ordenada de IDs na categoria) */
export async function reorderProdutos(orderedIds: (string | number)[]) {
  await requirePermission("catalogo:write");
  const supabase = createServiceRoleClient();

  await Promise.all(
    orderedIds.map((id, index) =>
      supabase
        .from("produtos")
        .update({ ordem: index + 1 } as never)
        .eq("id", toId(id))
    )
  );

  return { success: true };
}

export async function moveProdutoCategoria(
  id: string | number,
  categoriaId: string | number | null
) {
  return updateProduto(id, {
    categoria_id: categoriaId,
  });
}
