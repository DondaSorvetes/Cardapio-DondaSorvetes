"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, MapPin, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { ItemMenu } from "@/components/cliente/perfil/MenuPerfil";
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

/** "Meu cadastro": perfil, endereços e exclusão da conta. */
export default function PaginaMeuCadastro() {
  const { cliente, loading, signOut } = useAuth();
  const router = useRouter();
  const [confirmar, setConfirmar] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState("");
  // Depois de excluir, vai para o início (não para /entrar).
  const contaExcluida = useRef(false);

  useEffect(() => {
    if (!loading && !cliente && !contaExcluida.current) router.push("/entrar");
  }, [loading, cliente, router]);

  const excluirConta = async () => {
    if (excluindo) return;
    setExcluindo(true);
    setErro("");
    try {
      const res = await fetch("/api/clientes/excluir", { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { erro?: string };
      if (!res.ok) {
        setErro(data.erro || "Não foi possível excluir sua conta. Tente novamente.");
        return;
      }
      contaExcluida.current = true;
      // Limpa sessão, sacola e dados locais do cliente.
      await signOut().catch(() => undefined);
      setConfirmar(false);
      toast.success("Sua conta foi excluída");
      router.replace("/");
    } catch {
      setErro("Não foi possível concluir. Confira sua conexão e tente novamente.");
    } finally {
      setExcluindo(false);
    }
  };

  if (!loading && !cliente) return null;

  return (
    <div className="min-h-[70vh] bg-background">
      <div className="mx-auto max-w-lg pb-28">
        <header className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-5">
          <Link
            prefetch={false}
            href="/perfil"
            aria-label="Voltar para a conta"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:opacity-95 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-bold tracking-[-0.02em] text-foreground">Meu cadastro</h1>
        </header>

        <ul className="divide-y divide-border border-b border-border">
          <ItemMenu href="/perfil/dados-pessoais" label="Perfil" descricao="Nome e telefone" icon={User} />
          <ItemMenu href="/perfil/enderecos" label="Endereço" descricao="Onde receber seus pedidos" icon={MapPin} />
          <li>
            <button
              type="button"
              onClick={() => { setErro(""); setConfirmar(true); }}
              disabled={!cliente}
              className="flex min-h-[52px] w-full items-center gap-3.5 px-4 py-3 text-left text-destructive transition hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-destructive disabled:opacity-50 sm:px-5"
            >
              <Trash2 aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={1.6} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Excluir minha conta</span>
                <span className="block text-xs text-muted-foreground">Apaga seu cadastro e seus endereços</span>
              </span>
            </button>
          </li>
        </ul>
      </div>

      <AlertDialog open={confirmar} onOpenChange={(aberto) => { if (!excluindo) setConfirmar(aberto); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sua conta?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Seu nome, telefone e endereços salvos serão apagados e você sairá da conta.
                  Isso não pode ser desfeito.
                </p>
                <p>
                  Seus pedidos antigos ficam no histórico da loja, sem seus dados pessoais.
                  Para pedir de novo, basta criar uma nova conta.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          {erro && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {erro}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={excluindo}
              onClick={(event) => { event.preventDefault(); void excluirConta(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluindo && <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}
              {excluindo ? "Excluindo…" : "Excluir conta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
