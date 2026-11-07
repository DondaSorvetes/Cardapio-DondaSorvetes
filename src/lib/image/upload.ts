/**
 * Upload de imagens para o Supabase Storage
 * Usa Service Role para acesso seguro ao bucket
 */

import { createServiceRoleClient } from "@/integrations/supabase/client.server";

const BUCKET_NAME = "DondaSorvetes";
const PRODUTOS_FOLDER = "Produtos";

export interface UploadResult {
  path: string;
  publicUrl: string;
  size: number;
}

/**
 * Faz upload de uma imagem para o bucket do Supabase
 * @param buffer Buffer da imagem processada
 * @param filename Nome do arquivo (já deve estar sanitizado e com extensão .webp)
 * @returns Informações do upload
 */
export async function uploadImageToStorage(
  buffer: Buffer,
  filename: string,
  folder: "Produtos" | "Loja" = PRODUTOS_FOLDER,
): Promise<UploadResult> {
  const supabase = createServiceRoleClient();

  // Path completo no storage
  const storagePath = `${folder}/${filename}`;

  try {
    // Upload para o bucket
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false, // Não sobrescrever arquivos existentes
      });

    if (error) {
      console.error("Erro no upload para Supabase:", error);
      throw new Error(`Falha no upload: ${error.message}`);
    }

    if (!data || !data.path) {
      throw new Error("Upload realizado mas path não retornado");
    }

    // Retorna o path e URL pública (nota: bucket é privado, então URL precisa de signed URL)
    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_NAME).getPublicUrl(storagePath);

    return {
      path: data.path,
      publicUrl,
      size: buffer.length,
    };
  } catch (error) {
    console.error("Erro ao fazer upload:", error);
    throw error instanceof Error
      ? error
      : new Error("Erro desconhecido ao fazer upload");
  }
}

/**
 * Remove uma imagem do storage
 * @param path Path completo da imagem no storage
 */
export async function deleteImageFromStorage(path: string): Promise<void> {
  const supabase = createServiceRoleClient();

  try {
    const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);

    if (error) {
      console.error("Erro ao remover imagem:", error);
      // Não lançamos erro aqui pois a remoção da imagem é secundária
      // O produto pode ser deletado mesmo se a imagem não for removida
    }
  } catch (error) {
    console.error("Erro ao remover imagem do storage:", error);
  }
}

/**
 * Valida se o path da imagem está no formato correto
 */
export function isValidProductImagePath(path: string): boolean {
  if (!path) return false;

  // Deve começar com Produtos/ e terminar com .webp
  const validPattern = /^Produtos\/[a-z0-9\-]+\d+\.webp$/;
  return validPattern.test(path);
}
