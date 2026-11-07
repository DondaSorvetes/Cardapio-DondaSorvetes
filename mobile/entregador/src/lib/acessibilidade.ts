import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** "Reduzir movimento" ligado no celular: o app troca animações por mudanças diretas. */
export function useReduzirMovimento() {
  const [reduzir, setReduzir] = useState(false);
  useEffect(() => {
    let vivo = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => vivo && setReduzir(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduzir);
    return () => {
      vivo = false;
      sub.remove();
    };
  }, []);
  return reduzir;
}

/** Fala o texto no TalkBack/VoiceOver (sem efeito se o leitor de tela estiver desligado). */
export function anunciar(texto: string) {
  try {
    AccessibilityInfo.announceForAccessibility(texto);
  } catch {
    /* web antiga sem suporte */
  }
}
