"use client";

import { CarrinhoProvider } from "@/context/CarrinhoContext";
import { AuthProvider, type ClienteData } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";

export function Providers({
  children,
  initialCliente,
}: {
  children: React.ReactNode;
  initialCliente?: ClienteData | null;
}) {
  return (
    <AuthProvider initialCliente={initialCliente}>
      <CarrinhoProvider>{children}</CarrinhoProvider>
      {/* Sem isto nenhum toast() do site ou do painel aparecia na tela. */}
      <Toaster />
    </AuthProvider>
  );
}
