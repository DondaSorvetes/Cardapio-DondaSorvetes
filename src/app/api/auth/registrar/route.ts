import { NextRequest } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/integrations/supabase/client.server";
import { normalizarTelefone } from "@/lib/auth";
import { randomUUID } from "crypto";
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

const registrarSchema = z.object({
  nome: z
    .string()
    .min(3)
    .max(120)
    .transform((n) => sanitizeText(n, 120)),
  telefone: z
    .string()
    .min(10)
    .max(20)
    .transform((t) => sanitizePhone(t))
    .refine((t) => t.length >= 10 && t.length <= 15),
  endereco: z
    .string()
    .min(5)
    .max(500)
    .transform((e) => sanitizeText(e, 500))
    .nullable()
    .optional(),
});

export const POST = withApiGuard(
  {
    methods: ["POST"],
    rateLimit: RATE_LIMITS.register,
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

      const validacao = registrarSchema.safeParse(body);
      if (!validacao.success) {
        return apiValidation("Dados inválidos");
      }

      const { nome, telefone, endereco } = validacao.data;
      const telefoneNormalizado = normalizarTelefone(telefone);
      const supabase = createServerClient();

      const { data: clienteExistente } = await supabase
        .from("clientes")
        .select("id")
        .eq("telefone", telefoneNormalizado)
        .maybeSingle();

      if (clienteExistente) {
        // Mensagem neutra (não incentiva enumeração agressiva)
        return apiError(
          "Não foi possível concluir o cadastro com estes dados.",
          409,
          { codigo: "REGISTER_CONFLICT" },
        );
      }

      const enderecoEstruturado: Endereco | null = endereco
        ? {
            id: randomUUID(),
            apelido: "Principal",
            logradouro: endereco.split(",")[0]?.trim() || "",
            numero: endereco.split(",")[1]?.split("-")[0]?.trim() || "",
            complemento: endereco.split("-")[1]?.split("-")[0]?.trim() || "",
            bairro:
              endereco
                .split("-")
                [endereco.split("-").length - 2]?.split(",")[0]
                ?.trim() || "",
            cidade:
              endereco
                .split(",")
                [endereco.split(",").length - 1]?.split("/")[0]
                ?.trim() || "",
            estado: endereco.split("/")[1]?.split("-")[0]?.trim() || "",
            cep: endereco.match(/CEP:\s*(\d+)/)?.[1] || "",
            principal: true,
            created_at: new Date().toISOString(),
          }
        : null;

      const clienteId = randomUUID();
      const { data: novoCliente, error } = await supabase
        .from("clientes")
        .insert({
          id: clienteId,
          nome,
          telefone: telefoneNormalizado,
          // A coluna está NOT NULL no banco em produção; sem endereço grava string vazia.
          endereco: endereco ?? "",
          enderecos_adicionais: JSON.stringify(
            enderecoEstruturado ? [enderecoEstruturado] : [],
          ),
        })
        .select("id, nome, telefone")
        .single();

      if (error || !novoCliente) {
        return apiServerError(error);
      }

      securityLog({
        event: "auth.register",
        ip,
        userId: novoCliente.id,
        path: "/api/auth/registrar",
        result: "ok",
      });

      return apiOk(
        {
          mensagem: "Cliente cadastrado com sucesso",
          cliente: {
            id: novoCliente.id,
            nome: novoCliente.nome,
            telefone: novoCliente.telefone,
          },
        },
        201,
      );
    } catch (erro) {
      return apiServerError(erro);
    }
  },
);
