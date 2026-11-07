import { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { confirmar } from "../lib/confirmar";
import { useReduzirMovimento } from "../lib/acessibilidade";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
// Um import por ícone: o Metro não remove código não usado, e o pacote inteiro
// dobraria o tamanho do app.
import ArrowLeft from "lucide-react-native/icons/arrow-left";
import Banknote from "lucide-react-native/icons/banknote";
import CreditCard from "lucide-react-native/icons/credit-card";
import MapPin from "lucide-react-native/icons/map-pin";
import MessageSquareText from "lucide-react-native/icons/message-square-text";
import Phone from "lucide-react-native/icons/phone";
import QrCode from "lucide-react-native/icons/qr-code";
import { Botao } from "../components/Botao";
import { font, useTheme } from "../theme";
import {
  formatarEndereco,
  formatarTelefone,
  horaSaida,
  linkTelefone,
  resumoPagamento,
  type Entrega,
  type ErroApp,
} from "../lib/entregas";

type Props = {
  entrega: Entrega | null;
  agora: number;
  onFechar: () => void;
  onConcluir: (id: string) => Promise<{ ok: true } | { ok: false; erro: ErroApp }>;
  onConcluida: () => void;
};

function Secao({ titulo, children, ultima }: { titulo: string; children: React.ReactNode; ultima?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.secao, !ultima && { borderBottomColor: t.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text style={[styles.secaoTitulo, { color: t.muted }]} accessibilityRole="header">
        {titulo}
      </Text>
      {children}
    </View>
  );
}

/** Detalhes da entrega (como a tela de pedido do cardápio) + "Marcar como entregue". */
export function EntregaDetalhe({ entrega, agora, onFechar, onConcluir, onConcluida }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const reduzirMovimento = useReduzirMovimento();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const fechar = () => {
    if (enviando) return;
    setErro(null);
    onFechar();
  };

  const concluir = () => {
    if (!entrega || enviando) return;
    confirmar("Confirmar entrega?", `Pedido #${entrega.numero} · ${entrega.cliente_nome}`, "Entregue", async () => {
      setEnviando(true); // segura toques repetidos até o servidor responder
      setErro(null);
      const r = await onConcluir(entrega.id);
      setEnviando(false);
      if (r.ok) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onConcluida();
      } else {
        setErro(r.erro.mensagem);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    });
  };

  const e = entrega;
  const end = e ? formatarEndereco(e.endereco) : null;
  const pag = e ? resumoPagamento(e) : null;
  const tel = e ? linkTelefone(e.cliente_telefone) : null;
  const IconePagamento = e?.meio_pagamento === "dinheiro" ? Banknote : e?.meio_pagamento === "pix" ? QrCode : CreditCard;

  return (
    <Modal visible={Boolean(e)} animationType={reduzirMovimento ? "none" : "slide"} presentationStyle="fullScreen" onRequestClose={fechar} statusBarTranslucent>
      <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={["top", "left", "right"]}>
        <View style={styles.barra}>
          <Pressable
            onPress={fechar}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Voltar para as entregas"
            style={({ pressed }) => [styles.voltar, { opacity: pressed ? 0.5 : 1 }]}
          >
            <ArrowLeft color={t.muted} size={18} />
            <Text style={[styles.voltarTexto, { color: t.muted }]}>Entregas</Text>
          </Pressable>
        </View>

        {e && end && pag && (
          <>
            <ScrollView contentContainerStyle={[styles.conteudo, { paddingBottom: 120 + insets.bottom }]} showsVerticalScrollIndicator={false}>
              <View style={[styles.cabecalho, { borderBottomColor: t.border }]}>
                <Text style={[styles.titulo, { color: t.text }]} accessibilityRole="header">
                  Pedido #{e.numero}
                </Text>
                <Text style={[styles.sub, { color: t.muted }]}>{horaSaida(e.saiu_entrega_at, agora)}</Text>
              </View>

              <Secao titulo="CLIENTE">
                <Text style={[styles.forte, { color: t.text }]}>{e.cliente_nome}</Text>
                {!!e.cliente_telefone && (
                  <Pressable
                    disabled={!tel}
                    onPress={() => tel && void Linking.openURL(tel)}
                    accessibilityRole="link"
                    accessibilityLabel={`Ligar para ${e.cliente_nome}`}
                    style={({ pressed }) => [styles.linha, { opacity: pressed ? 0.6 : 1, marginTop: 10 }]}
                  >
                    <View style={[styles.icone, { borderColor: t.border }]}>
                      <Phone color={t.brand} size={18} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.texto, { color: t.text }]}>{formatarTelefone(e.cliente_telefone)}</Text>
                      <Text style={[styles.pequeno, { color: t.muted }]}>Toque para ligar</Text>
                    </View>
                  </Pressable>
                )}
              </Secao>

              <Secao titulo="ENDEREÇO DE ENTREGA">
                <View style={styles.linha}>
                  <MapPin color={t.muted} size={18} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.forte, { color: t.text }]} selectable>
                      {end.linha1}
                    </Text>
                    {!!end.linha2 && <Text style={[styles.texto, { color: t.muted }]}>{end.linha2}</Text>}
                    {!!end.complemento && (
                      <Text style={[styles.texto, { color: t.text }]}>
                        <Text style={{ color: t.muted }}>Complemento: </Text>
                        {end.complemento}
                      </Text>
                    )}
                    {!!end.referencia && (
                      <Text style={[styles.texto, { color: t.text }]}>
                        <Text style={{ color: t.muted }}>Referência: </Text>
                        {end.referencia}
                      </Text>
                    )}
                  </View>
                </View>
              </Secao>

              <Secao titulo="PAGAMENTO">
                <View style={styles.linha}>
                  <IconePagamento color={t.muted} size={18} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.entre}>
                      <Text style={[styles.forte, { color: t.text }]}>{pag.forma}</Text>
                      <Text style={[styles.total, { color: t.text }]}>{pag.valor}</Text>
                    </View>
                    {!!pag.troco && (
                      <Text
                        style={[
                          styles.texto,
                          pag.levarTroco
                            ? { color: t.warn, fontFamily: font.semibold, backgroundColor: t.warnSoft, padding: 10, borderRadius: 10, marginTop: 8, overflow: "hidden" }
                            : { color: t.muted, marginTop: 2 },
                        ]}
                      >
                        {pag.troco}
                      </Text>
                    )}
                  </View>
                </View>
              </Secao>

              {e.itens.length > 0 && (
                <Secao titulo="ITENS DO PEDIDO" ultima={!e.observacoes}>
                  {e.itens.map((item, i) => (
                    <View key={i} style={[styles.item, i > 0 && { borderTopColor: t.border, borderTopWidth: StyleSheet.hairlineWidth }]}>
                      <Text style={[styles.qtd, { color: t.brand, backgroundColor: t.brandSoft }]}>{item.qtd}x</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.texto, { color: t.text, fontFamily: font.medium }]}>{item.nome}</Text>
                        {!!item.obs && <Text style={[styles.pequeno, { color: t.muted }]}>Obs: {item.obs}</Text>}
                      </View>
                    </View>
                  ))}
                </Secao>
              )}

              {!!e.observacoes && (
                <Secao titulo="OBSERVAÇÕES" ultima>
                  <View style={styles.linha}>
                    <MessageSquareText color={t.muted} size={18} style={{ marginTop: 2 }} />
                    <Text style={[styles.texto, { color: t.text, flex: 1 }]}>{e.observacoes}</Text>
                  </View>
                </Secao>
              )}
            </ScrollView>

            <View style={[styles.rodape, { borderTopColor: t.border, backgroundColor: t.bg, paddingBottom: insets.bottom + 12 }]}>
              {!!erro && (
                <Text
                  style={[styles.erro, { color: t.danger, backgroundColor: t.dangerSoft }]}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="assertive"
                >
                  {erro}
                </Text>
              )}
              <Botao
                titulo="Marcar como entregue"
                onPress={concluir}
                carregando={enviando}
                accessibilityHint="Pede confirmação e conclui a entrega"
              />
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  barra: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4 },
  voltar: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", minHeight: 44, paddingRight: 12 },
  voltarTexto: { fontFamily: font.medium, fontSize: 15 },
  conteudo: { paddingHorizontal: 20 },
  cabecalho: { paddingTop: 8, paddingBottom: 18, borderBottomWidth: StyleSheet.hairlineWidth },
  titulo: { fontFamily: font.bold, fontSize: 26, letterSpacing: -0.5 },
  sub: { fontFamily: font.regular, fontSize: 14, marginTop: 4 },
  secao: { paddingVertical: 18 },
  secaoTitulo: { fontFamily: font.semibold, fontSize: 11, letterSpacing: 1.3, marginBottom: 10 },
  linha: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  entre: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  icone: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  forte: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  total: { fontFamily: font.bold, fontSize: 18 },
  texto: { fontFamily: font.regular, fontSize: 15, lineHeight: 21 },
  pequeno: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, marginTop: 1 },
  item: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 10 },
  qtd: { fontFamily: font.bold, fontSize: 12, minWidth: 30, textAlign: "center", paddingVertical: 3, borderRadius: 6, overflow: "hidden" },
  rodape: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 10 },
  erro: { fontFamily: font.medium, fontSize: 14, borderRadius: 10, padding: 12 },
});
