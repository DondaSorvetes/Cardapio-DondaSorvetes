import { NextRequest } from "next/server";
import { createServerClient } from "@/integrations/supabase/client.server";
import { notesOptionGroup, type OptionGroup, type Tag } from "@/data/tipos";
import { apiOk, apiServerError, apiValidation } from "@/lib/security/api-response";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";

const helperForGroup = (min: number, max: number) => {
  if (min > 0 && max === 1) return "Escolha 1 opção";
  if (min > 0) return `Escolha de ${min} a ${max} opções`;
  return `Escolha até ${max} opções`;
};

export const GET = withApiGuard(
  { methods: ["GET"], rateLimit: RATE_LIMITS.catalogo, checkOrigin: false },
  async (request: NextRequest) => {
    const rawId = request.nextUrl.pathname.split("/").at(-2);
    const productId = Number(rawId);
    if (!Number.isSafeInteger(productId) || productId <= 0) return apiValidation("Produto inválido.");

    try {
      const supabase = createServerClient();
      const { data: links, error: linksError } = await supabase
        .from("produto_grupos").select("grupo_id, ordem").eq("produto_id", productId).order("ordem");
      if (linksError) throw linksError;
      const groupIds = (links ?? []).map((link) => link.grupo_id);
      if (!groupIds.length) return apiOk({ optionGroups: [notesOptionGroup] });

      const [{ data: groups, error: groupsError }, { data: options, error: optionsError }] = await Promise.all([
        supabase.from("grupos_opcoes").select("id,nome,min_escolha,max_escolha,tag_id").in("id", groupIds),
        supabase.from("opcoes").select("id,grupo_id,nome,preco_adicional,status,esta_disponivel,ordem,tag_id").in("grupo_id", groupIds).order("ordem"),
      ]);
      if (groupsError) throw groupsError;
      if (optionsError) throw optionsError;

      const tagIds = [...new Set([
        ...(groups ?? []).map((group) => group.tag_id),
        ...(options ?? []).map((option) => option.tag_id),
      ].filter((tagId): tagId is number => tagId != null))];
      const { data: tags, error: tagsError } = tagIds.length
        ? await supabase.from("tags").select("*").in("id", tagIds)
        : { data: [], error: null };
      if (tagsError) throw tagsError;
      const tagById = new Map<number, Tag>((tags ?? []).map((tag) => [tag.id, tag as Tag]));
      const groupById = new Map((groups ?? []).map((group) => [group.id, group]));

      const optionGroups: OptionGroup[] = (links ?? []).flatMap((link) => {
        const group = groupById.get(link.grupo_id);
        if (!group) return [];
        const min = group.min_escolha ?? 0;
        const max = group.max_escolha ?? 0;
        return [{
          id: String(group.id), name: group.nome, helper: helperForGroup(min, max),
          required: min > 0, min, max,
          tag: group.tag_id ? tagById.get(group.tag_id) : undefined,
          items: (options ?? []).filter((option) => option.grupo_id === group.id).map((option) => ({
            id: String(option.id), name: option.nome, priceDelta: Number(option.preco_adicional ?? 0),
            tag: option.tag_id ? tagById.get(option.tag_id) : undefined,
            disponivel: option.esta_disponivel !== false && String(option.status ?? "ativo").toLowerCase() !== "inativo",
          })),
        }];
      });

      return apiOk({ optionGroups: [...optionGroups, notesOptionGroup] }, 200, {
        "Cache-Control": "no-store",
      });
    } catch (error) {
      return apiServerError(error);
    }
  }
);
