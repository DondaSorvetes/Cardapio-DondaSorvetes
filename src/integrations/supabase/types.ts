export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_push_subscriptions: {
        Row: {
          id: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          endpoint: string
          p256dh: string
          auth: string
          user_agent?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          endpoint?: string
          p256dh?: string
          auth?: string
          user_agent?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          id: string
          nome: string | null
          email: string | null
          telefone: string | null
          endereco: string | null
          enderecos_adicionais: Json
          created_at: string
        }
        Insert: {
          id: string
          nome?: string | null
          email?: string | null
          telefone?: string | null
          endereco?: string | null
          enderecos_adicionais?: Json
          created_at?: string
        }
        Update: {
          id?: string
          nome?: string | null
          email?: string | null
          telefone?: string | null
          endereco?: string | null
          enderecos_adicionais?: Json
          created_at?: string
        }
        Relationships: []
      }
      categorias: {
        Row: {
          id: number
          nome: string
          ordem: number | null
        }
        Insert: {
          id?: number
          nome: string
          ordem?: number | null
        }
        Update: {
          id?: number
          nome?: string
          ordem?: number | null
        }
        Relationships: []
      }
      configuracoes_loja: {
        Row: {
          aceitar_pedidos_automaticamente: boolean | null
          aceitando_pedidos: boolean | null
          banner_url: string | null
          cidade: string | null
          descricao: string | null
          dias_funcionamento: string | null
          endereco: string | null
          esta_aberto: boolean | null
          estado: string | null
          facebook: string | null
          finalizar_agendados_apos_3_dias: boolean | null
          finalizar_pedidos_apos_24h: boolean | null
          horario_abertura: string | null
          horario_fechamento: string | null
          id: number
          imprimir_aceitar_automaticamente: boolean | null
          instagram: string | null
          logo_url: string | null
          nome: string
          notificar_novos_pedidos: boolean | null
          pedido_minimo: number | null
          proximo_numero_pedido: number | null
          som_alerta_ativo: boolean | null
          som_alerta_tipo: string | null
          som_alerta_volume: number | null
          taxa_entrega: number | null
          telefone: string | null
          tempo_entrega_max: number | null
          tempo_entrega_min: number | null
          whatsapp: string | null
        }
        Insert: {
          aceitar_pedidos_automaticamente?: boolean | null
          aceitando_pedidos?: boolean | null
          banner_url?: string | null
          cidade?: string | null
          descricao?: string | null
          dias_funcionamento?: string | null
          endereco?: string | null
          esta_aberto?: boolean | null
          estado?: string | null
          facebook?: string | null
          finalizar_agendados_apos_3_dias?: boolean | null
          finalizar_pedidos_apos_24h?: boolean | null
          horario_abertura?: string | null
          horario_fechamento?: string | null
          id?: number
          imprimir_aceitar_automaticamente?: boolean | null
          instagram?: string | null
          logo_url?: string | null
          nome?: string
          notificar_novos_pedidos?: boolean | null
          pedido_minimo?: number | null
          proximo_numero_pedido?: number | null
          som_alerta_ativo?: boolean | null
          som_alerta_tipo?: string | null
          som_alerta_volume?: number | null
          taxa_entrega?: number | null
          telefone?: string | null
          tempo_entrega_max?: number | null
          tempo_entrega_min?: number | null
          whatsapp?: string | null
        }
        Update: {
          aceitar_pedidos_automaticamente?: boolean | null
          aceitando_pedidos?: boolean | null
          banner_url?: string | null
          cidade?: string | null
          descricao?: string | null
          dias_funcionamento?: string | null
          endereco?: string | null
          esta_aberto?: boolean | null
          estado?: string | null
          facebook?: string | null
          finalizar_agendados_apos_3_dias?: boolean | null
          finalizar_pedidos_apos_24h?: boolean | null
          horario_abertura?: string | null
          horario_fechamento?: string | null
          id?: number
          imprimir_aceitar_automaticamente?: boolean | null
          instagram?: string | null
          logo_url?: string | null
          nome?: string
          notificar_novos_pedidos?: boolean | null
          pedido_minimo?: number | null
          proximo_numero_pedido?: number | null
          som_alerta_ativo?: boolean | null
          som_alerta_tipo?: string | null
          som_alerta_volume?: number | null
          taxa_entrega?: number | null
          telefone?: string | null
          tempo_entrega_max?: number | null
          tempo_entrega_min?: number | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      grupos_opcoes: {
        Row: {
          id: number
          max_escolha: number
          min_escolha: number | null
          nome: string
          tag_id: number | null
        }
        Insert: {
          id?: number
          max_escolha: number
          min_escolha?: number | null
          nome: string
          tag_id?: number | null
        }
        Update: {
          id?: number
          max_escolha?: number
          min_escolha?: number | null
          nome?: string
          tag_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grupos_opcoes_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      opcoes: {
        Row: {
          grupo_id: number | null
          id: number
          nome: string
          ordem: number | null
          preco_adicional: number | null
          status: string | null
          tag_id: number | null
          esta_disponivel: boolean | null
        }
        Insert: {
          grupo_id?: number | null
          id?: number
          nome: string
          ordem?: number | null
          preco_adicional?: number | null
          status?: string | null
          tag_id?: number | null
          esta_disponivel?: boolean | null
        }
        Update: {
          grupo_id?: number | null
          id?: number
          nome?: string
          ordem?: number | null
          preco_adicional?: number | null
          status?: string | null
          tag_id?: number | null
          esta_disponivel?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "opcoes_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos_opcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opcoes_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          id: string
          cliente_id: string | null
          cliente_nome: string
          cliente_telefone: string
          agendado_para: string | null
          tipo_entrega: string
          endereco_id: string | null
          endereco_completo: Json | null
          meio_pagamento: string
          troco_para: string | null
          subtotal: number
          taxa_entrega: number
          total: number
          itens: Json
          status: string
          observacoes: string | null
          created_at: string
          updated_at: string
          cupom_codigo: string | null
          idempotency_key: string | null
          idempotency_hash: string | null
          desconto_cupom: number
          entregador_id: string | null
          saiu_entrega_at: string | null
          entregue_at: string | null
        }
        Insert: {
          id?: string
          cliente_id?: string | null
          cliente_nome: string
          cliente_telefone: string
          agendado_para?: string | null
          tipo_entrega: string
          endereco_id?: string | null
          endereco_completo?: Json | null
          meio_pagamento: string
          troco_para?: string | null
          subtotal: number
          taxa_entrega?: number
          total: number
          itens: Json
          status?: string
          observacoes?: string | null
          created_at?: string
          updated_at?: string
          cupom_codigo?: string | null
          idempotency_key?: string | null
          idempotency_hash?: string | null
          desconto_cupom?: number
          entregador_id?: string | null
          saiu_entrega_at?: string | null
          entregue_at?: string | null
        }
        Update: {
          id?: string
          cliente_id?: string | null
          cliente_nome?: string
          cliente_telefone?: string
          agendado_para?: string | null
          tipo_entrega?: string
          endereco_id?: string | null
          endereco_completo?: Json | null
          meio_pagamento?: string
          troco_para?: string | null
          subtotal?: number
          taxa_entrega?: number
          total?: number
          itens?: Json
          status?: string
          observacoes?: string | null
          created_at?: string
          updated_at?: string
          cupom_codigo?: string | null
          idempotency_key?: string | null
          idempotency_hash?: string | null
          desconto_cupom?: number
          entregador_id?: string | null
          saiu_entrega_at?: string | null
          entregue_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_itens: {
        Row: { combo_id: number; produto_id: number; quantidade: number }
        Insert: { combo_id: number; produto_id: number; quantidade?: number }
        Update: { combo_id?: number; produto_id?: number; quantidade?: number }
        Relationships: [
          {
            foreignKeyName: "combo_itens_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      combos: {
        Row: { opcoes_config: Json | null; id: number; nome: string; descricao: string | null; preco: number; imagem_url: string | null; ativa: boolean; created_at: string }
        Insert: { opcoes_config?: Json | null; id?: number; nome: string; descricao?: string | null; preco: number; imagem_url?: string | null; ativa?: boolean; created_at?: string }
        Update: { opcoes_config?: Json | null; id?: number; nome?: string; descricao?: string | null; preco?: number; imagem_url?: string | null; ativa?: boolean; created_at?: string }
        Relationships: []
      }
      cupons: {
        Row: { id: number; codigo: string; nome: string; tipo: string; valor: number; valor_minimo: number; limite_usos: number | null; usos: number; data_inicio: string; data_fim: string | null; ativo: boolean; created_at: string }
        Insert: { id?: number; codigo: string; nome: string; tipo: string; valor: number; valor_minimo?: number; limite_usos?: number | null; usos?: number; data_inicio?: string; data_fim?: string | null; ativo?: boolean; created_at?: string }
        Update: { id?: number; codigo?: string; nome?: string; tipo?: string; valor?: number; valor_minimo?: number; limite_usos?: number | null; usos?: number; data_inicio?: string; data_fim?: string | null; ativo?: boolean; created_at?: string }
        Relationships: []
      }
      produto_grupos: {
        Row: {
          grupo_id: number
          ordem: number | null
          produto_id: number
        }
        Insert: {
          grupo_id: number
          ordem?: number | null
          produto_id: number
        }
        Update: {
          grupo_id?: number
          ordem?: number | null
          produto_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "produto_grupos_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos_opcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_grupos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          categoria_id: number | null
          descricao: string | null
          esta_disponivel: boolean | null
          id: number
          imagem_url: string | null
          nome: string
          ordem: number | null
          pergunta_colher: boolean
          preco_base: number
          preco_promocional: number | null
          tag_id: number | null
        }
        Insert: {
          categoria_id?: number | null
          descricao?: string | null
          esta_disponivel?: boolean | null
          id?: number
          imagem_url?: string | null
          nome: string
          ordem?: number | null
          pergunta_colher?: boolean
          preco_base: number
          preco_promocional?: number | null
          tag_id?: number | null
        }
        Update: {
          categoria_id?: number | null
          descricao?: string | null
          esta_disponivel?: boolean | null
          id?: number
          imagem_url?: string | null
          nome?: string
          ordem?: number | null
          pergunta_colher?: boolean
          preco_base?: number
          preco_promocional?: number | null
          tag_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      promocoes_frete_gratis: {
        Row: {
          ativa: boolean
          created_at: string
          data_fim: string
          data_inicio: string
          id: number
          hora_fim: string
          hora_inicio: string
          produto_id: number | null
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          data_fim: string
          data_inicio: string
          id?: number
          hora_fim?: string
          hora_inicio?: string
          produto_id?: number | null
        }
        Update: {
          ativa?: boolean
          created_at?: string
          data_fim?: string
          data_inicio?: string
          id?: number
          hora_fim?: string
          hora_inicio?: string
          produto_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "promocoes_frete_gratis_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          cor_fundo: string
          cor_texto: string | null
          destaque_cardapio: boolean
          icone: string | null
          id: number
          nome: string
        }
        Insert: {
          cor_fundo: string
          cor_texto?: string | null
          destaque_cardapio?: boolean
          icone?: string | null
          id?: number
          nome: string
        }
        Update: {
          cor_fundo?: string
          cor_texto?: string | null
          destaque_cardapio?: boolean
          icone?: string | null
          id?: number
          nome?: string
        }
        Relationships: []
      }
      entregadores: {
        Row: {
          id: string
          nome: string
          email: string
          ativo: boolean
          selecionado: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          nome: string
          email: string
          ativo?: boolean
          selecionado?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string
          email?: string
          ativo?: boolean
          selecionado?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      perfis: {
        Row: {
          id: string
          nome: string | null
          email: string | null
          role: string
          acessos: string[] | null
          permissoes: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          nome?: string | null
          email?: string | null
          role?: string
          acessos?: string[] | null
          permissoes?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          nome?: string | null
          email?: string | null
          role?: string
          acessos?: string[] | null
          permissoes?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_selecionar_entregador: {
        Args: { p_entregador_id: string | null }
        Returns: undefined
      }
      entregador_perfil: {
        Args: Record<PropertyKey, never>
        Returns: { id: string; nome: string }[]
      }
      entregador_minhas_entregas: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          numero: string
          cliente_nome: string
          cliente_telefone: string
          endereco: Json | null
          observacoes: string | null
          itens: Json
          meio_pagamento: string
          total: number
          troco_para: string | null
          saiu_entrega_at: string | null
        }[]
      }
      entregador_concluir_entrega: {
        Args: { p_pedido_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
