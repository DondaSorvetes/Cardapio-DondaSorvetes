import "server-only";
import { publicRead } from "@/lib/public-read.server";
import { createServerClient } from "@/integrations/supabase/client.server";
import { imageProxyUrl } from "@/lib/image/proxy-url";

async function readData() {
  const { data, error } = await createServerClient()
    .from("configuracoes_loja")
    .select(
      "id,nome,logo_url,banner_url,endereco,cidade,estado,horario_abertura,horario_fechamento,dias_funcionamento,taxa_entrega,pedido_minimo,tempo_entrega_min,tempo_entrega_max,esta_aberto",
    )
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    logo_url: imageProxyUrl(data.logo_url),
    banner_url: imageProxyUrl(data.banner_url),
  };
}

export function fetchLojaResumo() { return publicRead("store", readData); }

/** Campos públicos extras da loja (mesmos de /api/loja/detalhes). */
export const CAMPOS_DETALHES_LOJA =
  "descricao,endereco,telefone,whatsapp,instagram,facebook,horario_fechamento,dias_funcionamento,pedido_minimo";

export async function fetchLojaDetalhes() {
  const { data, error } = await createServerClient()
    .from("configuracoes_loja")
    .select(CAMPOS_DETALHES_LOJA)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}
