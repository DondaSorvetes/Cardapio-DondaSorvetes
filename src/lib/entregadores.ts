/** Entregadores: tipos e validação compartilhados entre o painel e o servidor. */

export type Entregador = {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  selecionado: boolean;
  created_at: string;
  /** Pedidos em "Saiu para entrega" com este entregador agora. */
  entregas_em_andamento: number;
};

export type EntregadoresResumo = {
  selecionado: { id: string; nome: string } | null;
  /** id → nome, para mostrar quem está entregando cada pedido. */
  nomes: Record<string, string>;
};

export type AppEntregadorDownload = {
  disponivel: boolean;
  versao: string | null;
  url: string | null;
  tamanho: number | null;
  publicadoEm: string | null;
};

export const SENHA_MINIMA = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

/** Erros por campo; vazio = válido. senha é opcional quando não vai ser definida. */
export function validateEntregador(input: { nome?: unknown; email?: unknown; senha?: unknown }, exigirSenha: boolean) {
  const errors: Partial<Record<"nome" | "email" | "senha", string>> = {};
  const nome = String(input.nome ?? "").trim();
  if (!nome) errors.nome = "Informe o nome.";
  else if (nome.length > 80) errors.nome = "Use até 80 caracteres.";
  if (!EMAIL.test(normalizeEmail(input.email))) errors.email = "Informe um e-mail válido.";
  if (exigirSenha || input.senha) {
    const senha = String(input.senha ?? "");
    if (senha.length < SENHA_MINIMA) errors.senha = `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
    else if (senha.length > 72) errors.senha = "Use até 72 caracteres.";
  }
  return errors;
}

/** Para o cliente: só o primeiro nome do entregador ("João Silva" → "João"). */
export function primeiroNome(nome: unknown): string | null {
  const first = String(nome ?? "").trim().split(/\s+/)[0];
  return first ? first.slice(0, 40) : null;
}

/** Releases do app do entregador: tag "entregador-vX.Y.Z" com um .apk anexado. */
export const APP_ENTREGADOR_TAG = /^entregador-v(\d+\.\d+\.\d+)$/;
