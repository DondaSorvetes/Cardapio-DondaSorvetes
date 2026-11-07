"use client";

import { ConfiguracaoLoja, estadosBrasil } from "@/types/configuracoes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MapPin, ExternalLink } from "lucide-react";

interface EnderecoCardProps {
  config: ConfiguracaoLoja;
  onChange: (
    field: keyof ConfiguracaoLoja,
    value: ConfiguracaoLoja[keyof ConfiguracaoLoja]
  ) => void;
}

export function EnderecoCard({ config, onChange }: EnderecoCardProps) {
  const openMaps = () => {
    if (config.endereco && config.cidade) {
      const query = `${config.endereco}, ${config.cidade}, ${config.estado || ""}`;
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
        "_blank"
      );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-lg bg-[#FDE6EE] flex items-center justify-center">
          <MapPin className="w-5 h-5 text-[#C8285F]" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#111827]">Endereço</h3>
          <p className="text-sm text-[#6B7280]">Localização da loja</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="endereco" className="text-sm font-medium text-[#111827] mb-2 block">
            Endereço Completo
          </Label>
          <Input
            id="endereco"
            value={config.endereco || ""}
            onChange={(e) => onChange("endereco", e.target.value)}
            placeholder="Rua, número, complemento"
            className="h-11"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cidade" className="text-sm font-medium text-[#111827] mb-2 block">
              Cidade
            </Label>
            <Input
              id="cidade"
              value={config.cidade || ""}
              onChange={(e) => onChange("cidade", e.target.value)}
              placeholder="Ex: São Paulo"
              className="h-11"
            />
          </div>

          <div>
            <Label htmlFor="estado" className="text-sm font-medium text-[#111827] mb-2 block">
              Estado
            </Label>
            <Select value={config.estado || ""} onValueChange={(value) => onChange("estado", value)}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {estadosBrasil.map((estado) => (
                  <SelectItem key={estado} value={estado}>
                    {estado}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {config.endereco && config.cidade && (
          <Button
            variant="outline"
            size="sm"
            onClick={openMaps}
            className="w-full"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Visualizar no Google Maps
          </Button>
        )}
      </div>
    </div>
  );
}
