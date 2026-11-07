"use client";

import {
  ConfiguracaoLoja,
  diasSemana,
  parseDiasFuncionamento,
} from "@/types/configuracoes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock } from "lucide-react";

interface FuncionamentoCardProps {
  config: ConfiguracaoLoja;
  onChange: (
    field: keyof ConfiguracaoLoja,
    value: ConfiguracaoLoja[keyof ConfiguracaoLoja]
  ) => void;
}

export function FuncionamentoCard({ config, onChange }: FuncionamentoCardProps) {
  const diasFuncionamento = parseDiasFuncionamento(config.dias_funcionamento);

  const handleDiaToggle = (dia: string, checked: boolean) => {
    const novosDias = checked
      ? [...diasFuncionamento, dia]
      : diasFuncionamento.filter((d) => d !== dia);
    onChange("dias_funcionamento", novosDias);
  };

  const formatarDias = () => {
    if (diasFuncionamento.length === 0) return "Nenhum dia selecionado";
    if (diasFuncionamento.length === 7) return "Todos os dias";
    
    const diasOrdenados = diasSemana
      .filter((d) => diasFuncionamento.includes(d.value))
      .map((d) => d.label);

    if (diasOrdenados.length <= 3) {
      return diasOrdenados.join(", ");
    }

    return `${diasOrdenados[0]} a ${diasOrdenados[diasOrdenados.length - 1]}`;
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-lg bg-[#FDE6EE] flex items-center justify-center">
          <Clock className="w-5 h-5 text-[#C8285F]" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#111827]">Funcionamento</h3>
          <p className="text-sm text-[#6B7280]">Horários e dias de operação</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Horários */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="horario_abertura" className="text-sm font-medium text-[#111827] mb-2 block">
              Horário de Abertura
            </Label>
            <Input
              id="horario_abertura"
              type="time"
              value={config.horario_abertura || ""}
              onChange={(e) => onChange("horario_abertura", e.target.value)}
              className="h-11"
            />
          </div>

          <div>
            <Label htmlFor="horario_fechamento" className="text-sm font-medium text-[#111827] mb-2 block">
              Horário de Fechamento
            </Label>
            <Input
              id="horario_fechamento"
              type="time"
              value={config.horario_fechamento || ""}
              onChange={(e) => onChange("horario_fechamento", e.target.value)}
              className="h-11"
            />
          </div>
        </div>

        {/* Dias da Semana */}
        <div>
          <Label className="text-sm font-medium text-[#111827] mb-3 block">
            Dias de Funcionamento
          </Label>
          <div className="grid grid-cols-2 gap-3">
            {diasSemana.map((dia) => (
              <div
                key={dia.value}
                className="flex items-center space-x-2 bg-[#F8F9FC] rounded-lg p-3 border border-[#E5E7EB]"
              >
                <Checkbox
                  id={dia.value}
                  checked={diasFuncionamento.includes(dia.value)}
                  onCheckedChange={(checked) =>
                    handleDiaToggle(dia.value, checked as boolean)
                  }
                />
                <label
                  htmlFor={dia.value}
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  {dia.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Resumo */}
        {(config.horario_abertura || config.horario_fechamento || diasFuncionamento.length > 0) && (
          <div className="bg-[#FDE6EE] rounded-xl p-4 border border-[#C8285F]/20">
            <p className="text-xs font-semibold text-[#C8285F] mb-2">Resumo:</p>
            <div className="space-y-1">
              {diasFuncionamento.length > 0 && (
                <p className="text-sm text-[#111827]">
                  <span className="font-medium">Aberto:</span> {formatarDias()}
                </p>
              )}
              {config.horario_abertura && config.horario_fechamento && (
                <p className="text-sm text-[#111827]">
                  <span className="font-medium">Horário:</span> {config.horario_abertura} às {config.horario_fechamento}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
