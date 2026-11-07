/**
 * Regras puras do app do entregador (sem React Native): formatos e mensagens.
 * Testadas em scripts/responsive/entregador-app-test.cjs.
 */

export type ItemResumo = { qtd: number; nome: string; obs: string | null };

export type Entrega = {
  id: string;
  numero: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  endereco: unknown;
  observacoes: string | null;
  itens: ItemResumo[];
  meio_pagamento: string;
  total: number;
  troco_para: string | null;
  saiu_entrega_at: string | null;
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const dinheiro = (valor: number) => brl.format(valor).replace(/ /g, " ");

const str = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

/** Endereço do pedido (jsonb do cardápio ou texto) em linhas para o card. */
export function formatarEndereco(endereco: unknown): { linha1: string; linha2: string; complemento: string; referencia: string } {
  let e: Record<string, unknown> = {};
  if (typeof endereco === "string") {
    try {
      const parsed = JSON.parse(endereco);
      if (parsed && typeof parsed === "object") e = parsed as Record<string, unknown>;
      else return { linha1: endereco.trim(), linha2: "", complemento: "", referencia: "" };
    } catch {
      return { linha1: endereco.trim(), linha2: "", complemento: "", referencia: "" };
    }
  } else if (endereco && typeof endereco === "object") {
    e = endereco as Record<string, unknown>;
  }
  const rua = str(e.logradouro) || str(e.rua) || str(e.endereco);
  const numero = str(e.numero);
  const bairro = str(e.bairro);
  const cidade = str(e.cidade);
  const uf = str(e.estado) || str(e.uf);
  const cep = str(e.cep);
  const linha1 = [rua && numero ? `${rua}, ${numero}` : rua || (numero ? `Nº ${numero}` : ""), bairro]
    .filter(Boolean)
    .join(" — ");
  const linha2 = [cidade && uf ? `${cidade}/${uf}` : cidade || uf, cep && `CEP ${cep}`].filter(Boolean).join(" · ");
  return {
    linha1: linha1 || "Endereço não informado",
    linha2,
    complemento: str(e.complemento),
    referencia: str(e.referencia) || str(e.ponto_referencia),
  };
}

const NOMES_PAGAMENTO: Record<string, string> = { dinheiro: "Dinheiro", pix: "Pix", cartao: "Cartão" };

/** Valor de "troco para" vindo do cardápio ("50", "50,00", "R$ 100", "não"). */
export function parseTroco(valor: string | null | undefined): number | null {
  if (!valor) return null;
  const limpo = valor.replace(/[^\d,.]/g, "");
  if (!limpo) return null;
  // "1.234,56" → 1234.56 ; "50,5" → 50.5 ; "50.5" → 50.5
  const normal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const n = Number(normal);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** O que o entregador precisa saber sobre o pagamento na porta. */
export function resumoPagamento(e: Pick<Entrega, "meio_pagamento" | "total" | "troco_para">) {
  const forma = NOMES_PAGAMENTO[e.meio_pagamento] ?? e.meio_pagamento;
  const total = Number(e.total) || 0;
  if (e.meio_pagamento !== "dinheiro") {
    return { forma, valor: dinheiro(total), troco: null as string | null, levarTroco: false, valorTroco: null as string | null };
  }
  const para = parseTroco(e.troco_para);
  if (para && para > total) {
    return {
      forma,
      valor: dinheiro(total),
      troco: `Levar ${dinheiro(para - total)} de troco (cliente paga com ${dinheiro(para)})`,
      levarTroco: true,
      valorTroco: dinheiro(para - total) as string | null,
    };
  }
  return { forma, valor: dinheiro(total), troco: "Sem troco", levarTroco: false, valorTroco: null };
}

export function formatarTelefone(tel: string | null | undefined) {
  const d = (tel ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel ?? "";
}

export function linkTelefone(tel: string | null | undefined) {
  const d = (tel ?? "").replace(/\D/g, "");
  return d.length >= 8 ? `tel:${d}` : null;
}

export function horaSaida(iso: string | null, agora = Date.now()) {
  if (!iso) return "";
  const t = Date.parse(iso);
  const hora = new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  const min = Math.max(0, Math.round((agora - t) / 60000));
  return min < 1 ? `Saiu às ${hora} · agora` : min < 60 ? `Saiu às ${hora} · há ${min} min` : `Saiu às ${hora}`;
}

/** Normaliza a lista que vem do banco (tipos e itens). */
export function normalizarEntregas(rows: unknown): Entrega[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r: Record<string, unknown>) => ({
    id: String(r.id),
    numero: String(r.numero ?? String(r.id).slice(0, 8).toUpperCase()),
    cliente_nome: str(r.cliente_nome) || "Cliente",
    cliente_telefone: str(r.cliente_telefone) || null,
    endereco: r.endereco,
    observacoes: str(r.observacoes) || null,
    itens: Array.isArray(r.itens)
      ? (r.itens as Array<Record<string, unknown>>).map((i) => ({
          qtd: Number(i.qtd) || 1,
          nome: str(i.nome) || "Item",
          obs: str(i.obs) || null,
        }))
      : [],
    meio_pagamento: str(r.meio_pagamento),
    total: Number(r.total) || 0,
    troco_para: str(r.troco_para) || null,
    saiu_entrega_at: str(r.saiu_entrega_at) || null,
  }));
}

/** Texto para busca: sem acentos, minúsculo, espaços simples. */
export function normalizarBusca(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Filtra por nome do cliente, número do pedido ou rua/bairro (todas as palavras). */
export function filtrarEntregas(entregas: Entrega[], busca: string): Entrega[] {
  const termos = normalizarBusca(busca).replace(/^#/, "").split(" ").filter(Boolean);
  if (!termos.length) return entregas;
  return entregas.filter((e) => {
    const end = formatarEndereco(e.endereco);
    const alvo = normalizarBusca(`${e.cliente_nome} ${e.numero} ${end.linha1}`);
    return termos.every((t) => alvo.includes(t));
  });
}

/** Saudação pela hora de São Paulo. */
export function saudacao(agora = Date.now()) {
  const h = Number(new Date(agora).toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" })) % 24;
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function contagemEntregas(n: number) {
  return n === 0 ? "Nenhuma entrega no momento" : n === 1 ? "1 entrega para fazer" : `${n} entregas para fazer`;
}

export type ErroApp =
  | { tipo: "sem_acesso"; mensagem: string }
  | { tipo: "desativado"; mensagem: string }
  | { tipo: "indisponivel"; mensagem: string }
  | { tipo: "credenciais"; mensagem: string }
  | { tipo: "conexao"; mensagem: string }
  | { tipo: "desconhecido"; mensagem: string };

/** Erro do Supabase (login ou funções do banco) → mensagem para o entregador. */
export function traduzirErro(error: unknown): ErroApp {
  const msg = String((error as { message?: string })?.message ?? error ?? "");
  if (/NAO_ENTREGADOR/.test(msg)) return { tipo: "sem_acesso", mensagem: "Esta conta não tem acesso ao app de entregadores." };
  if (/ENTREGADOR_INATIVO|banned/i.test(msg)) return { tipo: "desativado", mensagem: "Seu acesso está desativado. Fale com a loja." };
  if (/PEDIDO_INDISPONIVEL/.test(msg))
    return { tipo: "indisponivel", mensagem: "Este pedido não está mais com você. A lista foi atualizada." };
  if (/invalid login credentials|invalid_credentials/i.test(msg))
    return { tipo: "credenciais", mensagem: "E-mail ou senha incorretos." };
  if (/network|fetch|timeout|failed to fetch|internet|offline/i.test(msg))
    return { tipo: "conexao", mensagem: "Sem conexão. Confira a internet e tente de novo." };
  return { tipo: "desconhecido", mensagem: "Algo deu errado. Tente de novo." };
}
