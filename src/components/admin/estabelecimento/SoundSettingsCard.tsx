"use client";

import { Volume2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  SOM_ALERTA_OPCOES,
  type SomAlertaTipo,
} from "@/types/estabelecimento-settings";
import { playNewOrderSound, unlockPedidosAudio } from "@/lib/admin/order-alert-sound";
import { cn } from "@/lib/utils";

interface SoundSettingsCardProps {
  enabled: boolean;
  tipo: SomAlertaTipo;
  volume: number;
  onEnabledChange: (enabled: boolean) => void;
  onTipoChange: (tipo: SomAlertaTipo) => void;
  onVolumeChange: (volume: number) => void;
  disabled?: boolean;
}

export function SoundSettingsCard({
  enabled,
  tipo,
  volume,
  onEnabledChange,
  onTipoChange,
  onVolumeChange,
  disabled = false,
}: SoundSettingsCardProps) {
  const handleTest = async () => {
    await unlockPedidosAudio();
    await playNewOrderSound({
      force: true,
      type: tipo,
      volume,
    });
  };

  return (
    <div
      className={cn(
        "group rounded-2xl border bg-white p-5 shadow-sm",
        "transition-all duration-300 ease-out",
        "hover:shadow-md hover:border-[#F6BFD2]/60",
        enabled
          ? "border-[#F6BFD2] ring-1 ring-[#FDE6EE]"
          : "border-[#E5E7EB]",
        disabled && "opacity-60 pointer-events-none"
      )}
    >
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300",
            enabled
              ? "bg-gradient-to-br from-[#C8285F] to-[#E33E70] text-white shadow-md shadow-pink-500/25"
              : "bg-[#F3F4F6] text-[#9CA3AF]"
          )}
        >
          <Volume2 className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[#111827]">
                Som de alerta dos pedidos
              </h3>
              <p className="text-sm text-[#6B7280] mt-1 leading-relaxed">
                Escolha o som, o volume e teste antes de usar no dia a dia.
              </p>
            </div>
            <Switch
              checked={enabled}
              disabled={disabled}
              onCheckedChange={onEnabledChange}
              className={cn(
                "data-[state=checked]:bg-[#C8285F] data-[state=unchecked]:bg-[#D1D5DB]",
                "h-6 w-11 shrink-0",
                "[&>span]:h-5 [&>span]:w-5 [&>span]:data-[state=checked]:translate-x-5"
              )}
              aria-label="Som de alerta dos pedidos"
            />
          </div>

          <div
            className={cn(
              "mt-5 space-y-5 transition-all duration-300",
              !enabled && "opacity-50"
            )}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">
                  Som
                </label>
                <Select
                  value={tipo}
                  disabled={!enabled || disabled}
                  onValueChange={(v) => onTipoChange(v as SomAlertaTipo)}
                >
                  <SelectTrigger className="h-11 rounded-xl border-[#E5E7EB] bg-[#F8F9FC]">
                    <SelectValue placeholder="Selecione o som" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOM_ALERTA_OPCOES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex flex-col items-start">
                          <span>{opt.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-[#9CA3AF]">
                  {
                    SOM_ALERTA_OPCOES.find((o) => o.value === tipo)
                      ?.description
                  }
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[#6B7280] uppercase tracking-wide">
                    Volume
                  </label>
                  <span className="text-xs font-semibold text-[#C8285F] tabular-nums">
                    {volume}%
                  </span>
                </div>
                <div className="pt-2 px-1">
                  <Slider
                    value={[volume]}
                    min={0}
                    max={100}
                    step={5}
                    disabled={!enabled || disabled}
                    onValueChange={(vals) => onVolumeChange(vals[0] ?? 70)}
                    className="[&_[role=slider]]:border-[#C8285F] [&_.bg-primary]:bg-[#C8285F]"
                    aria-label="Volume do alerta"
                  />
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={!enabled || disabled}
              onClick={() => void handleTest()}
              className="h-10 rounded-xl border-[#E5E7EB] hover:border-[#C8285F]/40 hover:bg-[#FDE6EE] hover:text-[#C8285F] transition-all"
            >
              <Play className="w-4 h-4 mr-2" />
              Testar som
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
