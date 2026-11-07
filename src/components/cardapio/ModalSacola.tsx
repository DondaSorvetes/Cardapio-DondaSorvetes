"use client";
import { invalidateCustomerResources } from "@/lib/customer-resource";

import { useMenu } from "@/hooks/useCardapio";

import {
  AlarmClock,
  ArrowLeft,
  Banknote,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  CreditCard,
  Hash,
  Pencil,
  MapPin,
  QrCode,
  ShoppingBag,
  Store,
  Trash2,
  Truck,
  User,
  X,
} from "lucide-react";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { StorageImage as Image } from "@/components/ui/storage-image";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useCarrinho, type ItemCarrinho } from "@/context/CarrinhoContext";
import { resolveSelectionsFromProduct } from "@/lib/utils/pedido";
import { useLoja } from "@/hooks/useLoja";
import { formatBRL, getProductUnitPrice } from "@/data/tipos";
import { useAuth } from "@/context/AuthContext";
import { Input } from "@/components/ui/input";
import { customerAddresses } from "@/lib/enderecos-cliente";
import type { Endereco } from "@/types/endereco";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { guardarCupomPendente, lerCupomPendente, limparCupomPendente } from "@/lib/cupom-pendente";
import { MEIOS_PAGAMENTO, rotuloPagamento, type MeioPagamento } from "@/lib/pagamento";
import { formatarAgendamento, gerarDiasAgendamento, type DiaAgendamento } from "@/lib/retirada";

const AVISO_AUTOMATICO = "Ele será aplicado automaticamente quando a sacola atingir esse valor.";

type Etapa = "cart" | "entrega" | "retirada" | "payment";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const ICONE_PAGAMENTO: Record<MeioPagamento, { Icone: typeof Banknote; cor: string }> = {
  dinheiro: { Icone: Banknote, cor: "bg-emerald-100 text-emerald-700" },
  pix: { Icone: QrCode, cor: "bg-teal-100 text-teal-700" },
  debito: { Icone: CreditCard, cor: "bg-sky-100 text-sky-700" },
  credito: { Icone: CreditCard, cor: "bg-pink-100 text-pink-700" },
};

/** "R$ 50,00" / "50" / "50.5" → 50 / 50.5; vazio ou inválido → null. */
function valorTroco(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.]/g, "");
  if (!limpo) return null;
  // Vírgula é o separador decimal; pontos antes dela são milhar.
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const valor = Number(normalizado);
  return Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) / 100 : null;
}

function linhaEndereco(endereco: Endereco) {
  return [
    `${endereco.logradouro}, ${endereco.numero}${endereco.complemento ? ` - ${endereco.complemento}` : ""}`,
    [endereco.bairro, [endereco.cidade, endereco.estado].filter(Boolean).join("/")].filter(Boolean).join(" - "),
  ];
}

