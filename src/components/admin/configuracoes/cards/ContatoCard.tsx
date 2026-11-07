"use client";

import { ConfiguracaoLoja } from "@/types/configuracoes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, MessageCircle, Instagram, Facebook } from "lucide-react";

interface ContatoCardProps {
  config: ConfiguracaoLoja;
  onChange: (
    field: keyof ConfiguracaoLoja,
    value: ConfiguracaoLoja[keyof ConfiguracaoLoja]
  ) => void;
}

export function ContatoCard({ config, onChange }: ContatoCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-lg bg-[#FDE6EE] flex items-center justify-center">
          <Phone className="w-5 h-5 text-[#C8285F]" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#111827]">Contato</h3>
          <p className="text-sm text-[#6B7280]">Telefone e redes sociais</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="telefone" className="text-sm font-medium text-[#111827] mb-2 flex items-center gap-2">
            <Phone className="w-4 h-4 text-[#C8285F]" />
            Telefone
          </Label>
          <Input
            id="telefone"
            value={config.telefone || ""}
            onChange={(e) => onChange("telefone", e.target.value)}
            placeholder="(00) 00000-0000"
            className="h-11"
          />
        </div>

        <div>
          <Label htmlFor="whatsapp" className="text-sm font-medium text-[#111827] mb-2 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-[#25D366]" />
            WhatsApp
          </Label>
          <Input
            id="whatsapp"
            value={config.whatsapp || ""}
            onChange={(e) => onChange("whatsapp", e.target.value)}
            placeholder="(00) 00000-0000"
            className="h-11"
          />
          <p className="text-xs text-[#6B7280] mt-1">
            Número para contato direto via WhatsApp
          </p>
        </div>

        <div>
          <Label htmlFor="instagram" className="text-sm font-medium text-[#111827] mb-2 flex items-center gap-2">
            <Instagram className="w-4 h-4 text-[#E4405F]" />
            Instagram
          </Label>
          <Input
            id="instagram"
            value={config.instagram || ""}
            onChange={(e) => onChange("instagram", e.target.value)}
            placeholder="@seuperfil ou URL completa"
            className="h-11"
          />
        </div>

        <div>
          <Label htmlFor="facebook" className="text-sm font-medium text-[#111827] mb-2 flex items-center gap-2">
            <Facebook className="w-4 h-4 text-[#1877F2]" />
            Facebook
          </Label>
          <Input
            id="facebook"
            value={config.facebook || ""}
            onChange={(e) => onChange("facebook", e.target.value)}
            placeholder="URL da página"
            className="h-11"
          />
        </div>
      </div>
    </div>
  );
}
