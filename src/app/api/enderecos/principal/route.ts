import { NextRequest } from "next/server";
import { z } from "zod";
import { obterSessao } from "@/lib/auth";
import { definirEnderecoPrincipal } from "@/lib/endereco";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  apiError,
  apiOk,
  apiServerError,
  apiUnauthorized,
  apiValidation,
} from "@/lib/security/api-response";

const principalSchema = z.object({
  enderecoId: z.union([
    z.string().uuid("ID do endereço inválido"),
    z.literal("endereco-legado"),
  ]),
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

      const validacao = principalSchema.safeParse(body);

      if (!validacao.success) {
        return apiValidation("Dados inválidos");
      }

      const resultado = await definirEnderecoPrincipal(
        sessao.id,
        validacao.data.enderecoId,
      );

      if (!resultado.sucesso) {
        return apiError(
          resultado.erro || "Erro ao definir endereço principal",
          500,
        );
      }

      return apiOk({
        mensagem: "Endereço principal definido com sucesso",
      });
    } catch (erro) {
      return apiServerError(erro);
    }
  },
);
