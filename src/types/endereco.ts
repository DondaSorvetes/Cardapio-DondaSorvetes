export interface Endereco {
  id: string;
  apelido: string; // Ex: "Casa", "Trabalho", "Principal"
  logradouro: string; // Rua/Avenida
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  principal: boolean; // Indica se é o endereço principal
  created_at: string;
}

export interface EnderecoInput {
  apelido: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  principal?: boolean;
}

export interface ClienteComEnderecos {
  id: string;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  endereco: Endereco[];
  created_at: string;
}
