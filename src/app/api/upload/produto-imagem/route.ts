/**
 * API para upload de imagens de produtos
 * POST /api/upload/produto-imagem
 *
 * Segurança:
 * - Requer autenticação de admin
 * - Valida tipo e tamanho do arquivo
 * - Processa e converte para WebP
 * - Rate limiting aplicado
 */

import { NextRequest } from "next/server";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { apiError, apiOk, apiValidation } from "@/lib/security/api-response";
import { requirePermissionApi } from "@/lib/admin/auth";
import {
  processImage,
  isValidImageMimeType,
  isValidImageSize,
} from "@/lib/image/processor";
import { uploadImageToStorage } from "@/lib/image/upload";

const MAX_FILE_SIZE_MB = 10;

export const POST = withApiGuard(
  {
    methods: ["POST"],
    maxBodyBytes: 11 * 1024 * 1024,
    rateLimit: RATE_LIMITS.mutation,
  },
  async (request: NextRequest) => {
    try {
      // Verifica se é admin
      await requirePermissionApi("catalogo:write");

      // Parse do FormData
      const formData = await request.formData();
      const file = formData.get("image") as File | null;

      if (!(file instanceof File)) {
        return apiValidation("Nenhuma imagem enviada");
      }

      // Validações básicas
      if (!isValidImageMimeType(file.type)) {
        return apiValidation(
          "Tipo de arquivo inválido. Envie apenas imagens (JPEG, PNG, WebP, GIF)",
        );
      }

      if (!isValidImageSize(file.size, MAX_FILE_SIZE_MB)) {
        return apiValidation(
          `Arquivo muito grande. Tamanho máximo: ${MAX_FILE_SIZE_MB}MB`,
        );
      }

      // Converte File para Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Processa a imagem (compacta, redimensiona, converte para WebP)
      const processed = await processImage(buffer, file.name, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 85,
      });

      // Faz upload para o Supabase Storage
      const uploadResult = await uploadImageToStorage(
        processed.buffer,
        processed.filename,
      );

      // Retorna informações do upload
      return apiOk(
        {
          path: uploadResult.path,
          filename: processed.filename,
          size: processed.size,
          originalSize: file.size,
          width: processed.width,
          height: processed.height,
          compressionRatio: (
            ((file.size - processed.size) / file.size) *
            100
          ).toFixed(1),
        },
        201,
      );
    } catch (error) {
      console.error("Erro no upload de imagem:", error);

      if (error instanceof Error) {
        if (["UNAUTHORIZED", "FORBIDDEN"].includes(error.message)) {
          return apiError("Acesso negado", 403, { codigo: "FORBIDDEN" });
        }
        return apiError("Não foi possível enviar a imagem. Verifique o arquivo e tente novamente.", 500, { codigo: "UPLOAD_ERROR" });
      }

      return apiError("Erro ao processar upload", 500, {
        codigo: "UPLOAD_ERROR",
      });
    }
  },
);
