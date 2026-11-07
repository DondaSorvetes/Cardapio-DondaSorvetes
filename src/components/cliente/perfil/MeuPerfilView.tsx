"use client";

import { useRouter } from "next/navigation";
import { ClipboardList, LogOut, Ticket, User, UserCog } from "lucide-react";
import { toast } from "sonner";
import type { Endereco } from "@/types/endereco";
import { useClientePedidosCount } from "@/hooks/useClientePedidos";
import { DesenvolvidoPor, ItemMenu, TituloSecao } from "./MenuPerfil";

type ClienteFull = {
  id: string;
  nome: string | null;
  telefone: string | null;
  endereco: string | null;
  enderecos_adicionais?: Endereco[] | string | null;
  created_at?: string;
  email?: string | null;
};

/** Tela "Conta": saudação, atalhos da conta, pedidos/cupons, sair e "Desenvolvido por". */
export function MeuPerfilView({
  cliente,
  onSignOut,
}: {
  cliente: ClienteFull;
  onRefresh: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const router = useRouter();
  const { count: pedidosCount, loading: loadingPedidos } = useClientePedidosCount(cliente.id);
  const pedidosDescricao = loadingPedidos
    ? undefined
    : pedidosCount === 0
      ? "Nenhum pedido ainda"
      : `${pedidosCount} pedido${pedidosCount === 1 ? "" : "s"}`;

  const sair = async () => {
    await onSignOut();
    toast.success("Você saiu da conta");
    router.push("/");
  };

  return (
    <div className="min-h-[70vh] bg-background">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-lg flex-col pb-24 md:pb-8">
        {/* Saudação */}
        <section className="flex items-center gap-3.5 px-4 pb-5 pt-6 sm:px-5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <User aria-hidden="true" className="h-6 w-6" strokeWidth={1.6} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-primary">Olá,</p>
            <h1 className="truncate text-lg font-bold tracking-[-0.02em] text-foreground">
              {cliente.nome || "Cliente"}
            </h1>
          </div>
        </section>

        <div className="border-t border-border" />

        <TituloSecao>Sua conta</TituloSecao>
        <ul>
          <ItemMenu href="/perfil/cadastro" label="Meu cadastro" icon={UserCog} />
        </ul>

        <TituloSecao>Pedidos &amp; vantagens</TituloSecao>
        <ul>
          <ItemMenu href="/pedidos" label="Meus pedidos" descricao={pedidosDescricao} icon={ClipboardList} />
          <ItemMenu href="/cupons" label="Cupons de desconto" icon={Ticket} />
        </ul>

        <div className="mt-3 border-t border-border" />

        <button
          type="button"
          onClick={() => void sair()}
          className="flex min-h-[52px] items-center gap-3.5 px-4 py-3 text-left text-sm font-medium text-primary transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-5"
        >
          <LogOut aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={1.6} />
          Sair
        </button>

        <div className="mt-auto">
          <DesenvolvidoPor />
        </div>
      </div>
    </div>
  );
}
