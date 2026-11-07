export interface Produto {
  id: string | number;
  categoria_id: string | number;
  nome: string;
  descricao?: string;
  preco_base: number;
  /** Se preenchido e menor que preco_base, valor cobrado no cardápio */
  preco_promocional?: number | null;
  esta_disponivel: boolean;
  /** Cardápio pergunta "Deseja colher?" (padrão: true). */
  pergunta_colher?: boolean;
  ordem: number;
  imagem_url?: string;
  tag_id?: string | number | null;
  created_at?: string;
  updated_at?: string;
  // Relações
  categoria?: {
    id: string | number;
    nome: string;
  };
  tag?: {
    id: string | number;
    nome: string;
    cor_fundo?: string;
    cor_texto?: string | null;
  };
}

export interface Categoria {
  id: string | number;
  nome: string;
  ordem: number;
}

export interface Tag {
  id: string | number;
  nome: string;
  cor_fundo?: string;
  cor_texto?: string | null;
}

export type ProdutoFormData = Omit<Produto, "id" | "created_at" | "updated_at">;
