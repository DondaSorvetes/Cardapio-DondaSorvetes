import "server-only";
import { cache } from "react";
import { obterSessao } from "@/lib/auth";
import { createServerClient } from "@/integrations/supabase/client.server";
export const getCustomerSession = cache(async () => {
  const session = await obterSessao();
  if (!session) return null;
  const { data, error } = await createServerClient()
    .from("clientes")
    .select("id, nome, telefone, endereco, enderecos_adicionais")
    .eq("id", session.id)
    .maybeSingle();
  if (error) throw new Error("Não foi possível consultar a sessão.");
  return data;
});
