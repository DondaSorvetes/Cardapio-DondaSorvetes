import { Alert, Platform } from "react-native";

/**
 * Pergunta de confirmação que funciona no app e na versão web (iPhone):
 * no navegador o Alert.alert do React Native não faz nada, então usa window.confirm.
 */
export function confirmar(titulo: string, mensagem: string, botao: string, aoConfirmar: () => void, destrutivo = false) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${titulo}\n\n${mensagem}`)) aoConfirmar();
    return;
  }
  Alert.alert(
    titulo,
    mensagem,
    [
      { text: "Cancelar", style: "cancel" },
      { text: botao, style: destrutivo ? "destructive" : "default", onPress: aoConfirmar },
    ],
    { cancelable: true },
  );
}
