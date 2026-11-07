import { NextRequest } from "next/server";
import { z } from "zod";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { apiError, apiOk, apiValidation } from "@/lib/security/api-response";
import { CupomErro, validarCupom } from "@/lib/cupons";

const schema = z.object({
  codigo: z.string().min(3).max(32),
  subtotal: z.number().min(0).max(100_000),
});

export const POST = withApiGuard(
  { methods: ["POST"], rateLimit: RATE_LIMITS.cupom, checkOrigin: true },
  async (request: NextRequest) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return apiValidation("Dados do cupom inválidos.");
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiValidation("Informe um código de cupom válido.");

    try {
      const cupom = await validarCupom(parsed.data.codigo, parsed.data.subtotal);
      return apiOk({ cupom });
    } catch (error) {
      return apiError(
        error instanceof Error ? error.message : "Não foi possível validar o cupom.",
        400,
        error instanceof CupomErro ? { codigo: error.codigo } : undefined,
      );
    }
  }
);
