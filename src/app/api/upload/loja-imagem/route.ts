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

export const POST = withApiGuard(
  {
    methods: ["POST"],
    maxBodyBytes: 11 * 1024 * 1024,
    rateLimit: RATE_LIMITS.mutation,
  },
  async (request: NextRequest) => {
    try {
      await requirePermissionApi("config:write");
    } catch (error) {
      const unauthorized =
        error instanceof Error && error.message === "UNAUTHORIZED";
      return apiError(
        unauthorized
          ? "Entre novamente no painel."
          : "Sem permissão para alterar a aparência da loja.",
        unauthorized ? 401 : 403,
      );
    }
    const form = await request.formData();
    const file = form.get("image");
    const type = form.get("type");
    if (type !== "logo" && type !== "banner")
      return apiValidation("Tipo de imagem inválido.");
    if (!(file instanceof File) || !isValidImageMimeType(file.type))
      return apiValidation("Envie uma imagem JPEG, PNG, WebP ou GIF.");
    if (!isValidImageSize(file.size, 10) || file.size === 0)
      return apiValidation("Envie uma imagem de até 10MB.");
    try {
      const processed = await processImage(
        Buffer.from(await file.arrayBuffer()),
        type + ".webp",
        {
          maxWidth: type === "banner" ? 2400 : 1200,
          maxHeight: type === "banner" ? 1600 : 1200,
          quality: 90,
        },
      );
      const uploaded = await uploadImageToStorage(
        processed.buffer,
        processed.filename,
        "Loja",
      );
      return apiOk(
        {
          path: uploaded.path,
          width: processed.width,
          height: processed.height,
        },
        201,
      );
    } catch {
      return apiError(
        "Não foi possível enviar a imagem. Verifique o arquivo e tente novamente.",
        500,
        { codigo: "UPLOAD_ERROR" },
      );
    }
  },
);
