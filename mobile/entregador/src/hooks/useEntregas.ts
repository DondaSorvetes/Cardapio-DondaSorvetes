import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { normalizarEntregas, traduzirErro, type Entrega, type ErroApp } from "../lib/entregas";

export type Conexao = "conectado" | "conectando" | "offline";

/**
 * Entregas do entregador logado.
 * - Uma consulta ao abrir e a cada aviso no canal privado "entregador:<id>"
 *   (o aviso não traz dados; a lista vem da função do banco, com os campos permitidos).
 * - Sem polling: ao (re)conectar o canal e ao voltar do segundo plano, busca de novo,
 *   o que recupera avisos perdidos.
 * - Em segundo plano o canal é fechado (bateria e dados).
 */
export function useEntregas(userId: string, onAcessoNegado: (mensagem: string) => void) {
  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<ErroApp | null>(null);
  const [conexao, setConexao] = useState<Conexao>("conectando");
  const emVoo = useRef<Promise<void> | null>(null);
  const deNovo = useRef(false);
  const canal = useRef<RealtimeChannel | null>(null);
  const negado = useRef(onAcessoNegado);
  negado.current = onAcessoNegado;

  /** Busca a lista; chamadas durante uma busca viram uma única busca depois dela. */
  const buscar = useCallback((): Promise<void> => {
    if (emVoo.current) {
      deNovo.current = true;
      return emVoo.current;
    }
    const run = (async () => {
      do {
        deNovo.current = false;
        const { data, error } = await supabase.rpc("entregador_minhas_entregas");
        if (error) {
          const e = traduzirErro(error);
          if (e.tipo === "sem_acesso" || e.tipo === "desativado") {
            negado.current(e.mensagem);
            return;
          }
          setErro(e);
          if (e.tipo === "conexao") setConexao("offline");
        } else {
          setErro(null);
          setEntregas(normalizarEntregas(data));
        }
      } while (deNovo.current);
    })().finally(() => {
      emVoo.current = null;
      setCarregando(false);
    });
    emVoo.current = run;
    return run;
  }, []);

  const conectar = useCallback(async () => {
    if (canal.current) return;
    setConexao("conectando");
    const { data } = await supabase.auth.getSession();
    if (data.session) await supabase.realtime.setAuth(data.session.access_token);
    const ch = supabase.channel(`entregador:${userId}`, { config: { private: true } });
    canal.current = ch;
    ch.on("broadcast", { event: "entregas_mudaram" }, () => void buscar()).subscribe((status) => {
      if (canal.current !== ch) return;
      if (status === "SUBSCRIBED") {
        setConexao("conectado");
        void buscar(); // primeira carga e recuperação após reconectar
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setConexao("offline");
      }
    });
  }, [buscar, userId]);

  const desconectar = useCallback(() => {
    const ch = canal.current;
    canal.current = null;
    if (ch) void supabase.removeChannel(ch);
  }, []);

  useEffect(() => {
    void buscar();
    void conectar();
    const onChange = (state: AppStateStatus) => {
      if (state === "active") {
        void conectar();
        void buscar();
      } else if (state === "background") {
        desconectar();
      }
    };
    const sub = AppState.addEventListener("change", onChange);
    return () => {
      sub.remove();
      desconectar();
    };
  }, [buscar, conectar, desconectar]);

  const atualizar = useCallback(async () => {
    setAtualizando(true);
    try {
      if (!canal.current) await conectar();
      await buscar();
    } finally {
      setAtualizando(false);
    }
  }, [buscar, conectar]);

  /**
   * Conclui a entrega no banco. Só tira o card da lista com a confirmação do
   * servidor: sem internet a entrega NÃO é marcada e o card continua.
   */
  const concluir = useCallback(
    async (id: string): Promise<{ ok: true } | { ok: false; erro: ErroApp }> => {
      const { error } = await supabase.rpc("entregador_concluir_entrega", { p_pedido_id: id });
      if (error) {
        const e = traduzirErro(error);
        if (e.tipo === "sem_acesso" || e.tipo === "desativado") negado.current(e.mensagem);
        if (e.tipo === "indisponivel") void buscar();
        return { ok: false, erro: e };
      }
      setEntregas((lista) => lista.filter((x) => x.id !== id));
      return { ok: true };
    },
    [buscar],
  );

  return { entregas, carregando, atualizando, erro, conexao, atualizar, concluir };
}
