/**
 * Processamento de imagens com Sharp
 * Compacta, redimensiona e converte para WebP
 */

import sharp from "sharp";

export interface ImageProcessingOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export interface ProcessedImage {
  buffer: Buffer;
  filename: string;
  size: number;
  width: number;
  height: number;
}

const DEFAULT_OPTIONS: Required<ImageProcessingOptions> = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 85,
};

/**
 * Processa uma imagem: redimensiona, compacta e converte para WebP
 */
export async function processImage(
  fileBuffer: Buffer,
  originalFilename: string,
  options: ImageProcessingOptions = {}
): Promise<ProcessedImage> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Valida se é uma imagem válida
    const image = sharp(fileBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("Imagem inválida: metadados não encontrados");
    }

    // Calcula dimensões mantendo aspect ratio
    let width = metadata.width;
    let height = metadata.height;

    if (width > opts.maxWidth || height > opts.maxHeight) {
      const ratio = Math.min(
        opts.maxWidth / width,
        opts.maxHeight / height
      );
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    // Processa a imagem
    const processedBuffer = await image
      .resize(width, height, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({
        quality: opts.quality,
        effort: 4, // Balance entre qualidade e velocidade (0-6)
      })
      .toBuffer();

    // Gera nome do arquivo WebP
    const nameWithoutExt = originalFilename.replace(/\.[^.]+$/, "");
    const sanitizedName = nameWithoutExt
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const timestamp = Date.now();
    const filename = `${sanitizedName}-${timestamp}.webp`;

    return {
      buffer: processedBuffer,
      filename,
      size: processedBuffer.length,
      width,
      height,
    };
  } catch (error) {
    console.error("Erro ao processar imagem:", error);
    throw new Error(
      `Falha ao processar imagem: ${error instanceof Error ? error.message : "erro desconhecido"}`
    );
  }
}

/**
 * Valida tipo MIME de imagem
 */
export function isValidImageMimeType(mimeType: string): boolean {
  const validTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
  ];
  return validTypes.includes(mimeType.toLowerCase());
}

/**
 * Valida tamanho do arquivo (em bytes)
 */
export function isValidImageSize(size: number, maxSizeMB = 10): boolean {
  const maxBytes = maxSizeMB * 1024 * 1024;
  return size > 0 && size <= maxBytes;
}
