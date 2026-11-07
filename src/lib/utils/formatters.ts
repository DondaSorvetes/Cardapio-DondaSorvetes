import { EnderecoObject } from "@/types/pedido";

export function formatEndereco(
  endereco: string | EnderecoObject | null | undefined
): string {
  if (!endereco) return "";

  if (typeof endereco === "string") {
    return endereco;
  }

  if (typeof endereco === "object") {
    const partes = [
      endereco.logradouro,
      endereco.numero ? `nº ${endereco.numero}` : "",
      endereco.complemento,
      endereco.bairro,
      endereco.cidade,
      endereco.estado,
      endereco.cep ? `CEP: ${endereco.cep}` : "",
    ].filter(Boolean);

    return partes.join(", ");
  }

  return "";
}

export function formatCurrency(value: number | string | null | undefined): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "R$ 0,00";
  return `R$ ${n.toFixed(2).replace(".", ",")}`;
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  
  return phone;
}
