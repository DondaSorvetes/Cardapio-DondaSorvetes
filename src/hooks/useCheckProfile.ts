"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRouter } from "next/navigation";

export type Cliente = {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  created_at: string;
};

export function useCheckProfile() {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkProfile() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/auth");
          return;
        }

        const { data, error } = await supabase
          .from("clientes")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Erro ao buscar perfil:", error);
          return;
        }

        setCliente(data as Cliente);

        // Verifica se telefone ou endereço estão vazios
        if (!data?.telefone || !data?.endereco) {
          router.push("/completar-cadastro");
        }
      } finally {
        setLoading(false);
      }
    }

    checkProfile();
  }, [router]);

  return { cliente, loading };
}
