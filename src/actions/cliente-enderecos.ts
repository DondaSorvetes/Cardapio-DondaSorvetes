"use server";
import { z } from "zod";
import { headers } from "next/headers";
import { obterSessao } from "@/lib/auth";
import { parseAdditionalAddresses } from "@/lib/enderecos-cliente";
import { atualizarEndereco } from "@/lib/endereco";
import { createServerClient } from "@/integrations/supabase/client.server";
import { sanitizeText } from "@/lib/security/sanitize";
import {
  rateLimitCheck,
  RATE_LIMITS,
  getClientIp,
} from "@/lib/security/rate-limit";
import type { EnderecoInput } from "@/types/endereco";
const schema = z.object({
  apelido: z
    .string()
    .min(2)
    .transform((s) => sanitizeText(s, 60)),
  logradouro: z
    .string()
    .min(3)
    .transform((s) => sanitizeText(s, 200)),
  numero: z
    .string()
    .min(1)
    .transform((s) => sanitizeText(s, 20)),
  complemento: z
    .string()
    .optional()
    .transform((s) => (s ? sanitizeText(s, 120) : s)),
  bairro: z
    .string()
    .min(2)
    .transform((s) => sanitizeText(s, 100)),
  cidade: z
    .string()
    .min(2)
    .transform((s) => sanitizeText(s, 100)),
  estado: z.string().length(2),
  cep: z.string().regex(/^\d{8}$/),
});
export async function salvarEnderecoExistente(
  id: string,
  input: EnderecoInput,
) {
  const session = await obterSessao();
  if (!session)
    return {
      sucesso: false,
      erro: "Entre na sua conta para editar o endereço.",
    };
  const requestHeaders = await headers();
  const limit = await rateLimitCheck(
    getClientIp(
      new Request("http://localhost", { headers: requestHeaders }),
    ),
    RATE_LIMITS.mutation,
  );
  if (!limit.success)
    return {
      sucesso: false,
      erro: "Aguarde um momento antes de tentar novamente.",
    };
  const parsed = schema.safeParse(input);
  if (!z.string().uuid().safeParse(id).success || !parsed.success)
    return { sucesso: false, erro: "Confira os dados do endereço." };
  const { data, error } = await createServerClient()
    .from("clientes")
    .select("enderecos_adicionais")
    .eq("id", session.id)
    .single();
  if (error || !data)
    return { sucesso: false, erro: "Não foi possível carregar o endereço." };
  const address = parseAdditionalAddresses(data.enderecos_adicionais).find(
    (item) => item.id === id,
  );
  if (!address) return { sucesso: false, erro: "Endereço não encontrado." };
  // Preserve principal state; the existing dedicated action changes the default address.
  return atualizarEndereco(session.id, id, {
    ...parsed.data,
    principal: address.principal,
  });
}
