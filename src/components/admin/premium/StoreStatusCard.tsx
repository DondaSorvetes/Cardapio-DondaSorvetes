"use client";

import { useCallback, useMemo, useState } from "react";
import { StorageImage as Image } from "@/components/ui/storage-image";
import Link from "next/link";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  normalizeConfiguracao,
  type ConfiguracaoLoja,
} from "@/types/configuracoes";
import { useConfiguracoesLojaRealtime } from "@/hooks/useConfiguracoesLojaRealtime";
import {
  calcularFuncionamento,
  formatarTempoMedio,
} from "@/lib/admin/horario-loja";
import { setLojaAberta } from "@/actions/admin/configuracoes";
import { toast } from "sonner";

interface StoreStatusCardProps {
  configInicial?: ConfiguracaoLoja | null;
  /** Admin com config:write — pode abrir/fechar a loja */
  canManageStore?: boolean;
  /** Tem acesso à tela de configurações */
  canOpenConfig?: boolean;
  /** Sidebar recolhida: só logo + status */
  collapsed?: boolean;
}

function StoreLogo({ config, size }: { config: ConfiguracaoLoja; size: number }) {
  return (
    <span
      className="relative block shrink-0 overflow-hidden rounded-lg bg-[#C8285F]"
      style={{ width: size, height: size }}
    >
      {config.logo_url ? (
        <Image src={config.logo_url} alt="" fill className="object-cover" sizes={`${size}px`} />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">
          {config.nome.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

function Detail({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-[13px] text-[#6B7280]">{label}</dt>
      <dd
        className={cn(
          "text-right text-[13px] font-medium",
          tone === "ok" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-[#111827]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

export function StoreStatusCard({
  configInicial,
  canManageStore = false,
  canOpenConfig = false,
  collapsed = false,
}: StoreStatusCardProps) {
  const [open, setOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  const { config, loading, status, patchConfig, replaceConfig } =
    useConfiguracoesLojaRealtime(configInicial ?? null);

  const funcionamento = useMemo(
    () =>
      calcularFuncionamento({
        horario_abertura: config?.horario_abertura,
        horario_fechamento: config?.horario_fechamento,
        dias_funcionamento: config?.dias_funcionamento,
        esta_aberto: config?.esta_aberto,
      }),
    [config],
  );

  const lojaAberta = Boolean(config?.esta_aberto);
  const aceitando =
    config?.aceitando_pedidos !== undefined ? Boolean(config.aceitando_pedidos) : lojaAberta;
  const autoAceite = Boolean(config?.aceitar_pedidos_automaticamente);
  const statusLabel = lojaAberta ? "Aberta" : "Fechada";

  const handleToggleLoja = useCallback(async () => {
    if (!canManageStore) {
      toast.error("Sem permissão", {
        description: "Apenas administradores podem abrir ou fechar a loja.",
      });
      return;
    }
    if (!config?.id || toggling) return;
    const next = !lojaAberta;
    setToggling(true);
    patchConfig({ esta_aberto: next, aceitando_pedidos: next });
    try {
      const updated = await setLojaAberta(next);
      replaceConfig(normalizeConfiguracao(updated as Record<string, unknown>));
      toast.success(next ? "Loja aberta" : "Loja fechada", {
        description: next ? "Você está recebendo pedidos" : "Pedidos não serão aceitos",
      });
    } catch (e) {
      console.error(e);
      patchConfig({ esta_aberto: lojaAberta, aceitando_pedidos: aceitando });
      toast.error("Não foi possível atualizar o status da loja", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setToggling(false);
    }
  }, [canManageStore, config?.id, toggling, lojaAberta, aceitando, patchConfig, replaceConfig]);

  if (loading && !config) {
    return (
      <div className={cn("animate-pulse", collapsed ? "mx-auto my-3 h-10 w-10 rounded-lg bg-[#EEF0F3]" : "mx-3 my-3 h-[60px] rounded-xl bg-[#F3F4F6]")} />
    );
  }

  if (!config) {
    if (collapsed) return <div className="mx-auto my-3 h-10 w-10 rounded-lg bg-[#F3F4F6]" />;
    return (
      <div className="mx-3 my-3 rounded-xl border border-dashed border-[#E5E7EB] p-3 text-center">
        <p className="text-xs text-[#6B7280]">Loja não configurada</p>
        {canOpenConfig && (
          <Link href="/admin/configuracoes" className="text-xs font-semibold text-[#C8285F] hover:underline">
            Configurar agora
          </Link>
        )}
      </div>
    );
  }

  const tempoMedio = formatarTempoMedio(config.tempo_entrega_min, config.tempo_entrega_max);
  const recebendo = aceitando && lojaAberta;

  return (
    <div className={collapsed ? "mx-2 my-3" : "mx-3 my-3"}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex w-full items-center rounded-xl text-left transition-colors",
              "hover:bg-[#FBF6F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8285F]/35",
              open && "bg-[#FBF6F7]",
              collapsed ? "justify-center p-1.5" : "gap-3 p-2.5",
            )}
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label={`Loja ${config.nome}: ${statusLabel}. Abrir detalhes`}
            title={collapsed ? `${config.nome} · ${statusLabel}` : undefined}
          >
            <span className="relative block shrink-0">
              <StoreLogo config={config} size={collapsed ? 36 : 40} />
              {collapsed && (
                <span
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white",
                    lojaAberta ? "bg-emerald-500" : "bg-[#C4C7CE]",
                  )}
                />
              )}
            </span>
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-[#111827]">{config.nome}</span>
                <span
                  className={cn(
                    "mt-0.5 flex items-center gap-1.5 text-xs font-medium",
                    lojaAberta ? "text-emerald-700" : "text-[#6B7280]",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", lojaAberta ? "bg-emerald-500" : "bg-[#C4C7CE]")} />
                  {statusLabel}
                </span>
              </span>
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          className="z-[100] w-[min(320px,calc(100vw-2rem))] rounded-xl border border-[#E5E7EB] bg-white p-0 shadow-lg shadow-black/5"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-3 px-4 pb-3 pt-4">
            <StoreLogo config={config} size={40} />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-[#111827]">{config.nome}</p>
              <p className={cn("text-xs font-medium", lojaAberta ? "text-emerald-700" : "text-[#6B7280]")}>
                Loja {statusLabel.toLowerCase()}
              </p>
            </div>
          </div>

          <dl className="divide-y divide-[#F1F2F4] border-y border-[#F1F2F4] px-4">
            <Detail label="Pedidos" value={recebendo ? "Recebendo" : "Pausados"} tone={recebendo ? "ok" : "warn"} />
            <Detail label="Horário" value={funcionamento.titulo} tone={funcionamento.tom === "ok" ? undefined : "warn"} />
            <Detail label="Aceite automático" value={autoAceite ? "Ligado" : "Desligado"} />
            <Detail label="Tempo médio" value={tempoMedio} />
          </dl>

          <div className="space-y-2 p-4">
            {canManageStore ? (
              <button
                type="button"
                disabled={toggling}
                onClick={() => void handleToggleLoja()}
                className={cn(
                  "h-10 w-full rounded-lg text-sm font-semibold transition-colors disabled:opacity-60",
                  lojaAberta
                    ? "border border-[#E5E7EB] bg-white text-[#B42318] hover:bg-red-50"
                    : "bg-emerald-600 text-white hover:bg-emerald-700",
                )}
              >
                {toggling ? "Salvando…" : lojaAberta ? "Fechar loja" : "Abrir loja"}
              </button>
            ) : (
              <p className="text-center text-xs text-[#9CA3AF]">Somente o administrador abre ou fecha a loja.</p>
            )}
            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-[#9CA3AF]">
                {status === "live" ? "Atualizado em tempo real" : status === "error" ? "Sem conexão em tempo real" : "Conectando…"}
              </span>
              {canOpenConfig && (
                <Link
                  href="/admin/configuracoes"
                  onClick={() => setOpen(false)}
                  className="font-semibold text-[#C8285F] hover:underline"
                >
                  Configurações
                </Link>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
