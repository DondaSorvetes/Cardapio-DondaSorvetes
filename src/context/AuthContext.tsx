"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { setCustomerResourceIdentity } from "@/lib/customer-resource";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export type ClienteData = {
  id: string;
  nome: string | null;
  telefone: string | null;
  endereco: string | null;
  created_at?: string | null;
  enderecos_adicionais?: unknown;
  email?: string | null;
};

type AuthContextType = {
  user: ClienteData | null;
  session: { user: ClienteData } | null;
  cliente: ClienteData | null;
  loading: boolean;
  needsProfileCompletion: boolean;
  refreshCliente: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);
let sessaoEmAndamento: Promise<ClienteData | null> | null = null;

function discardPendingSession(generation: { current: number }) {
  generation.current++;
  sessaoEmAndamento = null;
}

async function consultarSessao(): Promise<ClienteData | null> {
  if (!sessaoEmAndamento) {
    const request: Promise<ClienteData | null> = fetch("/api/auth/sessao", {
      cache: "no-store",
    })
      .then(async (resposta) => {
        if (!resposta.ok)
          throw new Error("Não foi possível consultar a sessão.");
        const dados = await resposta.json();
        return (dados.cliente as ClienteData | null) ?? null;
      })
      .finally(() => {
        if (sessaoEmAndamento === request) sessaoEmAndamento = null;
      });
    sessaoEmAndamento = request;
  }
  return sessaoEmAndamento;
}

export function AuthProvider({
  children,
  initialCliente,
}: {
  children: ReactNode;
  initialCliente?: ClienteData | null;
}) {
  const [cliente, setCliente] = useState<ClienteData | null>(() => {
    if (typeof window !== "undefined" && initialCliente !== undefined)
      setCustomerResourceIdentity(initialCliente?.id ?? null);
    return initialCliente ?? null;
  });
  const [loading, setLoading] = useState(initialCliente === undefined);
  const router = useRouter();
  const generation = useRef(0);

  // Verifica se precisa completar perfil
  const needsProfileCompletion = Boolean(
    cliente && (!cliente.nome || !cliente.telefone || !cliente.endereco),
  );

  // Busca a sessão do cliente via API
  const fetchSessao = useCallback(async () => {
    const version = generation.current;
    try {
      const next = await consultarSessao();
      if (version !== generation.current) return;
      setCustomerResourceIdentity(next?.id ?? null);
      setCliente(next);
    } catch {
      if (version !== generation.current) return;
      toast.error("Erro ao buscar sessão");
      setCustomerResourceIdentity(null);
      setCliente(null);
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, []);

  // Função para rebuscar cliente (usar após atualizar perfil)
  const refreshCliente = fetchSessao;

  // Função de logout
  const signOut = async () => {
    try {
      const response = await fetch("/api/auth/sair", { method: "POST" });
      if (!response.ok) throw new Error("Não foi possível sair.");
      discardPendingSession(generation);
      setCustomerResourceIdentity(null);
      setCliente(null);

      // Limpa o carrinho do localStorage
      localStorage.removeItem("carrinho-itens");
      localStorage.removeItem("carrinho-cupom");

      router.push("/");
      router.refresh();
    } catch {
      toast.error("Erro ao fazer logout");
    }
  };

  // Carrega sessão ao montar
  useEffect(() => {
    if (initialCliente === undefined) void fetchSessao();
    const refresh = () => {
      discardPendingSession(generation);
      void fetchSessao();
    };
    window.addEventListener("donda-customer-session-changed", refresh);
    return () => {
      discardPendingSession(generation);
      window.removeEventListener("donda-customer-session-changed", refresh);
    };
  }, [fetchSessao, initialCliente]);

  // Cria objeto session compatível com o código existente
  const session = cliente ? { user: cliente } : null;

  return (
    <AuthContext.Provider
      value={{
        user: cliente,
        session,
        cliente,
        loading,
        needsProfileCompletion,
        refreshCliente,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
}
