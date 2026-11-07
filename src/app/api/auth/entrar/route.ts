import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  buscarClientePorTelefone,
  gerarToken,
  normalizarTelefone,
  sessionCookieOptions,
} from "@/lib/auth";
import type { Endereco } from "@/types/endereco";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  apiError,
  apiOk,
  apiServerError,
  apiValidation,
} from "@/lib/security/api-response";
import { sanitizePhone, sanitizeText } from "@/lib/security/sanitize";
import { securityLog } from "@/lib/security/logger";

const entrarSchema = z.object({
  telefone: z
    .string()
    .min(10)
    .max(20)
    .transform((t) => sanitizePhone(t))
    .refine((t) => t.length >= 10 && t.length <= 15, "Telefone inválido"),
});

/** Mensagem genérica — evita enumeração de usuários (OWASP) */
const MSG_CREDENCIAIS = "Credenciais inválidas.";

export const POST = withApiGuard(
  {
    methods: ["POST"],
    rateLimit: RATE_LIMITS.login,
    checkOrigin: true,
  },
  async (request: NextRequest, { ip }) => {
    try {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return apiValidation("Corpo da requisição inválido");
      }

      const validacao = entrarSchema.safeParse(body);
      if (!validacao.success) {
        securityLog({
          event: "auth.login.fail",
          level: "warn",
          ip,
          path: "/api/auth/entrar",
          result: "fail",
          meta: { reason: "validation" },
        });
        // Mesma mensagem genérica
        return apiError(MSG_CREDENCIAIS, 401, { codigo: "AUTH_FAILED" });
      }

      const telefoneNormalizado = normalizarTelefone(validacao.data.telefone);
      const cliente = await buscarClientePorTelefone(telefoneNormalizado);

      if (!cliente) {
        securityLog({
          event: "auth.login.fail",
          level: "warn",
          ip,
          path: "/api/auth/entrar",
          result: "fail",
          meta: { reason: "not_found" },
        });
        // Mensagem específica para usuário não encontrado
        return apiError("Conta não encontrada. Por favor, cadastre-se primeiro.", 404, {
          codigo: "USER_NOT_FOUND"
        });
      }

      const token = await gerarToken({
        id: cliente.id,
        nome: sanitizeText(cliente.nome, 120) || null,
        telefone: cliente.telefone,
        endereco: cliente.endereco,
        enderecos_adicionais:
          (cliente.enderecos_adicionais as unknown as Endereco[]) || [],
      });

      const cookieStore = await cookies();
      cookieStore.set("session", token, sessionCookieOptions());

      securityLog({
        event: "auth.login.success",
        ip,
        userId: cliente.id,
        path: "/api/auth/entrar",
        result: "ok",
      });

      return apiOk({
        mensagem: "Login realizado com sucesso",
        cliente: {
          id: cliente.id,
          nome: cliente.nome,
          telefone: cliente.telefone,
          endereco: cliente.endereco,
        },
      });
    } catch (erro) {
      return apiServerError(erro);
    }
  }
);
