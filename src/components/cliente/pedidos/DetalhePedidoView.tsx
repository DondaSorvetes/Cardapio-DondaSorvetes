"use client";

import { rotuloPagamento } from "@/lib/pagamento";
import { StorageImage as Image } from "@/components/ui/storage-image";

import Link from "next/link";
import {
  ArrowLeft,
  Bike,
  Check,
  CalendarClock,
  CreditCard,
  MapPin,
  Package,
  Store,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/data/tipos";
import { extractComplementos, groupComplementos } from "@/lib/utils/pedido";
import {
  useClientePedido,
  type ClientePedido,
} from "@/hooks/useClientePedidos";
import { formatarAgendamento } from "@/lib/retirada";

const etapasEntrega = [
  { label: "Pedido recebido", detalhe: "A loja confirmou seu pedido" },
  { label: "Em preparo", detalhe: "Seu pedido está sendo preparado" },
  { label: "Saiu para entrega", detalhe: "O entregador está a caminho" },
  { label: "Entregue", detalhe: "Bom apetite!" },
];

// Retirada: o status "saiu_entrega" significa "pronto para retirada".
const etapasRetirada = [
  { label: "Pedido recebido", detalhe: "A loja recebeu seu pedido" },
  { label: "Em preparo", detalhe: "Seu pedido está sendo preparado" },
  { label: "Pronto para retirada", detalhe: "Pode vir buscar no balcão" },
  { label: "Retirado", detalhe: "Bom apetite!" },
];

const progresso: Record<string, number> = {
  pendente: 0,
  confirmado: 0,
  preparando: 1,
  saiu_entrega: 2,
  entregue: 3,
};

function formatarEndereco(pedido: ClientePedido) {
  const endereco = pedido.endereco_completo;
  if (!endereco) {
    return pedido.tipo_entrega === "entrega" ||
      pedido.tipo_entrega === "delivery"
      ? "Endereço não informado"
      : "Retirada no estabelecimento";
  }
  if (typeof endereco === "string") return endereco;

  const rua = [endereco.logradouro, endereco.numero].filter(Boolean).join(", ");
  return [rua, endereco.complemento, endereco.bairro, endereco.cidade]
    .filter(Boolean)
    .join(" — ");
}

export function DetalhePedidoView({
  clienteId,
  pedidoId,
}: {
  clienteId: string;
  pedidoId: string;
}) {
  const { pedido, loading, error } = useClientePedido(clienteId, pedidoId);

  if (loading) {
    return (
      <main className="min-h-[70vh] bg-[#FDF9F9] px-4 py-8 pb-28">
        <div className="mx-auto max-w-xl animate-pulse space-y-5">
          <div className="h-5 w-32 rounded bg-[#F0E2E7]" />
          <div className="h-20 rounded-2xl bg-white" />
          <div className="h-56 rounded-2xl bg-white" />
        </div>
      </main>
    );
  }

  if (!pedido) {
    return (
      <main className="min-h-[70vh] bg-[#FDF9F9] px-4 py-7 pb-28 text-[#2A1A22]">
        <div className="mx-auto max-w-xl">
          <Link
            href="/pedidos"
            className="inline-flex items-center gap-2 text-sm text-[#6F6479] hover:text-[#a82152] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B3FA0]"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Meus pedidos
          </Link>
          <p role="alert" className="mt-8 text-sm text-[#6F6479]">
            {error || "Não encontramos este pedido."}
          </p>
        </div>
      </main>
    );
  }

  const atual = progresso[pedido.status] ?? 0;
  const entrega =
    pedido.tipo_entrega === "entrega" || pedido.tipo_entrega === "delivery";
  const etapas = entrega ? etapasEntrega : etapasRetirada;
  const agendamento = entrega ? null : formatarAgendamento(pedido.agendado_para);

  return (
    <main className="min-h-[70vh] bg-[#FDF9F9] pb-28 text-[#2A1A22]">
      <div className="mx-auto max-w-xl px-4 py-6 sm:py-8">
        <Link
          href="/pedidos"
          className="inline-flex items-center gap-2 text-sm text-[#6F6479] transition-colors hover:text-[#a82152] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B3FA0]"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Meus pedidos
        </Link>

        <header className="mt-5 border-b border-[#F0E2E7] pb-5">
          <h1 className="text-2xl font-bold tracking-[-0.025em] sm:text-[28px]">
            Pedido #{pedido.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="mt-1 text-sm text-[#86687A]">
            {format(new Date(pedido.created_at), "dd 'de' MMM. 'às' HH:mm", {
              locale: ptBR,
            })}
          </p>
        </header>

        {pedido.status === "cancelado" ? (
          <div className="my-5 flex items-center gap-3 rounded-2xl border border-[#F0E2E7] bg-white px-4 py-3.5 text-sm text-[#6F6479]">
            <X aria-hidden="true" className="h-4 w-4 text-[#86687A]" />
            Este pedido foi cancelado.
          </div>
        ) : (
          <section
            aria-labelledby="acompanhamento"
            className="border-b border-[#F0E2E7] py-6"
          >
            <h2
              id="acompanhamento"
              className="mb-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#86687A]"
            >
              Acompanhamento
            </h2>
            <ol className="space-y-0">
              {etapas.map((etapa, index) => {
                const concluida = index <= atual;
                return (
                  <li
                    key={etapa.label}
                    className="relative flex gap-3.5 pb-5 last:pb-0"
                  >
                    {index < etapas.length - 1 && (
                      <span
                        aria-hidden="true"
                        className={`absolute left-[15px] top-8 h-[calc(100%-12px)] w-px ${index < atual ? "bg-[#D13469]" : "bg-[#F0E2E7]"}`}
                      />
                    )}
                    <span
                      className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${concluida ? "border-[#D13469] bg-[#D13469] text-white" : "border-[#F0E2E7] bg-[#FDF9F9] text-[#B6AABD]"}`}
                    >
                      {concluida ? (
                        <Check aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-current" />
                      )}
                    </span>
                    <div className="pt-1">
                      <p
                        className={`text-sm font-medium ${concluida ? "text-[#2A1A22]" : "text-[#86687A]"}`}
                      >
                        {etapa.label}
                      </p>
                      <p className="mt-0.5 text-xs text-[#86687A]">
                        {etapa.detalhe}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {!entrega && pedido.status !== "cancelado" && pedido.status !== "entregue" && (
          <div className="flex items-center gap-3 border-b border-[#F0E2E7] py-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#F0E2E7] text-[#D13469]">
              {agendamento ? <CalendarClock aria-hidden="true" className="h-5 w-5" /> : <Store aria-hidden="true" className="h-5 w-5" />}
            </span>
            <div>
              <p className="text-sm font-medium">
                {pedido.status === "saiu_entrega"
                  ? "Seu pedido está pronto!"
                  : agendamento
                    ? `Retirada agendada: ${agendamento}`
                    : "Retirada assim que ficar pronto"}
              </p>
              <p className="text-xs text-[#86687A]">
                {pedido.status === "saiu_entrega"
                  ? "Pode vir retirar no balcão do estabelecimento."
                  : "Avisaremos aqui quando estiver pronto para retirada."}
              </p>
            </div>
          </div>
        )}

        {entrega && pedido.status === "saiu_entrega" && (
          <div className="flex items-center gap-3 border-b border-[#F0E2E7] py-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#F0E2E7] text-[#D13469]">
              <Bike aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium">Entrega a caminho</p>
              <p className="text-xs text-[#86687A]">
                {pedido.entregador_nome
                  ? `${pedido.entregador_nome} está levando seu pedido até você.`
                  : "Estamos levando seu pedido até você."}
              </p>
            </div>
          </div>
        )}

        {pedido.status === "entregue" && pedido.entregador_nome && (
          <div className="flex items-center gap-3 border-b border-[#F0E2E7] py-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#F0E2E7] text-[#D13469]">
              <Bike aria-hidden="true" className="h-5 w-5" />
            </span>
            <p className="text-sm text-[#86687A]">
              Entregue por <span className="font-medium text-[#2A1A22]">{pedido.entregador_nome}</span>
            </p>
          </div>
        )}

        <section className="border-b border-[#F0E2E7] py-6">
          <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#86687A]">
            Itens do pedido
          </h2>
          <div className="space-y-3">
            {pedido.itens?.map((item, index) => {
              const complementos = groupComplementos(extractComplementos(item));
              return (
                <div
                  key={item.uid || index}
                  className="flex gap-3 border-b border-[#F0E2E7] pb-3 last:border-0 last:pb-0"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F1EAF8] text-[#D13469]">
                    {item.produto?.image ? (
                      <Image
                        src={item.produto.image}
                        alt={item.produto.name || ""}
                        width={56}
                        height={56}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package aria-hidden="true" className="h-6 w-6" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-3">
                      <p className="text-sm font-medium">
                        {item.qty}x {item.produto?.name}
                      </p>
                      <p className="shrink-0 text-sm tabular-nums">
                        {formatBRL(Number(item.total))}
                      </p>
                    </div>
                    {complementos.map((grupo, grupoIndex) => (
                      <p
                        key={grupoIndex}
                        className="mt-1 text-xs text-[#86687A]"
                      >
                        {grupo.items.map((opcao) => opcao.name).join(" · ")}
                      </p>
                    ))}
                    {typeof item.colher === "boolean" && (
                      <p className="mt-1 text-xs text-[#86687A]">
                        {item.colher ? "Com colher" : "Sem colher"}
                      </p>
                    )}
                    {item.observacoes && (
                      <p className="mt-1 text-xs text-[#86687A]">
                        Obs: {item.observacoes}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="border-b border-[#F0E2E7] py-5">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#86687A]">
            Resumo
          </h2>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-[#86687A]">Subtotal</span>
              <span className="tabular-nums">
                {formatBRL(Number(pedido.subtotal))}
              </span>
            </div>
            {Number(pedido.taxa_entrega) > 0 ? (
              <div className="flex justify-between">
                <span className="text-[#86687A]">Taxa de entrega</span>
                <span className="tabular-nums">
                  {formatBRL(Number(pedido.taxa_entrega))}
                </span>
              </div>
            ) : entrega ? (
              <div className="flex justify-between">
                <span className="text-[#86687A]">Entrega</span>
                <span className="font-medium text-[#a82152]">Grátis</span>
              </div>
            ) : null}
            {pedido.troco_para != null && Number(pedido.troco_para) > 0 && (
              <div className="flex justify-between">
                <span className="text-[#86687A]">Troco para</span>
                <span>{formatBRL(Number(pedido.troco_para))}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[#F0E2E7] pt-3 text-base font-bold">
              <span>Total</span>
              <span className="tabular-nums">
                {formatBRL(Number(pedido.total))}
              </span>
            </div>
          </div>
        </section>

        <section className="space-y-4 py-5">
          <div className="flex gap-3">
            <MapPin
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-[#86687A]"
            />
            <div>
              <p className="text-sm font-medium">
                {entrega ? "Endereço de entrega" : agendamento ? `Retirada agendada · ${agendamento}` : "Retirada · Agora"}
              </p>
              <p className="mt-0.5 text-sm text-[#86687A]">
                {formatarEndereco(pedido)}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <CreditCard
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-[#86687A]"
            />
            <div>
              <p className="text-sm font-medium">Pagamento</p>
              <p className="mt-0.5 text-sm text-[#86687A]">
                {rotuloPagamento(pedido.meio_pagamento)}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
