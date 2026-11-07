import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, AppState, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
// Só os 4 pesos usados (o pacote inteiro embutiria ~6 MB de fontes).
import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { useAuth } from "./src/hooks/useAuth";
import { configurado } from "./src/lib/supabase";
import { LoginScreen } from "./src/screens/LoginScreen";
import { EntregasScreen } from "./src/screens/EntregasScreen";
import { useTheme } from "./src/theme";

function Conteudo() {
  const t = useTheme();
  const { state, entrar, sair, atualizarPerfil } = useAuth();
  const semNome = state.status === "entrou" && !state.perfil.nome;

  // Abriu sem internet: completa o nome (e confere o acesso) ao voltar para o app.
  useEffect(() => {
    if (!semNome) return;
    void atualizarPerfil();
    const sub = AppState.addEventListener("change", (s) => s === "active" && void atualizarPerfil());
    return () => sub.remove();
  }, [semNome, atualizarPerfil]);

  if (!configurado) {
    return (
      <View style={[styles.centro, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.text, textAlign: "center", padding: 24 }}>
          App sem configuração do Supabase (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).
        </Text>
      </View>
    );
  }
  if (state.status === "carregando") {
    return (
      <View style={[styles.centro, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.brand} />
      </View>
    );
  }
  if (state.status === "saiu") return <LoginScreen key={state.aviso ?? "login"} onEntrar={entrar} aviso={state.aviso} />;
  return (
    <EntregasScreen
      key={state.perfil.id}
      perfil={state.perfil}
      onSair={() => void sair()}
      onAcessoNegado={(mensagem) => void sair(mensagem)}
    />
  );
}

export default function App() {
  const [fontsOk] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {fontsOk ? <Conteudo /> : <View style={{ flex: 1 }} />}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center" },
});
