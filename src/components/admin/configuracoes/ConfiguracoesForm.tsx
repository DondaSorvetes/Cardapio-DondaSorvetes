"use client";

import { useState, useEffect } from "react";
import { ConfiguracaoLoja } from "@/types/configuracoes";
import { InformacoesGerais } from "./cards/InformacoesGerais";
import { AparenciaCard } from "./cards/AparenciaCard";
import { EnderecoCard } from "./cards/EnderecoCard";
import { ContatoCard } from "./cards/ContatoCard";
import { FuncionamentoCard } from "./cards/FuncionamentoCard";
import { DeliveryCard } from "./cards/DeliveryCard";

interface ConfiguracoesFormProps {
  config: ConfiguracaoLoja;
  onUpdate: (dados: Partial<ConfiguracaoLoja>) => Promise<void>;
  isSaving: boolean;
  activeSection?:
    | "geral"
    | "aparencia"
    | "endereco"
    | "contato"
    | "horario"
    | "delivery";
}

export function ConfiguracoesForm({
  config,
  onUpdate,
  isSaving,
  activeSection = "geral",
}: ConfiguracoesFormProps) {
  const [localConfig, setLocalConfig] = useState(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleChange = (
    field: keyof ConfiguracaoLoja,
    value: ConfiguracaoLoja[keyof ConfiguracaoLoja]
  ) => {
    setLocalConfig((prev) => ({ ...prev, [field]: value }));
    // Preview + save via manager (já tem debounce)
    void onUpdate({ [field]: value });
  };

  return (
    <div className="space-y-4 pb-10">
      {activeSection === "geral" && (
        <InformacoesGerais config={localConfig} onChange={handleChange} />
      )}
      {activeSection === "aparencia" && (
        <AparenciaCard config={localConfig} onChange={handleChange} />
      )}
      {activeSection === "endereco" && (
        <EnderecoCard config={localConfig} onChange={handleChange} />
      )}
      {activeSection === "contato" && (
        <ContatoCard config={localConfig} onChange={handleChange} />
      )}
      {activeSection === "horario" && (
        <FuncionamentoCard config={localConfig} onChange={handleChange} />
      )}
      {activeSection === "delivery" && (
        <DeliveryCard config={localConfig} onChange={handleChange} />
      )}

      {isSaving && (
        <p className="text-xs text-center text-[#9CA3AF]">Salvando alterações…</p>
      )}
    </div>
  );
}
