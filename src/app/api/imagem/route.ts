import { NextRequest } from "next/server";
import { getSignedUrl } from "@/integrations/supabase/client.server";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { apiError, apiOk, apiValidation } from "@/lib/security/api-response";
import {
  isPublicCatalogImagePath,
  sanitizeStoragePath,
} from "@/lib/security/sanitize";

/**
 * GET /api/imagem?path=Produtos/acai.webp
 * Service Role fica só no servidor. Path sanitizado anti path-traversal.
 */
export const GET = withApiGuard(
  {
    methods: ["GET"],
    rateLimit: RATE_LIMITS.imagem,
    checkOrigin: false, // <img src> não manda Origin de forma confiável
  },
  async (request: NextRequest) => {
    const raw = request.nextUrl.searchParams.get("path");
    const path = sanitizeStoragePath(raw);

    if (!path || !isPublicCatalogImagePath(path)) {
      return apiValidation("Path inválido.");
    }

    const signedUrl = await getSignedUrl(path);
    if (!signedUrl) {
      return apiError("Imagem não encontrada.", 404, { codigo: "NOT_FOUND" });
    }

    return apiOk({ url: signedUrl }, 200, {
      "Cache-Control": "private, max-age=3300",
    });
  },
);
