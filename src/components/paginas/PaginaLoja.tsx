"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bike,
  CircleDollarSign,
  Clock,
  Instagram,
  MapPin,
  MessageCircle,
  PhoneCall,
  ShoppingBag,
} from "lucide-react";
import { StorageImage as Image } from "@/components/ui/storage-image";
import { useLoja, type ConfiguracoesLoja } from "@/hooks/useLoja";
import { formatBRL } from "@/data/tipos";
import { parseDiasFuncionamento } from "@/types/configuracoes";
import { cn } from "@/lib/utils";

// Ordem da tela: domingo primeiro, como na referência.
const DIAS = [
  { value: "domingo", curto: "DOM" },
  { value: "segunda", curto: "SEG" },
  { value: "terca", curto: "TER" },
  { value: "quarta", curto: "QUA" },
  { value: "quinta", curto: "QUI" },
  { value: "sexta", curto: "SEX" },
  { value: "sabado", curto: "SÁB" },
] as const;

const hora = (valor?: string | null) => (valor ? valor.slice(0, 5) : null);

/** Índice do dia da semana (0 = domingo) no fuso da loja. */
function diaDeHoje() {
  const nome = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Sao_Paulo" }).format(new Date());
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(nome);
}

export default function PaginaLoja({ detalhesIniciais = null }: { detalhesIniciais?: Partial<ConfiguracoesLoja> | null }) {
  const router = useRouter();
  const { loja: resumo, isLoading } = useLoja();
  const [detalhes, setDetalhes] = useState<Partial<ConfiguracoesLoja> | null>(detalhesIniciais);
  const [hoje, setHoje] = useState(-1);

  useEffect(() => {
    setHoje(diaDeHoje());
    if (detalhesIniciais) return;
    let ativo = true;
    void fetch("/api/loja/detalhes", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((dados: { detalhes: Partial<ConfiguracoesLoja> | null } | null) => {
        if (ativo && dados?.detalhes) setDetalhes(dados.detalhes);
      })
      .catch(() => undefined);
    return () => { ativo = false; };
  }, [detalhesIniciais]);

  const voltar = () => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  };

  if (!resumo) {
    return (
      <div role="status" className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        {isLoading ? "Carregando informações da loja…" : "Não foi possível carregar as informações da loja."}
      </div>
    );
  }

  const loja = { ...resumo, ...detalhes };
  const nome = loja.nome ?? "Sorvetes Donda";
  const endereco = [loja.endereco, loja.cidade, loja.estado].filter(Boolean).join(" - ");
  const tempo = loja.tempo_entrega_min != null && loja.tempo_entrega_max != null ? `${loja.tempo_entrega_min}–${loja.tempo_entrega_max} min` : null;
  const taxa = Number(loja.taxa_entrega ?? 0);
  const minimo = Number(loja.pedido_minimo ?? 0);
  const diasAbertos = parseDiasFuncionamento(loja.dias_funcionamento);
  const abertura = hora(loja.horario_abertura);
  const fechamento = hora(loja.horario_fechamento);
  const faixaHorario = abertura && fechamento ? `${abertura} às ${fechamento}` : abertura ? `A partir das ${abertura}` : null;
  const telefone = loja.telefone?.trim();
  const whatsapp = loja.whatsapp?.replace(/\D/g, "");
  const instagram = loja.instagram?.replace(/^@/, "").trim();
  const mapaQuery = encodeURIComponent(endereco || nome);

  return (
    <main className="mx-auto w-full max-w-3xl bg-background">
      {/* Capa + logo + nome */}
      <section className="relative">
        <div className="relative h-52 overflow-hidden bg-primary sm:h-64 md:rounded-b-none md:rounded-t-2xl">
          {loja.banner_url && (
            <Image preset="storeBanner" src={loja.banner_url} alt={`Capa de ${nome}`} fill priority className="object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-primary/60" aria-hidden="true" />
          <button
            type="button"
            onClick={voltar}
            aria-label="Voltar"
            className="absolute left-4 top-[max(1rem,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-primary text-primary-foreground shadow-md transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>
        <div className="relative bg-primary px-5 pb-6 pt-16 text-center text-primary-foreground">
          <div className="absolute left-1/2 top-0 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full border-4 border-primary bg-card shadow-lg">
            {loja.logo_url ? (
              <Image preset="storeLogo" src={loja.logo_url} alt={`Logo de ${nome}`} fill sizes="112px" className="object-cover" />
            ) : (
              <span className="text-4xl font-bold text-primary">{nome.charAt(0)}</span>
            )}
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">{nome}</h1>
          {loja.descricao && <p className="mx-auto mt-1.5 max-w-md text-sm text-primary-foreground/90">{loja.descricao}</p>}
        </div>
      </section>

      {/* Resumo de entrega */}
      <div className="flex flex-wrap justify-center gap-2 border-b border-border bg-muted/60 px-4 py-4">
        <Chip icon={Bike}>{taxa === 0 ? "Entrega grátis" : `Entrega ${formatBRL(taxa)}`}</Chip>
        {tempo && <Chip icon={Clock}>{tempo}</Chip>}
        {minimo > 0 && <Chip icon={CircleDollarSign}>Mínimo {formatBRL(minimo)}</Chip>}
      </div>

      <div className="divide-y divide-border">
        {/* Opções de entrega */}
        <section className="px-4 py-5">
          <h2 className="text-lg font-bold text-foreground">Opções de entrega</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <OpcaoEntrega icon={Bike} titulo="Delivery" detalhe={tempo ?? undefined} />
            <OpcaoEntrega icon={ShoppingBag} titulo="Retirada" detalhe="Sem taxa" />
          </div>
        </section>

        {/* Localização */}
        {endereco && (
          <section className="py-5">
            <h2 className="px-4 text-lg font-bold text-foreground">Localização</h2>
            <div className="mt-3 h-52 w-full overflow-hidden bg-muted sm:mx-4 sm:w-auto sm:rounded-xl">
              <iframe
                title={`Mapa: ${endereco}`}
                src={`https://www.google.com/maps?q=${mapaQuery}&output=embed`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full w-full border-0"
              />
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapaQuery}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mx-4 mt-4 flex items-start gap-3 rounded-lg text-sm text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <MapPin aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{endereco}</span>
            </a>
          </section>
        )}

        {/* Contato */}
        {(telefone || whatsapp || instagram) && (
          <section className="space-y-1 px-4 py-4">
            {telefone && (
              <a href={`tel:${telefone.replace(/[^\d+]/g, "")}`} className="flex min-h-11 items-center gap-3 text-sm text-foreground hover:text-primary">
                <PhoneCall aria-hidden="true" className="h-5 w-5 shrink-0" />
                {telefone}
              </a>
            )}
            {whatsapp && (
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-3 text-sm text-foreground hover:text-primary">
                <MessageCircle aria-hidden="true" className="h-5 w-5 shrink-0" />
                WhatsApp
              </a>
            )}
            {instagram && (
              <a href={`https://instagram.com/${instagram}`} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-3 text-sm text-foreground hover:text-primary">
                <Instagram aria-hidden="true" className="h-5 w-5 shrink-0" />
                @{instagram}
              </a>
            )}
          </section>
        )}

        {/* Horário de funcionamento */}
        <section className="px-4 py-5">
          <h2 className="text-lg font-bold text-foreground">Horário de funcionamento</h2>
          <span
            className={cn(
              "mt-3 inline-flex rounded-full px-3.5 py-1.5 text-xs font-semibold",
              loja.esta_aberto ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800",
            )}
          >
            {loja.esta_aberto ? "Aberto agora" : "Fechado agora"}
          </span>
          {diasAbertos.length > 0 || faixaHorario ? (
            <dl className="mt-3 space-y-1.5 text-sm">
              {DIAS.map((dia, indice) => {
                const aberto = diasAbertos.length === 0 || diasAbertos.includes(dia.value);
                const ehHoje = indice === hoje;
                return (
                  <div key={dia.value} className={cn("flex gap-4", ehHoje ? "font-bold text-foreground" : "text-foreground/80")}>
                    <dt className="w-10 shrink-0">{dia.curto}</dt>
                    <dd>{aberto ? faixaHorario ?? "Aberto" : "Fechado"}{ehHoje && <span className="sr-only"> (hoje)</span>}</dd>
                  </div>
                );
              })}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Horários não informados.</p>
          )}
        </section>

        {/* Formas de pagamento */}
        <section className="px-4 py-5">
          <h2 className="text-lg font-bold text-foreground">Formas de pagamento</h2>
          <p className="mt-3 text-sm text-foreground/80">Na entrega ou retirada:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {["Dinheiro", "PIX", "Cartão"].map((forma) => (
              <span key={forma} className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-foreground">
                {forma}
              </span>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Chip({ icon: Icon, children }: { icon: typeof Bike; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground shadow-sm">
      <Icon aria-hidden="true" className="h-4 w-4 text-primary" />
      {children}
    </span>
  );
}

function OpcaoEntrega({ icon: Icon, titulo, detalhe }: { icon: typeof Bike; titulo: string; detalhe?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-5 text-center shadow-sm">
      <Icon aria-hidden="true" className="h-7 w-7 text-primary" strokeWidth={1.75} />
      <span className="text-sm font-semibold text-foreground">{titulo}</span>
      {detalhe && <span className="-mt-1 text-xs text-muted-foreground">{detalhe}</span>}
    </div>
  );
}
