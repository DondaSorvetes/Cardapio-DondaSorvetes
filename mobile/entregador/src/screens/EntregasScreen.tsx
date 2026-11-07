import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import LogOut from "lucide-react-native/icons/log-out";
import { BarraBusca } from "../components/BarraBusca";
import { EntregaCard } from "../components/EntregaCard";
import { EstadoVazio } from "../components/EstadoVazio";
import { EntregaDetalhe } from "./EntregaDetalhe";
import { confirmar } from "../lib/confirmar";
import { anunciar, useReduzirMovimento } from "../lib/acessibilidade";
import { contagemEntregas, filtrarEntregas, saudacao } from "../lib/entregas";
import { useEntregas } from "../hooks/useEntregas";
import type { Perfil } from "../hooks/useAuth";
import { font, radius, useTheme } from "../theme";

if (Platform.OS === "android") UIManager.setLayoutAnimationEnabledExperimental?.(true);

/** A busca aparece a partir deste número de entregas. */
const BUSCA_A_PARTIR_DE = 2;

export function EntregasScreen({
  perfil,
  onSair,
  onAcessoNegado,
}: {
  perfil: Perfil;
  onSair: () => void;
  onAcessoNegado: (mensagem: string) => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduzirMovimento = useReduzirMovimento();
  const { entregas, carregando, atualizando, erro, conexao, atualizar, concluir } = useEntregas(perfil.id, onAcessoNegado);
  const [agora, setAgora] = useState(Date.now());
  const aviso = useRef(new Animated.Value(0)).current;
  const [aberta, setAberta] = useState<string | null>(null);
  const [textoAviso, setTextoAviso] = useState("Entrega concluída");
  const [busca, setBusca] = useState("");
  const concluidaAgora = useRef<string | null>(null);
  const conhecidas = useRef<Set<string> | null>(null);
  const entregaAberta = aberta ? (entregas.find((e) => e.id === aberta) ?? null) : null;
  const filtradas = useMemo(() => filtrarEntregas(entregas, busca), [entregas, busca]);
  const quantidade = entregas.length;
  const mostrarBusca = quantidade >= BUSCA_A_PARTIR_DE || busca.length > 0;

  // "há X min" no card: atualiza a cada minuto, sem buscar nada no servidor.
  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  // Leitor de tela: avisa as entregas novas que chegarem (não as da primeira carga).
  useEffect(() => {
    if (carregando) return;
    const ids = new Set(entregas.map((e) => e.id));
    if (conhecidas.current) {
      const novas = entregas.filter((e) => !conhecidas.current!.has(e.id));
      if (novas.length === 1) anunciar(`Nova entrega: pedido ${novas[0].numero}, ${novas[0].cliente_nome}`);
      else if (novas.length > 1) anunciar(`${novas.length} novas entregas`);
    }
    conhecidas.current = ids;
  }, [entregas, carregando]);

  const mostrarAviso = useCallback(
    (texto: string) => {
      setTextoAviso(texto);
      anunciar(texto);
      if (reduzirMovimento) {
        aviso.setValue(1);
        setTimeout(() => aviso.setValue(0), 2200);
        return;
      }
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      aviso.setValue(0);
      Animated.sequence([
        Animated.timing(aviso, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(1600),
        Animated.timing(aviso, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    },
    [aviso, reduzirMovimento],
  );

  const concluirAberta = useCallback(
    async (id: string) => {
      concluidaAgora.current = id;
      const r = await concluir(id);
      if (!r.ok) concluidaAgora.current = null;
      return r;
    },
    [concluir],
  );

  // O pedido aberto saiu da lista: concluído aqui (aviso de sucesso) ou mudado
  // pela loja (cancelado, voltou de status): fecha os detalhes e explica.
  useEffect(() => {
    if (!aberta || carregando || entregaAberta) return;
    const foiAqui = concluidaAgora.current === aberta;
    concluidaAgora.current = null;
    setAberta(null);
    mostrarAviso(foiAqui ? "Entrega concluída" : "Este pedido não está mais com você");
  }, [aberta, carregando, entregaAberta, mostrarAviso]);

  // Sem entregas suficientes, a busca some e não pode esconder pedidos.
  useEffect(() => {
    if (quantidade < BUSCA_A_PARTIR_DE && busca) setBusca("");
  }, [quantidade, busca]);

  const confirmarSaida = () =>
    confirmar("Sair do app?", "Você vai precisar entrar de novo com e-mail e senha.", "Sair", onSair, true);

  const primeiroNome = perfil.nome.trim().split(/\s+/)[0];
  const resumo = carregando && quantidade === 0 ? "Carregando suas entregas…" : contagemEntregas(quantidade);

  const vazioBusca = (
    <View style={styles.semResultado}>
      <Text style={[styles.semResultadoTitulo, { color: t.text }]}>Nenhuma entrega encontrada</Text>
      <Text style={[styles.semResultadoTexto, { color: t.muted }]}>Nada corresponde a “{busca}”.</Text>
      <Pressable
        onPress={() => setBusca("")}
        accessibilityRole="button"
        style={({ pressed }) => [styles.limparBusca, { borderColor: t.border, opacity: pressed ? 0.6 : 1 }]}
      >
        <Text style={[styles.limparBuscaTexto, { color: t.brand }]}>Limpar busca</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <View style={styles.headerTopo}>
          <Text style={[styles.saudacao, { color: t.muted }]} maxFontSizeMultiplier={1.8}>
            {saudacao(agora)}
          </Text>
          <Pressable
            onPress={confirmarSaida}
            accessibilityRole="button"
            accessibilityLabel="Sair do app"
            hitSlop={8}
            style={({ pressed }) => [styles.sair, { borderColor: t.border, opacity: pressed ? 0.6 : 1 }]}
          >
            <LogOut color={t.muted} size={16} />
            <Text style={[styles.sairTexto, { color: t.muted }]} maxFontSizeMultiplier={1.6}>
              Sair
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.ola, { color: t.text }]} accessibilityRole="header" numberOfLines={2}>
          {primeiroNome ? `Olá, ${primeiroNome}` : "Olá"}
        </Text>
        <View style={styles.contagem} accessibilityLiveRegion="polite">
          {quantidade > 0 && <View style={[styles.ponto, { backgroundColor: t.brand }]} />}
          <Text style={[styles.resumo, { color: quantidade > 0 ? t.text : t.muted }]}>{resumo}</Text>
        </View>
        {mostrarBusca && (
          <View style={{ marginTop: 16 }}>
            <BarraBusca valor={busca} onChange={setBusca} />
            {busca.length > 0 && filtradas.length > 0 && (
              <Text style={[styles.resultado, { color: t.muted }]} accessibilityLiveRegion="polite">
                {filtradas.length === 1 ? "1 entrega encontrada" : `${filtradas.length} entregas encontradas`}
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Indicador só quando há problema de conexão. */}
      {conexao === "offline" && (
        <View style={[styles.faixa, { backgroundColor: t.warnSoft }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Text style={[styles.faixaTexto, { color: t.warn }]}>Sem conexão. Tentando reconectar…</Text>
        </View>
      )}
      {erro && erro.tipo !== "conexao" && (
        <View style={[styles.faixa, { backgroundColor: t.dangerSoft }]} accessibilityRole="alert">
          <Text style={[styles.faixaTexto, { color: t.danger }]}>{erro.mensagem}</Text>
        </View>
      )}

      {carregando && quantidade === 0 ? (
        <View style={styles.centro}>
          <ActivityIndicator color={t.brand} accessibilityLabel="Carregando suas entregas" />
        </View>
      ) : (
        <FlatList
          data={filtradas}
          keyExtractor={(e) => e.id}
          renderItem={({ item }) => <EntregaCard entrega={item} agora={agora} onAbrir={setAberta} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={[styles.lista, { paddingBottom: insets.bottom + 24 }, filtradas.length === 0 && { flexGrow: 1 }]}
          ListEmptyComponent={busca ? vazioBusca : <EstadoVazio />}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={atualizando}
              onRefresh={() => void atualizar()}
              tintColor={t.brand}
              colors={[t.brand]}
              accessibilityLabel="Atualizar entregas"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <Animated.View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={[
          styles.toast,
          {
            backgroundColor: t.text,
            bottom: insets.bottom + 20,
            opacity: aviso,
            transform: reduzirMovimento ? [] : [{ translateY: aviso.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          },
        ]}
      >
        <Text style={[styles.toastTexto, { color: t.bg }]}>{textoAviso}</Text>
      </Animated.View>

      <EntregaDetalhe
        entrega={entregaAberta}
        agora={agora}
        onFechar={() => setAberta(null)}
        onConcluir={concluirAberta}
        onConcluida={() => {
          /* o card some da lista e o efeito acima fecha os detalhes com o aviso */
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  headerTopo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  saudacao: { fontFamily: font.medium, fontSize: 15 },
  sair: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  sairTexto: { fontFamily: font.medium, fontSize: 14 },
  ola: { fontFamily: font.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.6, marginTop: 2 },
  contagem: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  resumo: { fontFamily: font.medium, fontSize: 16 },
  resultado: { fontFamily: font.regular, fontSize: 13, marginTop: 8, marginLeft: 4 },
  faixa: { paddingHorizontal: 20, paddingVertical: 10 },
  faixaTexto: { fontFamily: font.medium, fontSize: 14 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
  lista: { paddingHorizontal: 16, paddingTop: 4 },
  semResultado: { alignItems: "center", paddingTop: 48, paddingHorizontal: 24, gap: 6 },
  semResultadoTitulo: { fontFamily: font.semibold, fontSize: 17, textAlign: "center" },
  semResultadoTexto: { fontFamily: font.regular, fontSize: 15, textAlign: "center" },
  limparBusca: { marginTop: 12, minHeight: 44, paddingHorizontal: 18, borderRadius: radius.pill, borderWidth: 1, justifyContent: "center" },
  limparBuscaTexto: { fontFamily: font.semibold, fontSize: 15 },
  toast: {
    position: "absolute",
    alignSelf: "center",
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  toastTexto: { fontFamily: font.semibold, fontSize: 15 },
});
