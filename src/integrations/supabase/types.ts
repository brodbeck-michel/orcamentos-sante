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
      atendentes: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      exames: {
        Row: {
          ativo: boolean
          categoria: string | null
          codigo: string
          created_at: string
          id: string
          nome: string
          sinonimos: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria?: string | null
          codigo: string
          created_at?: string
          id?: string
          nome: string
          sinonimos?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string | null
          codigo?: string
          created_at?: string
          id?: string
          nome?: string
          sinonimos?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      importacoes: {
        Row: {
          arquivo_nome: string | null
          created_at: string
          created_by: string
          id: string
          linhas_aceitas: number
          linhas_arquivo: number
          linhas_rejeitadas: number
          status: string
          tipo: string
        }
        Insert: {
          arquivo_nome?: string | null
          created_at?: string
          created_by?: string
          id?: string
          linhas_aceitas?: number
          linhas_arquivo?: number
          linhas_rejeitadas?: number
          status?: string
          tipo?: string
        }
        Update: {
          arquivo_nome?: string | null
          created_at?: string
          created_by?: string
          id?: string
          linhas_aceitas?: number
          linhas_arquivo?: number
          linhas_rejeitadas?: number
          status?: string
          tipo?: string
        }
        Relationships: []
      }
      orcamentos: {
        Row: {
          convenio1: string | null
          convenio2: string | null
          convenio3: string | null
          created_at: string
          data_orcamento: string | null
          data_pagamento: string | null
          id: string
          importacao_id: string
          media_convenio: number
          numero: string
          paciente: string | null
          requisicao: string | null
          updated_at: string
          usuario: string
          valor_pago: number
          valor_requisicao: number
          vl_total1: number
          vl_total2: number
          vl_total3: number
        }
        Insert: {
          convenio1?: string | null
          convenio2?: string | null
          convenio3?: string | null
          created_at?: string
          data_orcamento?: string | null
          data_pagamento?: string | null
          id?: string
          importacao_id: string
          media_convenio?: number
          numero: string
          paciente?: string | null
          requisicao?: string | null
          updated_at?: string
          usuario?: string
          valor_pago?: number
          valor_requisicao?: number
          vl_total1?: number
          vl_total2?: number
          vl_total3?: number
        }
        Update: {
          convenio1?: string | null
          convenio2?: string | null
          convenio3?: string | null
          created_at?: string
          data_orcamento?: string | null
          data_pagamento?: string | null
          id?: string
          importacao_id?: string
          media_convenio?: number
          numero?: string
          paciente?: string | null
          requisicao?: string | null
          updated_at?: string
          usuario?: string
          valor_pago?: number
          valor_requisicao?: number
          vl_total1?: number
          vl_total2?: number
          vl_total3?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_importacao_id_fkey"
            columns: ["importacao_id"]
            isOneToOne: false
            referencedRelation: "importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          atendente: string | null
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          atendente?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          atendente?: string | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendas: {
        Row: {
          atendente: string
          codigo: string
          created_at: string
          created_by: string
          data_venda: string
          exames: string
          id: string
          tipo: string
          updated_at: string
          valor: number
        }
        Insert: {
          atendente: string
          codigo: string
          created_at?: string
          created_by?: string
          data_venda: string
          exames: string
          id?: string
          tipo: string
          updated_at?: string
          valor: number
        }
        Update: {
          atendente?: string
          codigo?: string
          created_at?: string
          created_by?: string
          data_venda?: string
          exames?: string
          id?: string
          tipo?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_assert_caller: { Args: never; Returns: string }
      admin_create_user: {
        Args: {
          p_atendente?: string
          p_email: string
          p_full_name: string
          p_password: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: string
      }
      admin_delete_user: { Args: { p_user_id: string }; Returns: undefined }
      admin_list_users: {
        Args: never
        Returns: {
          atendente: string
          created_at: string
          email: string
          full_name: string
          id: string
          role: string
        }[]
      }
      admin_reset_password: {
        Args: { p_password: string; p_user_id: string }
        Returns: undefined
      }
      admin_set_atendente: {
        Args: { p_atendente: string; p_user_id: string }
        Returns: undefined
      }
      admin_set_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "atendente"
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
    Enums: {
      app_role: ["admin", "user", "atendente"],
    },
  },
} as const
