"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { StorageImage as Image } from "@/components/ui/storage-image";
import { ChevronRight, Search, Share2, Store, X } from "lucide-react";
import { toast } from "sonner";
import { useLoja } from "@/hooks/useLoja";
import { formatBRL } from "@/data/tipos";

type BuscaProps = {
  /** Campo aberto: a pesquisa cobre o cartão da loja, no topo da tela. */
  buscando: boolean;
  onBuscandoChange: (aberto: boolean) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
};

/** Topo do cardápio: capa + cartão com logo, nome, status, pesquisa e compartilhar. Toque no nome abre /loja. */
export function StoreHero({ busca }: { busca?: BuscaProps } = {}) {
  const { loja, isLoading, error } = useLoja();
  const nome = loja?.nome ?? "Sorvetes Donda";
  const lojaConfirmada = !isLoading && !!loja && !error;
  const estaAberto = lojaConfirmada && loja!.esta_aberto;
  const estaFechado = lojaConfirmada && !loja!.esta_aberto;
  const banner = loja?.banner_url ?? null;
  const logo = loja?.logo_url ?? null;
  const minimo = Number(loja?.pedido_minimo ?? 0);
  const horario = loja?.horario_abertura ? `Abre às ${loja.horario_abertura}` : null;

  const compartilhar = async () => {
    const url = window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({ title: nome, text: `Peça no ${nome}!`, url });
      } catch {
        // compartilhamento cancelado
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link da loja copiado!");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  return (
    <section className="relative">
      <div className="relative h-32 overflow-hidden rounded-[22px] bg-primary/15 sm:h-44 md:h-52">
        {banner ? (
          <Image
            preset="storeBanner"
            src={banner}
            alt={`Capa de ${nome}`}
            fill
            priority
            fetchPriority="high"
            className="object-cover"
          />
        ) : (
          <div className="h-full w-full bg-primary" aria-hidden="true" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" aria-hidden="true" />
        {estaFechado && (
          <div role="status" className="absolute inset-0 flex items-center gap-3 bg-black/65 px-5 text-white sm:px-8">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/80">
              <Store aria-hidden="true" className="h-5 w-5" strokeWidth={1.6} />
            </span>
            <div>
              <p className="text-lg font-semibold leading-tight">Loja fechada</p>
              <p className="text-sm text-white/95">{horario || "Não estamos aceitando pedidos agora."}</p>
            </div>
          </div>
        )}
      </div>

      <div className="relative z-10 mx-3 -mt-8 flex items-center gap-2 rounded-2xl border border-border/70 bg-card p-4 shadow-[0_8px_22px_rgba(31,20,43,0.10)] sm:mx-5">
        <Link
          href="/loja"
          prefetch={false}
          aria-label={`Ver informações de ${nome}`}
          className="group flex min-w-0 flex-1 items-center gap-3.5 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <span className="relative flex h-16 w-16 shrink-0 sm:h-[72px] sm:w-[72px] items-center justify-center overflow-hidden rounded-full border-2 border-card bg-card shadow ring-1 ring-border">
            {logo ? (
              <Image preset="storeLogo" src={logo} alt="" fill sizes="72px" className="object-cover" />
            ) : (
              <span className="text-2xl font-bold text-primary">{nome.charAt(0)}</span>
            )}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-0.5">
              <span className="truncate text-lg font-bold leading-tight tracking-[-0.02em] text-foreground sm:text-xl">
                {nome}
              </span>
              <ChevronRight
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
              />
            </span>
            {(estaAberto || minimo > 0) && (
              <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
                {estaAberto && (
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Aberto agora
                  </span>
                )}
                {minimo > 0 && (
                  <>
                    {estaAberto && <span aria-hidden="true">·</span>}
                    <span>Mínimo {formatBRL(minimo)}</span>
                  </>
                )}
              </span>
            )}
          </span>
        </Link>

        <AcoesCartao busca={busca} onCompartilhar={() => void compartilhar()} />
      </div>
    </section>
  );
}

/** Pesquisa + compartilhar no cartão da loja. Aberta, a pesquisa cobre o cartão. */
function AcoesCartao({ busca, onCompartilhar }: { busca?: BuscaProps; onCompartilhar: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const botaoBuscaRef = useRef<HTMLButtonElement>(null);
  const montado = useRef(false);
  const buscando = busca?.buscando ?? false;

  useEffect(() => {
    // Foco no campo ao abrir; ao fechar, volta para a lupa (não na carga inicial).
    if (buscando) inputRef.current?.focus();
    else if (montado.current) botaoBuscaRef.current?.focus();
    montado.current = true;
  }, [buscando]);

  const fecharBusca = () => {
    busca?.onSearchChange("");
    busca?.onBuscandoChange(false);
  };

  return (
    <>
      {busca && (
        <button
          ref={botaoBuscaRef}
          type="button"
          onClick={() => busca.onBuscandoChange(true)}
          aria-label="Pesquisar produtos"
          aria-expanded={buscando}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:opacity-95 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Search aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onCompartilhar}
        aria-label="Compartilhar loja"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground/80 transition hover:bg-muted active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Share2 aria-hidden="true" className="h-4 w-4" />
      </button>

      {busca && buscando && (
        <div className="absolute inset-0 flex items-center rounded-2xl bg-card p-4">
          <div className="relative w-full">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
            <input
              ref={inputRef}
              type="search"
              value={busca.searchQuery}
              onChange={(e) => busca.onSearchChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") fecharBusca(); }}
              placeholder="Pesquisar no cardápio…"
              aria-label="Pesquisar produtos"
              className="h-11 w-full rounded-full border border-primary/40 bg-card pl-10 pr-11 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/25"
            />
            <button
              type="button"
              onClick={fecharBusca}
              aria-label="Fechar pesquisa"
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
