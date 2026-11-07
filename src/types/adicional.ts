export interface TagRef {
  id: string | number;
  nome: string;
  cor_fundo?: string;
  cor_texto?: string | null;
}

export interface GrupoOpcoes {
  id: string | number;
  nome: string;
  min_escolha: number;
  max_escolha: number;
  tag_id?: number | null;
  created_at?: string;
  updated_at?: string;
  tag?: TagRef | null;
}

export interface Opcao {
  id: string | number;
  grupo_id: string | number;
  nome: string;
  preco_adicional: number;
  status: "ativo" | "inativo";
  esta_disponivel: boolean;
  ordem: number;
  tag_id?: number | null;
  created_at?: string;
  updated_at?: string;
  grupo?: GrupoOpcoes;
  tag?: TagRef | null;
}
