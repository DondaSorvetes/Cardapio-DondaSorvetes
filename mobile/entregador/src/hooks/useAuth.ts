import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { traduzirErro } from "../lib/entregas";

export type Perfil = { id: string; nome: string };
export type AuthState =
  | { status: "carregando" }
  | { status: "saiu"; aviso?: string }
  | { status: "entrou"; session: Session; perfil: Perfil };

/** Confere no banco se a conta é de entregador ativo (não basta ter login). */
async function carregarPerfil(): Promise<Perfil> {
  const { data, error } = await supabase.rpc("entregador_perfil");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("NAO_ENTREGADOR");
  return { id: String(row.id), nome: String(row.nome) };
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: "carregando" });

  /** Sai e mostra o motivo na tela de login (ex.: acesso desativado). */
  const sair = useCallback(async (aviso?: string) => {
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    setState({ status: "saiu", aviso });
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!vivo) return;
      if (!data.session) return setState({ status: "saiu" });
      try {
        const perfil = await carregarPerfil();
        if (vivo) setState({ status: "entrou", session: data.session, perfil });
      } catch (error) {
        const erro = traduzirErro(error);
        // Sem internet ao abrir: mantém a sessão; a lista tenta de novo quando voltar.
        if (erro.tipo === "conexao" && vivo)
          setState({ status: "entrou", session: data.session, perfil: { id: data.session.user.id, nome: "" } });
        else if (vivo) await sair(erro.tipo === "desconhecido" ? undefined : erro.mensagem);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") setState((s) => (s.status === "saiu" ? s : { status: "saiu" }));
      if (event === "TOKEN_REFRESHED" && session) {
        // Canal privado do tempo real usa o token novo.
        void supabase.realtime.setAuth(session.access_token);
        setState((s) => (s.status === "entrou" ? { ...s, session } : s));
      }
    });
    return () => {
      vivo = false;
      sub.subscription.unsubscribe();
    };
  }, [sair]);

  const entrar = useCallback(
    async (email: string, senha: string): Promise<string | null> => {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
      if (error || !data.session) return traduzirErro(error ?? "invalid login credentials").mensagem;
      try {
        const perfil = await carregarPerfil();
        setState({ status: "entrou", session: data.session, perfil });
        return null;
      } catch (e) {
        const erro = traduzirErro(e);
        await supabase.auth.signOut({ scope: "local" }).catch(() => {});
        setState({ status: "saiu" });
        return erro.mensagem;
      }
    },
    [],
  );

  /** Completa o nome quando o perfil não pôde ser lido offline. */
  const atualizarPerfil = useCallback(async () => {
    try {
      const perfil = await carregarPerfil();
      setState((s) => (s.status === "entrou" ? { ...s, perfil } : s));
    } catch (error) {
      const erro = traduzirErro(error);
      if (erro.tipo === "sem_acesso" || erro.tipo === "desativado") await sair(erro.mensagem);
    }
  }, [sair]);

  return { state, entrar, sair, atualizarPerfil };
}
