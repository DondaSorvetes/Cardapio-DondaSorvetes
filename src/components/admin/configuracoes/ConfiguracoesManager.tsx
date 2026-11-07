"use client";

import { useState, useCallback, useRef } from "react";
import {
  ConfiguracaoLoja,
  normalizeConfiguracao,
} from "@/types/configuracoes";
import { updateConfiguracoesLoja } from "@/actions/admin/configuracoes";
import { toast } from "sonner";
import { ConfiguracoesForm } from "./ConfiguracoesForm";
import { PreviewLoja } from "./PreviewLoja";
import { StatusCards } from "./StatusCards";
import {
  Settings2,
  Store,
  ImageIcon,
  MapPin,
  Phone,
  Clock,
  Truck,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfiguracoesManagerProps {
  configuracaoInicial: ConfiguracaoLoja;
}

const SECTIONS = [
  { id: "geral", label: "Geral", icon: Store },
  { id: "aparencia", label: "Aparência", icon: ImageIcon },
  { id: "endereco", label: "Endereço", icon: MapPin },
  { id: "contato", label: "Contato", icon: Phone },
  { id: "horario", label: "Horários", icon: Clock },
  { id: "delivery", label: "Delivery", icon: Truck },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

export function ConfiguracoesManager({
  configuracaoInicial,
}: ConfiguracoesManagerProps) {
  const [config, setConfig] = useState<ConfiguracaoLoja>(configuracaoInicial);
  const [isSaving, setIsSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">(
    "idle"
  );
  const [activeSection, setActiveSection] = useState<SectionId>("geral");
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedHideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleUpdate = useCallback(
    async (dadosAtualizados: Partial<ConfiguracaoLoja>) => {
      if (!config.id || config.id === "default" || config.id === 0) {
        toast.error("Configuração ainda não foi criada no banco");
        return;
      }

      // Preview imediato
      setConfig((prev) => ({ ...prev, ...dadosAtualizados }));
      setIsSaving(true);
      setSaveState("idle");

      try {
        const data = await updateConfiguracoesLoja(config.id, dadosAtualizados);
        const normalized = normalizeConfiguracao(data as Record<string, unknown>);
        setConfig((prev) => ({
          ...prev,
          ...normalized,
          // Mantém array de dias no form
          dias_funcionamento:
            dadosAtualizados.dias_funcionamento !== undefined
              ? Array.isArray(dadosAtualizados.dias_funcionamento)
                ? dadosAtualizados.dias_funcionamento
                : normalized.dias_funcionamento
              : prev.dias_funcionamento,
        }));
        setSaveState("saved");

        if (savedHideRef.current) clearTimeout(savedHideRef.current);
        savedHideRef.current = setTimeout(() => setSaveState("idle"), 2200);
      } catch (error) {
        console.error("Erro ao salvar:", error);
        setSaveState("error");
        toast.error("Erro ao salvar alterações");
        // Reverte para estado anterior do servidor não é trivial aqui;
        // mantém UI e deixa o usuário corrigir
      } finally {
        setIsSaving(false);
      }
    },
    [config.id]
  );

  // Debounced update vindo do form (evita spam de toasts)
  const handleFormUpdate = useCallback(
    async (dados: Partial<ConfiguracaoLoja>) => {
      // Atualiza preview na hora
      setConfig((prev) => ({ ...prev, ...dados }));

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

      return new Promise<void>((resolve) => {
        saveTimeoutRef.current = setTimeout(async () => {
          await handleUpdate(dados);
          resolve();
        }, 450);
      });
    },
    [handleUpdate]
  );

  return (
    <div className="min-h-full bg-[#F7F8FC]">
      {/* Page header */}
      <div className="bg-white border-b border-[#E5E7EB] px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#C8285F] to-[#E33E70] flex items-center justify-center shadow-md shadow-pink-500/20">
              <Settings2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#111827]">
                Configurações da Loja
              </h1>
              <p className="text-sm text-[#6B7280] mt-0.5">
                Ajuste identidade, horários, delivery e contatos
              </p>
            </div>
          </div>

          <div
            className={cn(
              "inline-flex items-center gap-2 self-start sm:self-auto px-3.5 py-2 rounded-xl text-sm font-medium border transition-all",
              isSaving && "bg-white border-[#E5E7EB] text-[#6B7280]",
              !isSaving &&
                saveState === "saved" &&
                "bg-emerald-50 border-emerald-200 text-emerald-700",
              !isSaving &&
                saveState === "error" &&
                "bg-red-50 border-red-200 text-red-700",
              !isSaving &&
                saveState === "idle" &&
                "bg-[#F8F9FC] border-[#E5E7EB] text-[#6B7280]"
            )}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : saveState === "saved" ? (
              <>
                <Check className="w-4 h-4" />
                Alterações salvas
              </>
            ) : saveState === "error" ? (
              <>
                <AlertCircle className="w-4 h-4" />
                Erro ao salvar
              </>
            ) : (
              <>
                <Check className="w-4 h-4 opacity-40" />
                Tudo sincronizado
              </>
            )}
          </div>
        </div>
      </div>

      {/* Status summary */}
      <StatusCards config={config} />

      {/* Section nav + content */}
      <div className="px-6 py-5">
        {/* Section tabs */}
        <div className="mb-5 overflow-x-auto">
          <div className="inline-flex min-w-full sm:min-w-0 gap-1 p-1 bg-white border border-[#E5E7EB] rounded-2xl">
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap",
                    active
                      ? "bg-[#FDE6EE] text-[#C8285F] shadow-sm"
                      : "text-[#6B7280] hover:bg-[#F8F9FC] hover:text-[#111827]"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
          {/* Form column */}
          <div className="min-w-0">
            <ConfiguracoesForm
              config={config}
              onUpdate={handleFormUpdate}
              isSaving={isSaving}
              activeSection={activeSection}
            />
          </div>

          {/* Preview column */}
          <div className="xl:sticky xl:top-4">
            <PreviewLoja config={config} />
          </div>
        </div>
      </div>
    </div>
  );
}
