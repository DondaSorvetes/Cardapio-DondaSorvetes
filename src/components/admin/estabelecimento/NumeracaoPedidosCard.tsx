"use client";

import { useState } from "react";
import { Hash, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface NumeracaoPedidosCardProps {
  proximoNumero: number;
  onReiniciar: () => Promise<void>;
  disabled?: boolean;
}

export function NumeracaoPedidosCard({
  proximoNumero,
  onReiniciar,
  disabled = false,
}: NumeracaoPedidosCardProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onReiniciar();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className={cn(
          "rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm",
          "transition-all duration-300 ease-out",
          "hover:shadow-md hover:border-[#F6BFD2]/60",
          disabled && "opacity-60 pointer-events-none"
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#C8285F] to-[#E33E70] text-white flex items-center justify-center shrink-0 shadow-md shadow-pink-500/25">
              <Hash className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[#111827]">
                Numeração dos pedidos
              </h3>
              <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">
                Controle o número sequencial exibido nos pedidos do
                estabelecimento.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-5 pl-[3.75rem] sm:pl-0">
            <div className="text-center sm:text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                Próximo pedido
              </p>
              <p className="text-3xl font-bold tabular-nums tracking-tight text-[#111827] mt-0.5">
                {proximoNumero.toLocaleString("pt-BR")}
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={disabled || loading}
              onClick={() => setOpen(true)}
              className="h-10 rounded-xl border-[#E5E7EB] hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 transition-all shrink-0"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reiniciar contagem
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="rounded-2xl sm:rounded-2xl border-[#E5E7EB]">
          <AlertDialogHeader>
            <AlertDialogTitle>Reiniciar numeração dos pedidos?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#6B7280]">
              A contagem voltará para{" "}
              <strong className="text-[#111827]">1</strong>. O próximo pedido
              criado usará esse número. Esta ação não altera pedidos já
              existentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={loading}
              className="rounded-xl"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={loading}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
              className="rounded-xl bg-[#C8285F] hover:bg-[#3d1d70]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Reiniciando...
                </>
              ) : (
                "Sim, reiniciar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
