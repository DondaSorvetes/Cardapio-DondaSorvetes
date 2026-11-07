"use client";

import { useState, useRef, ChangeEvent } from "react";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { imageProxyUrl } from "@/lib/image/proxy-url";

interface ProdutoImageUploadProps {
  value?: string | null;
  onChange: (imagePath: string | null) => void;
  disabled?: boolean;
}

interface UploadResponse {
  path: string;
  filename: string;
  size: number;
  originalSize: number;
  width: number;
  height: number;
  compressionRatio: string;
}

export function ProdutoImageUpload({
  value,
  onChange,
  disabled = false,
}: ProdutoImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Se tiver valor inicial, buscar preview da API
  const getImageUrl = (path: string | null) => {
    return imageProxyUrl(path);
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validações no cliente
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      setError("Tipo de arquivo inválido. Use JPEG, PNG, WebP ou GIF.");
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError("Arquivo muito grande. Tamanho máximo: 10MB");
      return;
    }

    // Preview local
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    handleUpload(file);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/upload/produto-imagem", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(typeof data?.erro === "string" ? data.erro : "Não foi possível enviar a imagem. Tente novamente.");
      }

      const uploadData = data as Partial<UploadResponse> | null;
      if (!uploadData || typeof uploadData.path !== "string" || !uploadData.path.trim()) {
        throw new Error("Não foi possível confirmar o envio da imagem. Tente novamente.");
      }

      // Atualiza o formulário com o path da imagem
      onChange(uploadData.path);

    } catch (err) {
      console.error("Erro no upload:", err);
      setError(err instanceof Error ? err.message : "Erro ao fazer upload");
      setPreview(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const hasImage = value || preview;
  const imageUrl = preview || (value ? getImageUrl(value) : null);

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        disabled={disabled || uploading}
        className="hidden"
      />

      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg overflow-hidden transition-colors",
          hasImage ? "border-gray-300" : "border-gray-300 hover:border-gray-400",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {hasImage && imageUrl ? (
          <div className="relative aspect-video bg-gray-100">
            <img
              src={imageUrl}
              alt="Preview do produto"
              className="w-full h-full object-contain"
            />
            {!disabled && !uploading && (
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                title="Remover imagem"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2 text-white">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm font-medium">Processando...</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={handleClick}
            disabled={disabled || uploading}
            className="w-full aspect-video flex flex-col items-center justify-center gap-3 p-6 hover:bg-gray-50 transition-colors"
          >
            {uploading ? (
              <>
                <Loader2 className="h-12 w-12 text-gray-400 animate-spin" />
                <p className="text-sm text-gray-600 font-medium">
                  Processando imagem...
                </p>
              </>
            ) : (
              <>
                <div className="rounded-full bg-gray-100 p-4">
                  <ImageIcon className="h-8 w-8 text-gray-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">
                    Clique para fazer upload
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    JPEG, PNG, WebP ou GIF (máx. 10MB)
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    A imagem será automaticamente convertida para WebP
                  </p>
                </div>
              </>
            )}
          </button>
        )}
      </div>

      {!hasImage && !uploading && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClick}
          disabled={disabled}
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          Selecionar Imagem
        </Button>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {value && !error && (
        <p className="text-xs text-gray-500">
          Imagem: {value.split("/").pop()}
        </p>
      )}
    </div>
  );
}
