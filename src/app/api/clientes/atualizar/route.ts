import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/integrations/supabase/client.server";
import { obterSessao, normalizarTelefone } from "@/lib/auth";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  apiError,
  apiOk,
  apiServerError,
  apiUnauthorized,
  apiValidation,
} from "@/lib/security/api-response";
import { sanitizePhone, sanitizeText } from "@/lib/security/sanitize";

const atualizarSchema = z.object({
  nome: z
    .string()
    .min(3, "Nome deve ter no mínimo 3 caracteres")
    .max(120)
    .transform((n) => sanitizeText(n, 120)),
  telefone: z
    .string()
    .min(10, "Telefone deve ter no mínimo 10 dígitos")
    .max(20)
    .transform((t) => sanitizePhone(t)),
});

export const PUT = withApiGuard(
  {
    methods: ["PUT"],
    rateLimit: RATE_LIMITS.apiStrict,
    checkOrigin: true,
  },
  async (request: NextRequest) => {
    try {
      const sessao = await obterSessao();

      if (!sessao) {
        return apiUnauthorized();
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return apiValidation("Corpo da requisição inválido");
      }

      const validacao = atualizarSchema.safeParse(body);

      if (!validacao.success) {
        return apiValidation("Dados inválidos");
      }

      const { nome, telefone } = validacao.data;
      const telefoneNormalizado = normalizarTelefone(telefone);

      const supabase = createServerClient();

      const { data: outroCliente } = await supabase
        .from("clientes")
        .select("id")
        .eq("telefone", telefoneNormalizado)
        .neq("id", sessao.id)
        .single();

      if (outroCliente) {
        return apiError("Este telefone já está em uso por outro cliente", 409, {
          codigo: "PHONE_IN_USE",
        });
      }

      const { data, error } = await supabase
        .from("clientes")
        .update({
          nome,
          telefone: telefoneNormalizado,
        })
        .eq("id", sessao.id)
        .select()
        .single();

      if (error) {
        return apiServerError(error);
      }

      return apiOk({
        mensagem: "Dados atualizados com sucesso",
        cliente: {
          id: data.id,
          nome: data.nome,
          telefone: data.telefone,
        },
      });
    } catch (erro) {
      return apiServerError(erro);
    }
  }
);
