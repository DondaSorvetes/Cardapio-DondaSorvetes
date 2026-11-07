import { NextRequest } from "next/server";
import { z } from "zod";
import { obterSessao } from "@/lib/auth";
import { removerEndereco } from "@/lib/endereco";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  apiError,
  apiOk,
  apiServerError,
  apiUnauthorized,
  apiValidation,
} from "@/lib/security/api-response";

const removerSchema = z.object({
  enderecoId: z.string().uuid("ID do endereço inválido"),
});

export const DELETE = withApiGuard(
  {
    methods: ["DELETE"],
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

      const validacao = removerSchema.safeParse(body);

      if (!validacao.success) {
        return apiValidation("Dados inválidos");
      }

      const resultado = await removerEndereco(
        sessao.id,
        validacao.data.enderecoId
      );

      if (!resultado.sucesso) {
        return apiError(resultado.erro || "Erro ao remover endereço", 500);
      }

      return apiOk({
        mensagem: "Endereço removido com sucesso",
      });
    } catch (erro) {
      return apiServerError(erro);
    }
  }
);