export function ModalSacola({ open, onOpenChange }: Props) {
  const { itens, adicionarItem, removerItem, limpar, subtotal, cupomAplicado, setCupomAplicado } = useCarrinho();
  const { loja, isLoading: lojaLoading, error: lojaError, refresh: refreshLoja } = useLoja();
  const { cliente, session, loading } = useAuth();
  const [step, setStep] = useState<Etapa>("cart");
  const router = useRouter();

  const [enderecoSelecionado, setEnderecoSelecionado] = useState<string>("");
  const [enderecosDisponiveis, setEnderecosDisponiveis] = useState<Endereco[]>([]);
  const [tipoEntrega, setTipoEntrega] = useState<"entrega" | "retirada">("entrega");
  // Retirada: "agora" (agendadoPara null) ou janela agendada (ISO do início).
  const [modoRetirada, setModoRetirada] = useState<"agora" | "agendar">("agora");
  const [agendadoPara, setAgendadoPara] = useState<string | null>(null);
  const [agendaAberta, setAgendaAberta] = useState(false);
  const [diasAgenda, setDiasAgenda] = useState<DiaAgendamento[]>([]);
  const [diaAgenda, setDiaAgenda] = useState("");
  const [horarioAgenda, setHorarioAgenda] = useState<string | null>(null);
  const [meioPagamento, setMeioPagamento] = useState<MeioPagamento | null>(null);
  const [trocoPara, setTrocoPara] = useState("");
  const [cep, setCep] = useState("");
  const [enviandoPedido, setEnviandoPedido] = useState(false);
  const [codigoCupom, setCodigoCupom] = useState("");
  const [cupomAberto, setCupomAberto] = useState(false);
  const cupomRequest = useRef(0);
  const checkoutLock = useRef(false);
  const checkoutAttempt = useRef<{ body: string; key: string } | null>(null);
  const resumeChecked = useRef(false);
  const [validandoCupom, setValidandoCupom] = useState(false);
  const [erroCupom, setErroCupom] = useState("");

  const nome = cliente?.nome ?? "";
  const telefone = cliente?.telefone ?? "";

  const { categories: currentCategories, isLoading: menuLoading } = useMenu();
  const temFreteGratis = itens.some(item => menuLoading ? item.produto.freteGratis : currentCategories.some(category => category.products.some(product => product.id === item.produto.id && product.disponivel !== false && product.freteGratis)));
  const taxaEntrega = temFreteGratis ? 0 : (loja?.taxa_entrega ?? 3);
  const frete = tipoEntrega === "entrega" ? taxaEntrega : 0;
  const descontoCupom = cupomAplicado?.desconto ?? 0;
  const totalProdutos = Math.max(0, subtotal - descontoCupom);
  const total = totalProdutos + frete;

  // Última combinação cupom+subtotal já confirmada pelo servidor (evita revalidar à toa).
  const cupomValidado = useRef("");

  useEffect(() => {
    const code = cupomAplicado?.codigo;
    if (!code || !open) { setValidandoCupom(false); return; }
    if (cupomValidado.current === `${code}:${subtotal}`) { setValidandoCupom(false); return; }
    const request = ++cupomRequest.current;
    setValidandoCupom(true);
    setErroCupom("");
    let active = true;
    // Espera o subtotal parar de mudar (ex.: remover vários itens) antes de revalidar.
    const timer = window.setTimeout(() => void fetch("/api/cupons/validar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: code, subtotal }),
    }).then(async (resposta) => {
      const dados = await resposta.json();
      if (!active || request !== cupomRequest.current) return;
      if (resposta.status === 429) {
        // Limite de tentativas: mantém o cupom; o pedido é validado de novo no servidor.
        setErroCupom("Muitas tentativas seguidas. Aguarde alguns segundos para atualizar o desconto.");
        return;
      }
      if (!resposta.ok) {
        setCupomAplicado(null);
        if (dados.codigo === "MINIMO") {
          // Abaixo do mínimo: o cupom espera e volta sozinho quando o subtotal atingir o valor.
          guardarCupomPendente(code);
          setCodigoCupom(code);
          setErroCupom(`${dados.erro} ${AVISO_AUTOMATICO}`);
        } else {
          setCodigoCupom("");
          setErroCupom(dados.erro || "O cupom não se aplica mais ao valor da sacola.");
        }
        return;
      }
      cupomValidado.current = `${dados.cupom.codigo}:${subtotal}`;
      setCupomAplicado(dados.cupom);
    }).catch(() => {
      // Falha de rede: mantém o cupom e avisa; o servidor confere tudo ao finalizar.
      if (active && request === cupomRequest.current) {
        setErroCupom("Não foi possível atualizar o desconto agora. Confira sua conexão.");
      }
    }).finally(() => { if (active && request === cupomRequest.current) setValidandoCupom(false); }), 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [subtotal, cupomAplicado?.codigo, open, setCupomAplicado]);

  const aplicarCupom = async (codigo: string = codigoCupom) => {
    const request = ++cupomRequest.current;
    setValidandoCupom(true);
    setErroCupom("");
    try {
      const resposta = await fetch("/api/cupons/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, subtotal }),
      });
      const dados = await resposta.json();
      if (request !== cupomRequest.current) return;
      if (resposta.status === 429) {
        setErroCupom("Muitas tentativas seguidas. Aguarde alguns segundos e tente de novo.");
        return;
      }
      if (!resposta.ok) {
        setCupomAplicado(null);
        if (dados.codigo === "MINIMO") {
          guardarCupomPendente(codigo.trim().toUpperCase());
          setErroCupom(`${dados.erro} ${AVISO_AUTOMATICO}`);
        } else {
          limparCupomPendente();
          setErroCupom(dados.erro || "Não foi possível validar o cupom.");
        }
        return;
      }
      limparCupomPendente();
      cupomValidado.current = `${dados.cupom.codigo}:${subtotal}`;
      setCupomAplicado(dados.cupom);
      setCodigoCupom(dados.cupom.codigo);
    } catch {
      if (request !== cupomRequest.current) return;
      setCupomAplicado(null);
      setErroCupom("Não foi possível validar o cupom. Tente novamente.");
    } finally {
      if (request === cupomRequest.current) setValidandoCupom(false);
    }
  };

  // Cupom em espera (escolhido em /cupons ou abaixo do mínimo): tenta de novo ao abrir
  // a sacola e sempre que o subtotal muda, até ser aplicado ou recusado por outro motivo.
  const aplicarCupomRef = useRef(aplicarCupom);
  aplicarCupomRef.current = aplicarCupom;
  useEffect(() => {
    if (!open || itens.length === 0 || cupomAplicado) return;
    const pendente = lerCupomPendente();
    if (!pendente) return;
    setCodigoCupom(pendente);
    void aplicarCupomRef.current(pendente);
  }, [open, itens.length, subtotal, cupomAplicado]);

  // Cupom aplicado, em espera ou com aviso: mostra a seção aberta.
  useEffect(() => {
    if (cupomAplicado || erroCupom) setCupomAberto(true);
  }, [cupomAplicado, erroCupom]);

  const removerCupom = () => {
    cupomRequest.current++;
    limparCupomPendente();
    setValidandoCupom(false);
    setCupomAplicado(null);
    setCodigoCupom("");
    setErroCupom("");
  };

  // Endereços salvos (atualizados no AuthContext ao voltar do cadastro de endereço).
  useEffect(() => {
    if (!open || step !== "entrega" || loading || !cliente) return;
    const enderecos = customerAddresses(cliente);
    setEnderecosDisponiveis(enderecos);
    setEnderecoSelecionado(current => enderecos.some(address => address.id === current) ? current : (enderecos.find(address => address.principal)?.id || enderecos[0]?.id || ""));
  }, [open, step, loading, cliente]);

  // Reset ao fechar a sacola
  useEffect(() => {
    if (!open) {
      setStep("cart");
      setEnderecosDisponiveis([]);
      setEnderecoSelecionado("");
      setTipoEntrega("entrega");
      setModoRetirada("agora");
      setAgendadoPara(null);
      setAgendaAberta(false);
      setMeioPagamento(null);
      setTrocoPara("");
      setCep("");
    }
  }, [open]);

  // Reabre a sacola após login/cadastro de endereço
  useEffect(() => {
    if (!loading && !lojaLoading && loja && !lojaError && session && !open) {
      const shouldReopen = sessionStorage.getItem("reopenCart");
      const savedStep = sessionStorage.getItem("cartStep");

      if (shouldReopen === "true") {
        if (!resumeChecked.current) { resumeChecked.current = true; void refreshLoja(); return; }
        sessionStorage.removeItem("reopenCart");
        sessionStorage.removeItem("cartStep");
        sessionStorage.removeItem("cartTipoEntrega");

        // Pequeno delay para garantir que o contexto está pronto
        setTimeout(() => {
          onOpenChange(true);
          if (savedStep === "info" || savedStep === "entrega") setStep("entrega");
        }, 100);
      }
    }
  }, [loading, lojaLoading, loja, lojaError, session, open, onOpenChange, refreshLoja]);

  const lojaConfirmada = !lojaLoading && !!loja && !lojaError;
  const lojaAberta = lojaConfirmada && Boolean(loja?.esta_aberto);

  const conferirLoja = () => {
    if (lojaLoading || !loja || lojaError) {
      toast.info(lojaLoading ? "Aguarde, verificando o funcionamento da loja…" : "Não foi possível verificar a loja. Tente novamente.");
      if (!lojaLoading) void refreshLoja();
      return false;
    }
    if (!lojaAberta) {
      toast.error("Loja fechada", { description: "No momento não estamos aceitando pedidos." });
      return false;
    }
    return true;
  };

  const handleContinuar = () => {
    if (!conferirLoja()) return;
    if (loading) {
      toast.info("Aguarde, carregando suas informações...");
      return;
    }
    setStep("entrega");
  };

  const escolherEndereco = (id: string) => {
    setTipoEntrega("entrega");
    setEnderecoSelecionado(id);
    setStep("payment");
  };

  const escolherRetirada = () => {
    setTipoEntrega("retirada");
    setStep("retirada");
  };

  // Tempo de preparo usado no "Agora (X min)" e como antecedência mínima do agendamento.
  const preparoMin = Number(loja?.tempo_entrega_min) > 0 ? Number(loja?.tempo_entrega_min) : 15;

  const abrirAgenda = () => {
    const dias = loja ? gerarDiasAgendamento(loja, preparoMin) : [];
    if (!dias.length) {
      toast.info("Agendamento indisponível", { description: "Não há horários disponíveis para retirada nos próximos dias." });
      return;
    }
    setDiasAgenda(dias);
    const atual = agendadoPara ? dias.find(dia => dia.horarios.some(h => h.inicio === agendadoPara)) : undefined;
    setDiaAgenda(atual ? atual.chave : dias[0].chave);
    setHorarioAgenda(atual ? agendadoPara : null);
    setAgendaAberta(true);
  };

  const confirmarAgenda = () => {
    if (!horarioAgenda) {
      toast.error("Escolha um horário para retirar");
      return;
    }
    setAgendadoPara(horarioAgenda);
    setModoRetirada("agendar");
    setAgendaAberta(false);
  };

  const continuarRetirada = () => {
    if (modoRetirada === "agendar" && !agendadoPara) {
      abrirAgenda();
      return;
    }
    setStep("payment");
  };

  const guardarRetorno = () => {
    sessionStorage.setItem("reopenCart", "true");
    sessionStorage.setItem("cartStep", "entrega");
  };

  const adicionarEndereco = (cepInformado?: string) => {
    guardarRetorno();
    const digitos = (cepInformado ?? "").replace(/\D/g, "");
    window.location.href = digitos.length === 8 ? `/perfil/enderecos/novo?cep=${digitos}` : "/perfil/enderecos/novo";
  };

  // "Buscar CEP": se o CEP já é de um endereço salvo, usa esse endereço em vez de cadastrar outro.
  const buscarCep = () => {
    const digitos = cep.replace(/\D/g, "");
    if (digitos.length !== 8) return;
    const salvos = enderecosDisponiveis.filter((endereco) => (endereco.cep ?? "").replace(/\D/g, "") === digitos);
    if (salvos.length === 1) {
      toast.success("Esse CEP já está cadastrado", { description: `Usando o endereço ${salvos[0].apelido || linhaEndereco(salvos[0])[0]}.` });
      setCep("");
      escolherEndereco(salvos[0].id);
      return;
    }
    if (salvos.length > 1) {
      toast.info("Você tem mais de um endereço com esse CEP", { description: "Escolha um dos endereços salvos acima." });
      return;
    }
    adicionarEndereco(digitos);
  };

  const irParaLogin = (destino: "/entrar" | "/cadastrar") => {
    guardarRetorno();
    onOpenChange(false);
    router.push(destino);
  };

  // Mais uma unidade igual: o carrinho junta na mesma linha ("2x"), sem repetir o item.
  const duplicarItem = (item: ItemCarrinho) => {
    const { uid: _uid, ...copia } = item;
    void _uid;
    const unitario = Math.round((item.total / item.qty) * 100) / 100;
    adicionarItem({ ...copia, qty: 1, total: unitario });
    toast.success(`${item.qty + 1}x ${item.produto.name}`);
  };

  const handleVoltar = () => {
    if (step === "payment") setStep(tipoEntrega === "retirada" ? "retirada" : "entrega");
    else if (step === "retirada") setStep("entrega");
    else if (step === "entrega") setStep("cart");
  };

  const enderecoAtual = enderecosDisponiveis.find(e => e.id === enderecoSelecionado);

  const handleFinalizarPedido = async () => {
    if (!conferirLoja()) return;
    if (!meioPagamento) {
      toast.error("Escolha a forma de pagamento");
      return;
    }
    if (!nome || !telefone) {
      toast.error("Complete seu nome e telefone no perfil");
      return;
    }
    if (tipoEntrega === "entrega" && !enderecoAtual) {
      toast.error("Selecione um endereço de entrega");
      setStep("entrega");
      return;
    }
    const agendamento = tipoEntrega === "retirada" && modoRetirada === "agendar" ? agendadoPara : null;
    if (tipoEntrega === "retirada" && modoRetirada === "agendar" && (!agendamento || new Date(agendamento).getTime() < Date.now())) {
      toast.error("Esse horário de retirada já passou", { description: "Escolha outro horário." });
      setAgendadoPara(null);
      setStep("retirada");
      return;
    }

    if (checkoutLock.current) return;
    checkoutLock.current = true;
    setEnviandoPedido(true);

    try {
      const pedidoData = {
        cliente_nome: nome,
        cliente_telefone: telefone,
        tipo_entrega: tipoEntrega,
        ...(agendamento ? { agendado_para: agendamento } : {}),
        endereco_id: tipoEntrega === "entrega" ? enderecoSelecionado : null,
        endereco_completo: tipoEntrega === "entrega" ? enderecoAtual : null,
        meio_pagamento: meioPagamento,
        troco_para: meioPagamento === "dinheiro" ? valorTroco(trocoPara) : null,
        subtotal,
        taxa_entrega: frete,
        total,
        cupom_codigo: cupomAplicado?.codigo ?? null,
        itens: itens.map(item => {
          const adicionais = resolveSelectionsFromProduct(
            item.produto,
            item.selections
          );
          return {
            uid: item.uid,
            produto: {
              id: item.produto.id,
              comboId: item.produto.comboId,
              name: item.produto.name,
              // Preço unitário cobrado (promo se ativa)
              price: getProductUnitPrice(item.produto),
              image: item.produto.image,
            },
            qty: item.qty,
            selections: item.selections,
            adicionais,
            observacoes: item.observacoes,
            ...(typeof item.colher === "boolean" ? { colher: item.colher } : {}),
            total: item.total,
          };
        }),
      };

      const serializedOrder = JSON.stringify(pedidoData);
      if (checkoutAttempt.current?.body !== serializedOrder) checkoutAttempt.current = { body: serializedOrder, key: crypto.randomUUID() };
      const resposta = await fetch("/api/pedidos/criar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": checkoutAttempt.current.key,
        },
        body: serializedOrder,
      });

      if (!resposta.ok) {
        const erro = await resposta.json().catch(() => ({}));
        toast.error(erro.erro || "Erro ao criar pedido");
        return;
      }

      const { pedido } = await resposta.json();
      checkoutAttempt.current = null;
      invalidateCustomerResources();

      toast.success("Pedido realizado com sucesso!", {
        description: `Pedido #${pedido.id.slice(0, 8)} · Total confirmado: ${formatBRL(Number(pedido.total))}`,
      });

      limpar();
      removerCupom();
      onOpenChange(false);

      // Redireciona para pedidos após 1s
      setTimeout(() => {
        router.push("/pedidos");
      }, 1000);
    } catch {
      toast.error("Erro ao processar pedido");
    } finally {
      checkoutLock.current = false;
      setEnviandoPedido(false);
    }
  };

  const titulo = step === "cart" ? "Minha sacola" : step === "entrega" ? "Opções de entrega" : step === "retirada" ? "Retirar meu pedido" : "Selecione a forma de pagamento";
  const rotuloAgendamento = modoRetirada === "agendar" ? formatarAgendamento(agendadoPara) : null;
  const tempoEntrega = loja?.tempo_entrega_min || loja?.tempo_entrega_max
    ? `${loja.tempo_entrega_min ?? ""}${loja.tempo_entrega_max ? `–${loja.tempo_entrega_max}` : ""} min`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose overlayClassName="z-[80] max-md:bottom-0" className="z-[90] flex h-dvh max-h-dvh w-full max-w-md flex-col gap-0 overflow-hidden border-0 p-0 top-0 translate-y-0 rounded-none md:top-[50%] md:translate-y-[-50%] md:h-[92dvh] md:max-h-[92dvh] md:rounded-2xl">
        <DialogTitle className="sr-only">{titulo}</DialogTitle>

        {/* Cabeçalho */}
        {step === "cart" ? (
          <header className="relative flex shrink-0 items-center justify-center border-b border-border bg-card px-14 pb-3.5 pt-[max(0.875rem,env(safe-area-inset-top))]">
            <h2 className="text-lg font-bold tracking-[-0.02em] text-foreground">Minha sacola</h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Fechar sacola"
              className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-muted text-foreground transition hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </header>
        ) : (
          <header className="flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 pb-3.5 pt-[max(0.875rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={handleVoltar}
              disabled={enviandoPedido}
              aria-label="Voltar"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:opacity-95 active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <ArrowLeft aria-hidden="true" className="h-5 w-5" />
            </button>
            <h2 className="min-w-0 truncate text-base font-bold tracking-[-0.01em] text-foreground">{titulo}</h2>
          </header>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background">
          {step === "cart" ? (
            itens.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-5 py-24 text-center text-muted-foreground">
                <div className="rounded-full bg-muted p-6">
                  <ShoppingBag className="h-12 w-12" strokeWidth={1.25} />
                </div>
                <p className="mt-4 font-medium text-foreground">Sua sacola está vazia</p>
                <p className="mt-1 text-xs">Adicione produtos para continuar</p>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="mt-6 rounded-xl border border-primary px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5"
                >
                  Ver cardápio
                </button>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-border px-4">
                  {itens.map((item) => (
                    <ItemSacola
                      key={item.uid}
                      item={item}
                      onRemover={() => removerItem(item.uid)}
                      onDuplicar={() => duplicarItem(item)}
                    />
                  ))}
                </ul>

                <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2">
                  <button
                    type="button"
                    onClick={() => onOpenChange(false)}
                    className="min-h-11 text-sm font-semibold text-primary hover:underline"
                  >
                    + Adicionar mais itens
                  </button>
                  <button
                    type="button"
                    onClick={() => { limpar(); removerCupom(); }}
                    className="min-h-11 text-xs font-medium text-muted-foreground hover:text-destructive"
                  >
                    Limpar sacola
                  </button>
                </div>

                {/* Cupom */}
                <section className="border-t border-border px-4 pb-4">
                  <button
                    type="button"
                    onClick={() => setCupomAberto((aberto) => !aberto)}
                    aria-expanded={cupomAberto}
                    aria-controls="cupom-sacola"
                    className="flex min-h-12 w-full items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    Cupom de desconto
                    {cupomAplicado && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800">{cupomAplicado.codigo}</span>}
                    <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform motion-reduce:transition-none ${cupomAberto ? "rotate-180" : ""}`} />
                  </button>
                  {cupomAberto && (
                    <div id="cupom-sacola">
                      {cupomAplicado ? (
                        <div role="status" className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                          <span className="min-w-0 truncate"><strong>{cupomAplicado.codigo}</strong> aplicado · você economizou {formatBRL(descontoCupom)}</span>
                          <button type="button" onClick={removerCupom} className="shrink-0 text-xs font-semibold underline">Remover</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            id="cupom-pedido"
                            aria-label="Código do cupom"
                            value={codigoCupom}
                            onChange={(event) => { cupomRequest.current++; setValidandoCupom(false); setCodigoCupom(event.target.value.toUpperCase()); setErroCupom(""); }}
                            placeholder="Digite seu código…"
                            autoCapitalize="characters"
                            spellCheck={false}
                            autoComplete="off"
                            name="cupom"
                            className="h-11 min-w-0 uppercase"
                          />
                          <button
                            type="button"
                            onClick={() => void aplicarCupom()}
                            disabled={validandoCupom || codigoCupom.trim().length < 3}
                            className="h-11 shrink-0 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                          >
                            {validandoCupom ? "Verificando" : "Aplicar"}
                          </button>
                        </div>
                      )}
                      {erroCupom && <p role="alert" className="mt-2 text-xs text-destructive">{erroCupom}</p>}
                    </div>
                  )}
                </section>
              </>
            )
          ) : step === "entrega" ? (
            loading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary motion-reduce:animate-none" />
                <p className="mt-4 text-sm text-muted-foreground">Carregando...</p>
              </div>
            ) : !session || !session.user ? (
              <div className="flex flex-col items-center justify-center px-5 py-24 text-center">
                <div className="rounded-full bg-muted p-6">
                  <User className="h-12 w-12 text-muted-foreground" strokeWidth={1.25} />
                </div>
                <p className="mt-4 font-medium text-foreground">Entre para finalizar o pedido</p>
                <p className="mt-1 text-xs text-muted-foreground">Faça login ou crie uma conta. Sua sacola não será perdida.</p>
                <button
                  type="button"
                  onClick={() => irParaLogin("/entrar")}
                  className="mt-6 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  Fazer login
                </button>
                <button
                  type="button"
                  onClick={() => irParaLogin("/cadastrar")}
                  className="mt-3 rounded-xl border border-primary px-6 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5"
                >
                  Criar conta
                </button>
              </div>
            ) : (
              <div className="space-y-6 px-4 py-5">
                {/* Entregar no meu endereço */}
                <section aria-labelledby="titulo-entregar" className="space-y-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 id="titulo-entregar" className="text-base font-semibold text-foreground">Entregar no meu endereço</h3>
                    {tempoEntrega && <span className="shrink-0 text-xs text-muted-foreground">{tempoEntrega}</span>}
                  </div>

                  {enderecosDisponiveis.length > 0 && (
                    <ul className="space-y-2">
                      {enderecosDisponiveis.map((endereco) => {
                        const [linha1, linha2] = linhaEndereco(endereco);
                        const selecionado = tipoEntrega === "entrega" && enderecoSelecionado === endereco.id;
                        return (
                          <li key={endereco.id}>
                            <CartaoOpcao
                              selecionado={selecionado}
                              onClick={() => escolherEndereco(endereco.id)}
                              icone={<MapPin aria-hidden="true" className="h-5 w-5" />}
                              titulo={
                                <>
                                  {endereco.apelido || "Endereço"}
                                  {endereco.principal && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Principal</span>}
                                </>
                              }
                              linhas={[linha1, linha2]}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {/* Novo endereço por CEP */}
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Hash aria-hidden="true" className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {enderecosDisponiveis.length > 0 ? "Usar outro endereço" : "Digitar meu endereço"}
                        </p>
                        <p className="text-xs text-muted-foreground">Informar meu endereço por CEP</p>
                      </div>
                    </div>
                    <form
                      className="mt-3 flex gap-2 rounded-xl border border-dashed border-border p-2"
                      onSubmit={(event) => { event.preventDefault(); buscarCep(); }}
                    >
                      <Input
                        value={cep}
                        onChange={(event) => setCep(event.target.value.replace(/\D/g, "").slice(0, 8).replace(/^(\d{5})(\d)/, "$1-$2"))}
                        inputMode="numeric"
                        autoComplete="postal-code"
                        aria-label="CEP"
                        placeholder="Digite o CEP"
                        className="h-11 min-w-0 border-0 shadow-none focus-visible:ring-0"
                      />
                      <button
                        type="submit"
                        disabled={cep.replace(/\D/g, "").length !== 8}
                        className="h-11 shrink-0 rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-wide text-primary-foreground transition hover:opacity-95 disabled:opacity-50"
                      >
                        Buscar CEP
                      </button>
                    </form>
                    <button
                      type="button"
                      onClick={() => adicionarEndereco()}
                      className="mt-2 min-h-9 text-xs font-medium text-primary underline"
                    >
                      Não sei meu CEP
                    </button>
                  </div>
                </section>

                {/* Ir até o estabelecimento */}
                <section aria-labelledby="titulo-retirar" className="space-y-3">
                  <h3 id="titulo-retirar" className="text-base font-semibold text-foreground">Ir até o estabelecimento</h3>
                  <CartaoOpcao
                    selecionado={tipoEntrega === "retirada"}
                    onClick={escolherRetirada}
                    icone={
                      loja?.logo_url ? (
                        <span className="relative block h-10 w-10 overflow-hidden rounded-full">
                          <Image preset="storeLogo" src={loja.logo_url} alt="" fill sizes="40px" className="object-cover" />
                        </span>
                      ) : (
                        <Store aria-hidden="true" className="h-5 w-5" />
                      )
                    }
                    titulo={loja?.nome || "Estabelecimento"}
                    linhas={[loja?.endereco || "Retire o pedido no balcão, sem taxa de entrega."]}
                  />
                </section>
              </div>
            )
          ) : step === "retirada" ? (
            <div className="space-y-6 px-4 py-5">
              <div className="flex gap-3">
                <Store aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">{loja?.nome || "Estabelecimento"}</p>
                  {loja?.endereco && <p className="whitespace-pre-line text-sm text-muted-foreground">{loja.endereco}</p>}
                  {(loja?.cidade || loja?.estado) && <p className="text-sm text-muted-foreground">{[loja?.cidade, loja?.estado].filter(Boolean).join(", ")}</p>}
                  <button type="button" onClick={() => setStep("entrega")} className="mt-2 inline-flex min-h-9 items-center gap-1.5 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground">
                    <Pencil aria-hidden="true" className="h-4 w-4" />
                    Alterar entrega ou endereço
                  </button>
                </div>
              </div>

              <div role="radiogroup" aria-label="Quando você quer retirar" className="space-y-3">
                <OpcaoRetirada
                  marcado={modoRetirada === "agora"}
                  onClick={() => { setModoRetirada("agora"); setAgendadoPara(null); }}
                  icone={<AlarmClock aria-hidden="true" className="h-5 w-5" />}
                  titulo="Agora"
                  detalhe={`(${preparoMin}min)`}
                />
                <OpcaoRetirada
                  marcado={modoRetirada === "agendar"}
                  onClick={abrirAgenda}
                  icone={<CalendarClock aria-hidden="true" className="h-5 w-5" />}
                  titulo="Agendar"
                  detalhe={rotuloAgendamento ? `(${rotuloAgendamento})` : "(selecionar horário)"}
                />
              </div>

              <button
                type="button"
                onClick={continuarRetirada}
                className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold uppercase tracking-wide text-primary-foreground shadow-md transition hover:opacity-95 active:scale-[0.98]"
              >
                Continuar
              </button>
            </div>
          ) : (
            <div className="pb-4">
              {/* Abas: só "Pague na entrega" */}
              <div className="border-b border-border px-4">
                <p className="inline-block border-b-[3px] border-primary px-1 pb-2.5 pt-4 text-sm font-semibold text-foreground">
                  Pague na entrega
                </p>
              </div>

              <div role="radiogroup" aria-label="Forma de pagamento" className="divide-y divide-border px-4">
                {MEIOS_PAGAMENTO.map(({ valor, rotulo }) => {
                  const marcado = meioPagamento === valor;
                  const { Icone, cor } = ICONE_PAGAMENTO[valor];
                  return (
                    <div key={valor}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={marcado}
                        onClick={() => setMeioPagamento(valor)}
                        className="flex min-h-[60px] w-full items-center gap-3 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                      >
                        <span className={`flex h-8 w-10 shrink-0 items-center justify-center rounded-md ${cor}`}>
                          <Icone aria-hidden="true" className="h-5 w-5" />
                        </span>
                        <span className="flex-1 text-sm text-foreground">{rotulo}</span>
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${marcado ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                          {marcado && <Check aria-hidden="true" className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />}
                        </span>
                      </button>
                      {valor === "dinheiro" && marcado && (
                        <div className="pb-3 pl-[52px]">
                          <label htmlFor="troco" className="text-xs font-medium text-muted-foreground">Troco para quanto? (opcional)</label>
                          <Input
                            id="troco"
                            inputMode="decimal"
                            placeholder="Ex: R$ 50,00"
                            value={trocoPara}
                            onChange={(e) => setTrocoPara(e.target.value)}
                            className="mt-1 h-11"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Resumo */}
              <section aria-label="Resumo do pedido" className="mx-4 mt-4 space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
                <div className="flex items-start gap-2.5">
                  {tipoEntrega === "retirada" ? <Store aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <Truck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{tipoEntrega === "retirada" ? (rotuloAgendamento ? `Retirada agendada · ${rotuloAgendamento}` : "Retirar no local · Agora") : "Entrega"}</p>
                    <p className="text-xs text-muted-foreground">
                      {tipoEntrega === "retirada"
                        ? loja?.endereco || loja?.nome
                        : enderecoAtual ? linhaEndereco(enderecoAtual).join(" · ") : "Selecione um endereço"}
                    </p>
                  </div>
                  <button type="button" onClick={() => setStep(tipoEntrega === "retirada" ? "retirada" : "entrega")} className="min-h-9 shrink-0 text-xs font-semibold text-primary">
                    Trocar
                  </button>
                </div>
                <div className="space-y-1 border-t border-border pt-2">
                  <LinhaValor rotulo="Subtotal" valor={formatBRL(subtotal)} />
                  {cupomAplicado && <LinhaValor rotulo={`Desconto (${cupomAplicado.codigo})`} valor={`− ${formatBRL(descontoCupom)}`} destaque />}
                  {tipoEntrega === "entrega" && <LinhaValor rotulo="Taxa de entrega" valor={frete === 0 ? "Grátis" : formatBRL(frete)} destaque={frete === 0} />}
                  {meioPagamento && <LinhaValor rotulo="Pagamento" valor={rotuloPagamento(meioPagamento)} />}
                </div>
                {erroCupom && <p role="alert" className="text-xs text-destructive">{erroCupom}</p>}
              </section>
            </div>
          )}
        </div>

        {/* Rodapé */}
        {itens.length > 0 && step !== "entrega" && step !== "retirada" && (
          <div className="shrink-0 space-y-3 border-t border-border bg-card px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {step === "cart" && temFreteGratis && (
              <p className="rounded-lg bg-emerald-500 px-3 py-2 text-center text-sm text-white">
                Sua sacola tem <strong>ENTREGA GRÁTIS</strong>
              </p>
            )}
            {!lojaConfirmada && <div role="status" className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">{lojaLoading ? "Verificando o funcionamento da loja…" : <>Não foi possível consultar a loja. <button type="button" onClick={() => void refreshLoja()} className="min-h-9 font-medium text-primary underline">Tentar novamente</button></>}</div>}
            {lojaConfirmada && !lojaAberta && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                A loja está fechada e não está aceitando pedidos no momento.
              </div>
            )}

            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold text-foreground">Total:</span>
              <span className="text-lg font-bold text-foreground">{formatBRL(step === "cart" ? totalProdutos : total)}</span>
            </div>
            {step === "cart" && cupomAplicado && (
              <p className="-mt-2 text-right text-xs text-emerald-700">Você economizou {formatBRL(descontoCupom)}</p>
            )}

            {step === "cart" ? (
              <button
                type="button"
                onClick={handleContinuar}
                disabled={loading || validandoCupom || !lojaAberta}
                className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold uppercase tracking-wide text-primary-foreground shadow-md transition hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Carregando..." : !lojaConfirmada ? "Verificando loja…" : !lojaAberta ? "Loja fechada" : "Continuar"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleFinalizarPedido()}
                disabled={enviandoPedido || validandoCupom || !lojaAberta || !meioPagamento}
                className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold uppercase tracking-wide text-primary-foreground shadow-md transition hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {enviandoPedido ? "Enviando pedido..." : !lojaConfirmada ? "Verificando loja…" : !lojaAberta ? "Loja fechada" : !meioPagamento ? "Escolha o pagamento" : "Fazer pedido"}
              </button>
            )}
          </div>
        )}
        {agendaAberta && (
          <AgendaRetirada
            dias={diasAgenda}
            dia={diaAgenda}
            horario={horarioAgenda}
            onDia={(chave) => { setDiaAgenda(chave); setHorarioAgenda(null); }}
            onHorario={setHorarioAgenda}
            onConfirmar={confirmarAgenda}
            onCancelar={() => setAgendaAberta(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Opção "Agora" / "Agendar" da retirada (rádio em cartão). */
function OpcaoRetirada({ marcado, onClick, icone, titulo, detalhe }: {
  marcado: boolean;
  onClick: () => void;
  icone: ReactNode;
  titulo: string;
  detalhe: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={marcado}
      onClick={onClick}
      className={`flex min-h-[60px] w-full items-center gap-3 rounded-xl border-2 bg-muted/60 px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${marcado ? "border-primary" : "border-transparent"}`}
    >
      <span className="shrink-0 text-foreground">{icone}</span>
      <span className="min-w-0 flex-1 text-sm text-foreground">
        <span className="font-bold">{titulo}</span> <span className="text-muted-foreground">{detalhe}</span>
      </span>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${marcado ? "border-foreground bg-foreground" : "border-muted-foreground/30 bg-card"}`}>
        {marcado && <span className="h-2 w-2 rounded-full bg-card" />}
      </span>
    </button>
  );
}

/** Folha inferior "Opções de agendamento": dias + janelas de 15 min. */
function AgendaRetirada({ dias, dia, horario, onDia, onHorario, onConfirmar, onCancelar }: {
  dias: DiaAgendamento[];
  dia: string;
  horario: string | null;
  onDia: (chave: string) => void;
  onHorario: (inicio: string) => void;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const diasRef = useRef<HTMLDivElement | null>(null);
  const atual = dias.find(item => item.chave === dia) ?? dias[0];
  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-end bg-black/50" onClick={onCancelar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-agendamento"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onCancelar(); } }}
        className="flex max-h-[75%] flex-col rounded-t-2xl bg-card pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl"
      >
        <h3 id="titulo-agendamento" className="flex items-center gap-2.5 px-4 pb-3 pt-5 text-base font-bold text-foreground">
          <AlarmClock aria-hidden="true" className="h-6 w-6" />
          Opções de agendamento
        </h3>
        <div className="relative">
          <div ref={diasRef} role="tablist" aria-label="Dia da retirada" className="flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
            {dias.map(item => {
              const ativo = item.chave === atual?.chave;
              return (
                <button
                  key={item.chave}
                  type="button"
                  role="tab"
                  aria-selected={ativo}
                  onClick={() => onDia(item.chave)}
                  className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${ativo ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
                >
                  <span className="font-bold">{item.rotulo}</span>
                  <span>{item.dia}</span>
                </button>
              );
            })}
          </div>
          {dias.length > 4 && (
            <button
              type="button"
              aria-label="Mais dias"
              onClick={() => diasRef.current?.scrollBy({ left: 160, behavior: "smooth" })}
              className="absolute right-2 top-[22px] flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card shadow-sm"
            >
              <ChevronRight aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>
        <div role="radiogroup" aria-label="Horário da retirada" className="min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-contain px-4">
          {atual?.horarios.map(item => {
            const marcado = horario === item.inicio;
            return (
              <button
                key={item.inicio}
                type="button"
                role="radio"
                aria-checked={marcado}
                onClick={() => onHorario(item.inicio)}
                className="flex min-h-12 w-full items-center gap-3 text-left text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${marcado ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                  {marcado && <span className="h-2 w-2 rounded-full bg-primary-foreground" />}
                </span>
                {item.rotulo}
              </button>
            );
          })}
        </div>
        <div className="space-y-1 px-4 pt-3">
          <button
            type="button"
            onClick={onConfirmar}
            disabled={!horario}
            className="w-full rounded-xl bg-primary py-3.5 text-sm font-bold uppercase tracking-wide text-primary-foreground shadow-md transition hover:opacity-95 disabled:opacity-50"
          >
            Confirmar agendamento
          </button>
          <button type="button" onClick={onCancelar} className="min-h-11 w-full text-sm text-foreground">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Item da sacola: foto, nome, escolhas, lixeira, duplicar e preço. */
function ItemSacola({ item, onRemover, onDuplicar }: { item: ItemCarrinho; onRemover: () => void; onDuplicar: () => void }) {
  const escolhas = resolveSelectionsFromProduct(item.produto, item.selections);
  const destaque = [
    typeof item.colher === "boolean" ? (item.colher ? "Sim, quero colher" : "Não quero colher") : null,
    item.observacoes ? `Obs: ${item.observacoes}` : null,
  ].filter(Boolean).join(", ");

  return (
    <li className="py-4">
      <div className="flex gap-3">
        {item.produto.image ? (
          <Image preset="thumbnail"
            src={item.produto.image}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted">
            <ShoppingBag aria-hidden="true" className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-[15px] font-medium leading-snug text-foreground">
              {item.qty > 1 && <span className="font-bold">{item.qty}x </span>}
              {item.produto.name}
            </p>
            <button
              type="button"
              onClick={onRemover}
              aria-label={`Remover ${item.produto.name}`}
              className="-mr-2 -mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-destructive transition hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
            >
              <Trash2 aria-hidden="true" className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
          {destaque && <p className="mt-0.5 text-[13px] italic text-muted-foreground">{destaque}</p>}
          {escolhas.length > 0 && (
            <ul className="mt-0.5 space-y-0.5 text-[13px] text-muted-foreground">
              {escolhas.map((escolha, index) => (
                <li key={`${escolha.groupId}-${escolha.id}-${index}`}>
                  <span className="font-semibold text-foreground/80">1x</span> {escolha.name}
                </li>
              ))}
            </ul>
          )}
          {item.produto.comboItems?.length ? (
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Inclui {item.produto.comboItems.map((part) => `${part.quantity}× ${part.name}`).join(" · ")}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between pl-[68px]">
        <button
          type="button"
          onClick={onDuplicar}
          className="flex min-h-10 items-center gap-2 rounded-lg bg-muted px-3.5 text-sm font-semibold text-foreground transition hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Copy aria-hidden="true" className="h-4 w-4" />
          Duplicar
        </button>
        <span className="text-[15px] font-bold text-foreground">{formatBRL(item.total)}</span>
      </div>
    </li>
  );
}

/** Cartão clicável de opção de entrega (endereço salvo ou loja). */
function CartaoOpcao({ selecionado, onClick, icone, titulo, linhas }: {
  selecionado: boolean;
  onClick: () => void;
  icone: ReactNode;
  titulo: ReactNode;
  linhas: string[];
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selecionado}
      className={`flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${selecionado ? "border-primary ring-1 ring-primary" : "border-border"}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center text-sm font-semibold text-foreground">{titulo}</span>
        {linhas.filter(Boolean).map((linha) => (
          <span key={linha} className="block text-xs leading-relaxed text-muted-foreground">{linha}</span>
        ))}
      </span>
      <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );
}

function LinhaValor({ rotulo, valor, destaque = false }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${destaque ? "text-emerald-700" : ""}`}>
      <span className={destaque ? "" : "text-muted-foreground"}>{rotulo}</span>
      <span className="font-medium">{valor}</span>
    </div>
  );
}
