import { NextRequest } from "next/server";
import { apiError, apiOk, apiValidation } from "@/lib/security/api-response";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { withApiGuard } from "@/lib/security/with-api-guard";

/**
 * Busca de CEP pelo servidor (ViaCEP).
 * O navegador não chama o ViaCEP direto: a CSP (connect-src) só libera o próprio
 * site e o Supabase, e assim continua estrita.
 */
export const GET = withApiGuard(
  { methods: ["GET"], rateLimit: RATE_LIMITS.search, checkOrigin: false },
  async (request: NextRequest) => {
    const cep = (request.nextUrl.pathname.split("/").at(-1) ?? "").replace(/\D/g, "");
    if (cep.length !== 8) return apiValidation("CEP inválido.");

    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        signal: AbortSignal.timeout(6000),
        next: { revalidate: 60 * 60 * 24 * 7 },
      });
      if (!resposta.ok) return apiError("Não foi possível buscar o CEP agora.", 502);
      const dados = (await resposta.json()) as {
        erro?: boolean | string;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (dados.erro) return apiError("CEP não encontrado.", 404, { codigo: "CEP_NOT_FOUND" });
      return apiOk({
        cep,
        logradouro: dados.logradouro ?? "",
        bairro: dados.bairro ?? "",
        cidade: dados.localidade ?? "",
        estado: dados.uf ?? "",
      });
    } catch {
      return apiError("Não foi possível buscar o CEP agora.", 502);
    }
  },
);
