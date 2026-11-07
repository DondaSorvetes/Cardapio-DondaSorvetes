"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "Erro ao carregar pedidos",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="h-[calc(100vh-80px)] flex items-center justify-center bg-white">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-[#111827] mb-2">
          Ops! Algo deu errado
        </h3>
        <p className="text-sm text-[#6B7280] mb-6">{message}</p>
        {onRetry && (
          <Button onClick={onRetry} className="bg-[#C8285F] hover:bg-[#E33E70]">
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar Novamente
          </Button>
        )}
      </div>
    </div>
  );
}
