import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  imageCacheControl,
  isImmutableImagePath,
} from "@/lib/image/cache-policy";
import { readStorageImage } from "@/lib/image/source.server";
import { withApiGuard } from "@/lib/security/with-api-guard";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { apiError, apiValidation } from "@/lib/security/api-response";
import {
  isPublicCatalogImagePath,
  sanitizeStoragePath,
} from "@/lib/security/sanitize";

/** Transmite a imagem pelo servidor sem expor URL assinada do Storage. */
export const GET = withApiGuard(
  { methods: ["GET"], rateLimit: RATE_LIMITS.imagem, checkOrigin: false },
  async (request: NextRequest) => {
    const path = sanitizeStoragePath(request.nextUrl.searchParams.get("path"));
    const bucket =
      request.nextUrl.searchParams.get("bucket") || "DondaSorvetes";
    if (
      !path ||
      !isPublicCatalogImagePath(path) ||
      !["DondaSorvetes"].includes(bucket)
    ) {
      return apiValidation("Path inválido.");
    }

    const immutableEtag = isImmutableImagePath(path)
      ? '"' +
        createHash("sha1")
          .update(JSON.stringify([bucket, path]))
          .digest("hex") +
        '"'
      : null;
    const matches = (etag: string) =>
      request.headers
        .get("if-none-match")
        ?.split(",")
        .some((value) => value.trim().replace(/^W\//, "") === etag);
    if (immutableEtag && matches(immutableEtag)) {
      if (process.env.NODE_ENV !== "production")
        console.debug("[image-conditional]", {
          path,
          status: 304,
          storageReads: 0,
        });
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: immutableEtag,
          "Cache-Control": imageCacheControl(path),
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const source = await readStorageImage(bucket, path);
    if (!source)
      return apiError("Imagem não encontrada.", 404, { codigo: "NOT_FOUND" });
    const { bytes } = source;
    const etag = immutableEtag ?? source.etag;
    const cacheHeaders = {
      ETag: etag,
      "Cache-Control": imageCacheControl(path),
      "X-Content-Type-Options": "nosniff",
    };
    if (
      request.headers
        .get("if-none-match")
        ?.split(",")
        .some((value) => value.trim().replace(/^W\//, "") === etag)
    )
      return new NextResponse(null, { status: 304, headers: cacheHeaders });
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": source.type,
        "Content-Length": String(bytes.byteLength),
        ...cacheHeaders,
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
);
