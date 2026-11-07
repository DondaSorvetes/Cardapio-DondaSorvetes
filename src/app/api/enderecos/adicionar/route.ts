import { NextRequest } from "next/server";
import { z } from "zod";
import { obterSessao } from "@/lib/auth";
import { adicionarNovoEndereco } from "@/lib/endereco";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  apiError,
  apiOk,
  apiServerError,
  apiUnauthorized,
  apiValidation,
} from "@/lib/security/api-response";
import { sanitizeText } from "@/lib/security/sanitize";

const enderecoSchema = z.object({
  apelido: z
    .string()
    .min(2, "Apelido deve ter no mínimo 2 caracteres")
    .transform((s) => sanitizeText(s, 60)),
  logradouro: z
    .string()
    .min(3, "Logradouro deve ter no mínimo 3 caracteres")
    .transform((s) => sanitizeText(s, 200)),
  numero: z.string().min(1, "Número é obrigatório").transform((s) => sanitizeText(s, 20)),
  complemento: z
    .string()
    .optional()
    .transform((s) => (s ? sanitizeText(s, 120) : s)),
  bairro: z
    .string()
    .min(2, "Bairro deve ter no mínimo 2 caracteres")
    .transform((s) => sanitizeText(s, 100)),
  cidade: z
    .string()
    .min(2, "Cidade deve ter no mínimo 2 caracteres")
    .transform((s) => sanitizeText(s, 100)),
  estado: z.string().length(2, "Estado deve ter 2 caracteres (UF)"),
  cep: z.string().regex(/^\d{8}$/, "CEP inválido (apenas números)"),
  principal: z.boolean().optional(),
});

export const POST = withApiGuard(
  {
    methods: ["POST"],
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

      const validacao = enderecoSchema.safeParse(body);

      if (!validacao.success) {
        return apiValidation("Dados inválidos");
      }

      const resultado = await adicionarNovoEndereco(sessao.id, validacao.data);

      if (!resultado.sucesso) {
        return apiError(resultado.erro || "Erro ao adicionar endereço", 500);
      }

      return apiOk({
        mensagem: "Endereço adicionado com sucesso",
        endereco: resultado.endereco,
      });
    } catch (erro) {
      return apiServerError(erro);
    }
  }
);
