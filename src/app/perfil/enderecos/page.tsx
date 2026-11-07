"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { customerAddresses } from "@/lib/enderecos-cliente";
import type { Endereco } from "@/types/endereco";

export default function PaginaEnderecos() {
  const { cliente, loading, refreshCliente } = useAuth();
  const router = useRouter();
  const [enderecos, setEnderecos] = useState<Endereco[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Endereco | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !cliente) {
      router.push("/entrar");
    }
  }, [loading, cliente, router]);

  useEffect(() => {
    if (loading) return;
    setEnderecos(customerAddresses(cliente ?? {}));
    setCarregando(false);
  }, [cliente, loading]);

  const handleRemover = async (enderecoId: string) => {
    // Não permite remover o endereço legado
    if (enderecoId === "endereco-legado") {
      toast.error("O endereço principal não pode ser removido");
      return;
    }

    if (removendo) return;
    setRemovendo(enderecoId);

    try {
      const resposta = await fetch("/api/enderecos/remover", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enderecoId }),
      });

      if (!resposta.ok) {
        toast.error("Erro ao remover endereço");
        return;
      }

      toast.success("Endereço removido!");
      setEnderecos((prev) => {
        const next = prev.filter((e) => e.id !== enderecoId);
        if (next.length && !next.some((e) => e.principal))
          return next.map((e, i) => ({ ...e, principal: i === 0 }));
        return next;
      });
      setConfirmRemove(null);
      await refreshCliente();
    } catch {
      toast.error("Erro ao remover endereço");
    } finally {
      setRemovendo(null);
    }
  };

  const handleDefinirPrincipal = async (enderecoId: string) => {
    if (updating) return;
    setUpdating(enderecoId);
    try {
      const resposta = await fetch("/api/enderecos/principal", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enderecoId }),
      });

      if (!resposta.ok) {
        toast.error("Erro ao atualizar endereço");
        return;
      }

      toast.success("Endereço principal atualizado!");
      await refreshCliente();
      setEnderecos(
        enderecos.map((e) => ({
          ...e,
          principal: e.id === enderecoId,
        })),
      );
    } catch {
      toast.error("Erro ao atualizar endereço");
    } finally {
      setUpdating(null);
    }
  };

  if (loading || carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!cliente) {
    return null;
  }

  return (
    <main className="mx-auto min-h-[70vh] max-w-lg px-5 pb-28 pt-5 sm:pt-8">
      <header className="mb-6 flex items-center gap-2">
        <Link prefetch={false}
          href="/perfil/cadastro"
          aria-label="Voltar para Meu cadastro"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-muted"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="min-w-0 flex-1 text-xl font-semibold tracking-tight">
          Meus endereços
        </h1>
        <Link prefetch={false}
          href="/perfil/enderecos/novo"
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md px-1 text-sm font-medium text-primary hover:bg-primary/5"
        >
          <Plus aria-hidden="true" size={16} />
          Adicionar
        </Link>
      </header>
      {!enderecos.length ? (
        <div className="space-y-4 rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Você ainda não cadastrou um endereço.
          </p>
          <Button asChild className="min-h-11 rounded-lg">
            <Link prefetch={false} href="/perfil/enderecos/novo">Adicionar endereço</Link>
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {enderecos.map((endereco) => (
            <li
              key={endereco.id}
              className="rounded-xl border border-border bg-card p-4"
            >
              <div className="mb-2 flex items-center gap-2">
                <h2 className="min-w-0 flex-1 break-words text-sm font-semibold">
                  {endereco.apelido}
                </h2>
                {endereco.principal && (
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                    Principal
                  </span>
                )}
                {(endereco.id !== "endereco-legado" || !endereco.principal) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        disabled={!!removendo || !!updating}
                        aria-label={`Ações do endereço ${endereco.apelido}`}
                        className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                      >
                        <MoreHorizontal size={19} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {endereco.id !== "endereco-legado" && (
                        <DropdownMenuItem asChild>
                          <Link prefetch={false}
                            href={`/perfil/enderecos/${endereco.id}/editar`}
                          >
                            Editar endereço
                          </Link>
                        </DropdownMenuItem>
                      )}
                      {!endereco.principal && (
                        <DropdownMenuItem
                          onSelect={() =>
                            void handleDefinirPrincipal(endereco.id)
                          }
                        >
                          Definir como principal
                        </DropdownMenuItem>
                      )}
                      {endereco.id !== "endereco-legado" && (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => setConfirmRemove(endereco)}
                        >
                          Excluir endereço
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <p className="break-words text-sm text-foreground">
                {endereco.logradouro}
                {endereco.numero ? `, ${endereco.numero}` : ""}
              </p>
              {endereco.complemento && (
                <p className="mt-1 break-words text-sm text-muted-foreground">
                  {endereco.complemento}
                </p>
              )}
              <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">
                {[
                  endereco.bairro,
                  [endereco.cidade, endereco.estado]
                    .filter(Boolean)
                    .join(" / "),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {endereco.cep && (
                <p className="mt-1 text-xs text-muted-foreground">
                  CEP {endereco.cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <AlertDialog
        open={!!confirmRemove}
        onOpenChange={(open) => {
          if (!open && !removendo) setConfirmRemove(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir endereço?</AlertDialogTitle>
            <AlertDialogDescription>
              O endereço {confirmRemove?.apelido} será removido da sua conta.
              Seus pedidos anteriores permanecem inalterados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!removendo}>
              Manter endereço
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!!removendo}
              onClick={(event) => {
                event.preventDefault();
                if (confirmRemove) void handleRemover(confirmRemove.id);
              }}
            >
              {removendo ? "Excluindo…" : "Excluir endereço"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
