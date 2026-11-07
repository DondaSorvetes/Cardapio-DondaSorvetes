"use client";

import { ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCarrinho } from "@/context/CarrinhoContext";
import { formatBRL } from "@/data/tipos";
const ModalSacola = dynamic(
  () => import("./ModalSacola").then((module) => module.ModalSacola),
  { ssr: false },
);
import { useLoja } from "@/hooks/useLoja";
import { toast } from "sonner";

export function BarraSacola() {
  const { totalItens, subtotal } = useCarrinho();
  const { loja, isLoading, error, refresh } = useLoja();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const lojaConfirmada = !isLoading && !!loja && !error;

  // Fecha a sacola ao navegar pela bottom bar (sem precisar do X)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (totalItens === 0) return null;

  const handleOpen = () => {
    if (!lojaConfirmada) {
      toast.info("Aguarde, verificando o funcionamento da loja…");
      void refresh();
      return;
    }
    setOpen(true);
  };

  return (
    <>
      {!open && (
        <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] inset-x-0 z-[60] px-4 pb-2 md:bottom-4 md:z-50">
          {lojaConfirmada ? (
            <button
              onClick={handleOpen}
              className="flex w-full items-center justify-between gap-3 rounded-xl bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg transition hover:opacity-95"
            >
              <span className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-foreground/20 text-xs font-bold">
                  {totalItens}
                </span>
                <ShoppingBag className="h-4 w-4" />
                Ver sacola
              </span>
              <span>{formatBRL(subtotal)}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void refresh()}
              className="flex min-h-12 w-full items-center justify-center rounded-xl border border-border bg-card px-4 text-sm text-muted-foreground"
            >
              {isLoading
                ? "Verificando funcionamento da loja…"
                : "Não foi possível verificar a loja. Tentar novamente"}
            </button>
          )}
        </div>
      )}

      <ModalSacola open={open} onOpenChange={setOpen} />
    </>
  );
}
