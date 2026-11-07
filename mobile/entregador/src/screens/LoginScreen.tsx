import { useRef, useState, type ComponentRef } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Botao } from "../components/Botao";
import { font, radius, useTheme } from "../theme";

export function LoginScreen({
  onEntrar,
  aviso,
}: {
  onEntrar: (email: string, senha: string) => Promise<string | null>;
  aviso?: string;
}) {
  const t = useTheme();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(aviso ?? null);
  const senhaRef = useRef<ComponentRef<typeof TextInput>>(null);

  const entrar = async () => {
    if (carregando) return;
    if (!email.trim() || !senha) {
      setErro("Informe seu e-mail e sua senha.");
      return;
    }
    setCarregando(true);
    setErro(null);
    const falha = await onEntrar(email, senha);
    // Em caso de sucesso a tela é trocada; só volta o estado se falhou.
    if (falha) {
      setErro(falha);
      setCarregando(false);
    }
  };

  const input = [styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.marca}>
            <Image source={require("../../assets/logo.png")} style={styles.logo} accessibilityLabel="Sorvetes Donda" />
            <Text style={[styles.titulo, { color: t.text }]} accessibilityRole="header">
              Boas-vindas
            </Text>
            <Text style={[styles.sub, { color: t.muted }]}>Entre para ver suas entregas.</Text>
          </View>

          <View style={styles.form}>
            <Text style={[styles.label, { color: t.text }]}>E-mail</Text>
            <TextInput
              style={input}
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              placeholderTextColor={t.muted}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => senhaRef.current?.focus()}
              editable={!carregando}
              accessibilityLabel="E-mail"
            />

            <Text style={[styles.label, { color: t.text, marginTop: 14 }]}>Senha</Text>
            <View>
              <TextInput
                ref={senhaRef}
                style={[input, { paddingRight: 84 }]}
                value={senha}
                onChangeText={setSenha}
                placeholder="Sua senha"
                placeholderTextColor={t.muted}
                secureTextEntry={!mostrar}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={() => void entrar()}
                editable={!carregando}
                accessibilityLabel="Senha"
              />
              <Pressable
                onPress={() => setMostrar((m) => !m)}
                style={styles.mostrar}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={mostrar ? "Esconder senha" : "Mostrar senha"}
              >
                <Text style={{ color: t.brand, fontFamily: font.medium, fontSize: 14 }}>{mostrar ? "Esconder" : "Mostrar"}</Text>
              </Pressable>
            </View>

            {!!erro && (
              <Text
                style={[styles.erro, { color: t.danger, backgroundColor: t.dangerSoft }]}
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
              >
                {erro}
              </Text>
            )}

            <Botao titulo="Entrar" onPress={() => void entrar()} carregando={carregando} style={{ marginTop: 22 }} />
          </View>

          <Text style={[styles.rodape, { color: t.subtle }]}>Acesso exclusivo para entregadores cadastrados pela loja.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 32 },
  marca: { alignItems: "center", marginBottom: 32 },
  logo: { width: 88, height: 88, borderRadius: 22, marginBottom: 20 },
  titulo: { fontFamily: font.bold, fontSize: 26 },
  sub: { fontFamily: font.regular, fontSize: 16, marginTop: 6 },
  form: { width: "100%", maxWidth: 420, alignSelf: "center" },
  label: { fontFamily: font.medium, fontSize: 14, marginBottom: 8 },
  input: { height: 52, borderRadius: radius.input, borderWidth: 1, paddingHorizontal: 16, fontFamily: font.regular, fontSize: 16 },
  mostrar: { position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" },
  erro: { fontFamily: font.medium, fontSize: 14, borderRadius: 10, padding: 12, marginTop: 16 },
  rodape: { fontFamily: font.regular, fontSize: 13, textAlign: "center", marginTop: 32 },
});
