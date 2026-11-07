"use client";

export async function uploadStoreImage(
  file: File,
  type: "logo" | "banner",
): Promise<string> {
  const form = new FormData();
  form.append("image", file);
  form.append("type", type);
  const response = await fetch("/api/upload/loja-imagem", {
    method: "POST",
    body: form,
    credentials: "include",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      typeof data?.erro === "string"
        ? data.erro
        : "Não foi possível enviar a imagem. Tente novamente.",
    );
  if (typeof data?.path !== "string" || !data.path.startsWith("Loja/"))
    throw new Error("Não foi possível confirmar o envio da imagem.");
  return data.path;
}
