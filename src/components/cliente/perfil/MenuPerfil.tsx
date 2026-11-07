import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ElementType, ReactNode } from "react";

/** Título de seção da lista do perfil ("SUA CONTA", "PEDIDOS & VANTAGENS"…). */
export function TituloSecao({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-4 pb-1 pt-5 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground sm:px-5">
      {children}
    </h2>
  );
}

/** Linha da lista do perfil: ícone, texto e seta. */
export function ItemMenu({
  href,
  label,
  descricao,
  icon: Icon,
}: {
  href: string;
  label: string;
  descricao?: string;
  icon: ElementType;
}) {
  return (
    <li>
      <Link
        prefetch={false}
        href={href}
        className="flex min-h-[52px] items-center gap-3.5 px-4 py-3 text-foreground transition hover:bg-muted/50 active:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-5"
      >
        <Icon aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={1.6} />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{label}</span>
          {descricao && (
            <span className="block truncate text-xs text-muted-foreground">{descricao}</span>
          )}
        </span>
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

const versao = process.env.NEXT_PUBLIC_APP_VERSION;

/** Rodapé "Desenvolvido por" com a assinatura do desenvolvedor. */
export function DesenvolvidoPor() {
  return (
    <footer className="flex flex-col items-center gap-2 px-4 pb-1 pt-10 text-center">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Desenvolvido por
      </p>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-[-0.01em] text-foreground">
          Matheus Terradas
        </p>
        <p className="text-xs text-muted-foreground">Desenvolvedor</p>
        {versao && (
          <p className="mt-1 text-[11px] text-muted-foreground/80">
            v{versao} · {new Date().getFullYear()}
          </p>
        )}
      </div>
    </footer>
  );
}
