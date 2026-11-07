"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAutosave, type AutosaveStatus } from "./autosave";
import { hhmm, validateConfig, type FieldErrors } from "./validation";
import Link from "next/link";
import { StorageImage as Image } from "@/components/ui/storage-image";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ConfiguracaoLoja,
  diasSemana,
  estadosBrasil,
  normalizeConfiguracao,
  parseDiasFuncionamento,
} from "@/types/configuracoes";
import { updateConfiguracoesLoja } from "@/actions/admin/configuracoes";
import { uploadStoreImage } from "@/lib/image/upload-store.client";
import { cn } from "@/lib/utils";

/** Cor principal da loja */
const BRAND = "#C8285F";
const BRAND_SOFT = "#FDE6EE";

const SECTIONS = [
  { id: "geral", label: "Geral" },
  { id: "aparencia", label: "Aparência" },
  { id: "endereco", label: "Endereço" },
  { id: "contato", label: "Contato" },
  { id: "horario", label: "Horários" },
  { id: "delivery", label: "Delivery" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

/* ─── UI (mesmo layout de Configurações) ──────────────────────────────── */

function SectionTitle({ children, status }: { children: React.ReactNode; status?: React.ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-lg font-semibold text-[#111827]">{children}</h2>
      {status}
    </div>
  );
}

function SectionHint({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-sm text-[#6B7280]">{children}</p>;
}

function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-[#E5E7EB] bg-white",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Row({
  title,
  description,
  children,
  last,
  align = "center",
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  last?: boolean;
  align?: "center" | "start";
}) {
  return (
    <div
      className={cn(
        "admin-settings-row px-4 sm:px-6 py-4 min-h-[64px]",
        align === "center" ? "items-center" : "items-start",
        !last && "border-b border-[#E5E7EB]",
      )}
    >
      <div className="min-w-0">
        <p className="text-[17px] font-semibold leading-snug text-[#111827]">
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-[#6B7280]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="admin-settings-value">{children}</div>
    </div>
  );
}

function BrandSwitch({
  checked,
  onCheckedChange,
  disabled,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <Switch
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      aria-label={ariaLabel}
      className={cn(
        "h-5 w-9 shrink-0",
        "data-[state=checked]:bg-[#C8285F] data-[state=unchecked]:bg-[#D1D5DB]",
        "[&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4",
      )}
    />
  );
}

const fieldClass =
  "h-9 w-full max-w-[420px] rounded-md border-[#E5E7EB] text-sm focus-visible:ring-[#C8285F]/30 focus-visible:border-[#C8285F] aria-[invalid=true]:border-[#F04438]";

type TextField =
  | "nome" | "descricao" | "endereco" | "cidade" | "telefone" | "whatsapp"
  | "instagram" | "facebook" | "horario_abertura" | "horario_fechamento";
type NumberField = "taxa_entrega" | "pedido_minimo" | "tempo_entrega_min" | "tempo_entrega_max";
function FieldError({ message }: { message?: string }) {
  return message ? (
    <p className="field-error mt-1.5 text-xs text-[#B42318]" role="alert">
      {message}
    </p>
  ) : null;
}

function SaveStatus({ status, onRetry }: { status: AutosaveStatus; onRetry: () => void }) {
  if (status === "idle") return null;
  if (status === "error")
    return (
      <span className="text-xs font-medium text-[#B42318]" role="status">
        Não foi possível salvar ·{" "}
        <button type="button" onClick={onRetry} className="font-semibold underline">
          Tentar de novo
        </button>
      </span>
    );
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-xs", status === "saved" ? "text-emerald-700" : "text-[#6B7280]")}
      role="status"
      aria-live="polite"
    >
      {status === "saved" ? null : <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
      {status === "saved" ? "Alterações salvas" : status === "saving" ? "Salvando…" : "Alterações pendentes…"}
    </span>
  );
}

/* ─── Manager ─────────────────────────────────────────────────────────── */

interface EstabelecimentoManagerProps {
  configuracaoInicial: ConfiguracaoLoja;
}

export function EstabelecimentoManager({
  configuracaoInicial,
}: EstabelecimentoManagerProps) {
  const [config, setConfig] = useState(configuracaoInicial);
  const [section, setSection] = useState<SectionId>("geral");
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const configRef = useRef(config);
  configRef.current = config;

  const diasFuncionamento = parseDiasFuncionamento(config.dias_funcionamento);
  const configId = config.id;
  const hasRecord = Boolean(configId) && configId !== "default" && configId !== 0;

  const autosave = useMemo(() => {
    const queue = createAutosave<ConfiguracaoLoja, Record<string, unknown>>({
      save: async (patch) =>
        (await updateConfiguracoesLoja(configId, patch)) as Record<string, unknown>,
      onSaved: (_patch, data) => {
        const saved = normalizeConfiguracao(data);
        // Só aplica o que voltou do servidor nos campos sem edição pendente:
        // o que a pessoa digitou durante o salvamento não é desfeito.
        const busy = queue.pendingKeys();
        setConfig((prev) => {
          const next = { ...prev };
          for (const key of Object.keys(saved) as Array<keyof ConfiguracaoLoja>) {
            if (!busy.has(key)) (next as Record<string, unknown>)[key] = saved[key];
          }
          return next;
        });
      },
      onStatus: (value) => {
        setStatus(value);
        if (value === "error") toast.error("Não foi possível salvar. Confira a conexão e tente de novo.");
      },
    });
    return queue;
  }, [configId]);

  useEffect(() => {
    // Ao sair da página, salva o que ainda estiver na fila.
    const warn = (event: BeforeUnloadEvent) => {
      if (!autosave.isDirty()) return;
      void autosave.flush();
      // No app Windows (Electron) isso cancelaria o fechamento/F5 sem aviso.
      if (!(window as Window & { dondaDesktop?: unknown }).dondaDesktop) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      autosave.dispose();
      void autosave.flush();
    };
  }, [autosave]);

  /** Atualiza a tela na hora e agenda o salvamento (validando antes). */
  const edit = useCallback(
    (patch: Partial<ConfiguracaoLoja>, immediate = false) => {
      if (!hasRecord) {
        toast.error("Configuração ainda não foi criada no banco");
        return;
      }
      setConfig((prev) => ({ ...prev, ...patch }));
      const next = { ...configRef.current, ...patch };
      const found = validateConfig(next);
      setErrors(found);
      // Campos inválidos ficam só na tela até serem corrigidos.
      const valid = Object.fromEntries(
        Object.entries(patch).filter(([key]) => !found[key as keyof ConfiguracaoLoja]),
      ) as Partial<ConfiguracaoLoja>;
      // Corrigir o mínimo pode tornar válido um máximo que estava parado na tela.
      if ("tempo_entrega_min" in patch && !found.tempo_entrega_max && errors.tempo_entrega_max)
        valid.tempo_entrega_max = next.tempo_entrega_max;
      if ("tempo_entrega_max" in patch && !found.tempo_entrega_min && errors.tempo_entrega_min)
        valid.tempo_entrega_min = next.tempo_entrega_min;
      if (Object.keys(valid).length) autosave.queue(valid, immediate);
    },
    [autosave, hasRecord, errors],
  );

  /** Props para campos de texto: salva após a pausa e ao sair do campo. */
  const textField = (field: TextField) => ({
    value: (config[field] as string | null) ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      edit({ [field]: field === "nome" ? e.target.value : e.target.value || null } as Partial<ConfiguracaoLoja>),
    onBlur: () => void autosave.flush(),
    "aria-invalid": Boolean(errors[field]) || undefined,
  });

  const numberField = (field: NumberField, integer = false) => ({
    value: config[field] ?? "",
    inputMode: (integer ? "numeric" : "decimal") as "numeric" | "decimal",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      // Entrada incompleta ("-", "1e") chega como "": não apaga o valor salvo.
      if (e.target.validity.badInput) return;
      const raw = e.target.value.trim();
      const parsed = raw === "" ? null : integer ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
      edit({ [field]: parsed } as Partial<ConfiguracaoLoja>);
    },
    onBlur: () => void autosave.flush(),
    "aria-invalid": Boolean(errors[field]) || undefined,
  });

  const changeSection = (next: SectionId) => {
    void autosave.flush();
    setSection(next);
  };

  const handleDiaToggle = (dia: string, checked: boolean) => {
    const atuais = parseDiasFuncionamento(configRef.current.dias_funcionamento);
    const novos = checked
      ? Array.from(new Set([...atuais, dia]))
      : atuais.filter((d) => d !== dia);
    // Mantém a ordem da semana.
    const ordenados = diasSemana.map((d) => d.value).filter((d) => novos.includes(d));
    edit({ dias_funcionamento: ordenados }, true);
  };

  const handleUpload = async (file: File, type: "logo" | "banner") => {
    if (uploadingLogo || uploadingBanner) return;
    const setUploading =
      type === "logo" ? setUploadingLogo : setUploadingBanner;
    setUploading(true);
    try {
      const path = await uploadStoreImage(file, type);
      edit({ [type === "logo" ? "logo_url" : "banner_url"]: path }, true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a imagem.",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = (type: "logo" | "banner") => {
    if (uploadingLogo || uploadingBanner) return;
    edit({ [type === "logo" ? "logo_url" : "banner_url"]: null }, true);
  };

  const saveStatus = (
    <SaveStatus status={status} onRetry={() => autosave.retry()} />
  );

  return (
    <div className="min-h-full bg-[#F9FAFB]">
      <div className="flex flex-col md:flex-row w-full gap-6 lg:gap-10 px-4 sm:px-6 lg:px-8 py-5">
        {/* Nav */}
        <nav
          className="hidden w-52 shrink-0 md:block"
          aria-label="Seções do estabelecimento"
        >
          <ul className="space-y-0.5">
            {SECTIONS.map((s) => {
              const active = section === s.id;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => changeSection(s.id)}
                    className={cn(
                      "w-full rounded px-3 py-2 text-left text-sm transition-colors",
                      active
                        ? "font-medium text-[#C8285F]"
                        : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]",
                    )}
                    style={active ? { backgroundColor: BRAND_SOFT } : undefined}
                  >
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 border-t border-[#E5E7EB] pt-4">
            <Link
              href="/admin/configuracoes"
              className="block px-3 py-2 text-sm text-[#6B7280] hover:text-[#C8285F]"
            >
              Configurações do sistema →
            </Link>
          </div>
        </nav>

        {/* Mobile select */}
        <div className="mb-3 w-full md:hidden">
          <Select
            value={section}
            onValueChange={(v) => changeSection(v as SectionId)}
          >
            <SelectTrigger className="h-10 rounded-md border-[#E5E7EB] bg-white text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SECTIONS.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-sm">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="admin-settings-content min-w-0 flex-1 pb-10">
          {/* ——— GERAL ——— */}
          {section === "geral" && (
            <div>
              <SectionTitle status={saveStatus}>Geral</SectionTitle>
              <SectionHint>
                Identidade e status de funcionamento da loja.
              </SectionHint>
              <Panel>
                <Row
                  title="Nome da loja"
                  description="Nome exibido no cardápio e nos pedidos."
                  align="start"
                >
                  <Input
                    {...textField("nome")}
                    placeholder="Ex: Sorvetes Donda"
                    maxLength={80}
                    className={fieldClass}
                  />
                  <FieldError message={errors.nome} />
                </Row>
                <Row
                  title="Descrição"
                  description="Texto curto sobre a loja (até ~150 caracteres)."
                  align="start"
                >
                  <Textarea
                    {...textField("descricao")}
                    maxLength={300}
                    placeholder="Descreva sua loja..."
                    rows={3}
                    className={cn(
                      fieldClass,
                      "h-auto min-h-[80px] resize-none py-2",
                    )}
                  />
                </Row>
                <Row
                  title="Loja aberta"
                  description={
                    config.esta_aberto
                      ? "Clientes podem fazer pedidos."
                      : "Loja temporariamente fechada para pedidos."
                  }
                  last
                >
                  <BrandSwitch
                    checked={config.esta_aberto}
                    onCheckedChange={(v) => edit({ esta_aberto: v }, true)}
                    aria-label="Loja aberta"
                  />
                </Row>
              </Panel>
            </div>
          )}

          {/* ——— APARÊNCIA ——— */}
          {section === "aparencia" && (
            <div>
              <SectionTitle status={saveStatus}>Aparência</SectionTitle>
              <SectionHint>Logo e banner exibidos no cardápio.</SectionHint>
              <Panel>
                <Row
                  title="Logo"
                  description="Recomendado: 512×512px, JPEG, PNG, WebP ou GIF até 10MB."
                  align="start"
                >
                  <div className="w-full max-w-[420px] space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-[#E5E7EB] bg-[#F9FAFB]">
                        {config.logo_url ? (
                          <Image
                            sizes="64px"
                            src={config.logo_url}
                            alt="Logo"
                            fill
                            className="object-contain"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-[#9CA3AF]">
                            —
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingLogo || uploadingBanner}
                          onClick={() =>
                            document.getElementById("logo-input")?.click()
                          }
                          className="h-9 border-[#E5E7EB] text-sm hover:border-[#C8285F]/40 hover:bg-[#FDE6EE] hover:text-[#C8285F]"
                        >
                          {uploadingLogo ? (
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="mr-1.5 h-4 w-4" />
                          )}
                          {config.logo_url ? "Trocar" : "Enviar"}
                        </Button>
                        {config.logo_url ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploadingLogo || uploadingBanner}
                            onClick={() => handleRemoveImage("logo")}
                            className="h-9 border-[#E5E7EB] text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <X className="mr-1.5 h-4 w-4" />
                            Remover
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <input
                      id="logo-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void handleUpload(file, "logo");
                      }}
                    />
                  </div>
                </Row>
                <Row
                  title="Banner"
                  description="Recomendado: 1200×400px (proporção 3:1)."
                  align="start"
                  last
                >
                  <div className="w-full max-w-[420px] space-y-2">
                    <div className="relative h-20 w-full overflow-hidden rounded-md border border-[#E5E7EB] bg-[#F9FAFB]">
                      {config.banner_url ? (
                        <Image
                          sizes="(max-width: 460px) calc(100vw - 64px), 420px"
                          src={config.banner_url}
                          alt="Banner"
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-full items-center justify-center text-xs text-white/80"
                          style={{ backgroundColor: BRAND }}
                        >
                          Sem banner
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={uploadingLogo || uploadingBanner}
                        onClick={() =>
                          document.getElementById("banner-input")?.click()
                        }
                        className="h-9 border-[#E5E7EB] text-sm hover:border-[#C8285F]/40 hover:bg-[#FDE6EE] hover:text-[#C8285F]"
                      >
                        {uploadingBanner ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="mr-1.5 h-4 w-4" />
                        )}
                        {config.banner_url ? "Trocar" : "Enviar"}
                      </Button>
                      {config.banner_url ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingLogo || uploadingBanner}
                          onClick={() => handleRemoveImage("banner")}
                          className="h-9 border-[#E5E7EB] text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <X className="mr-1.5 h-4 w-4" />
                          Remover
                        </Button>
                      ) : null}
                    </div>
                    <input
                      id="banner-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void handleUpload(file, "banner");
                      }}
                    />
                  </div>
                </Row>
              </Panel>
            </div>
          )}

          {/* ——— ENDEREÇO ——— */}
          {section === "endereco" && (
            <div>
              <SectionTitle status={saveStatus}>Endereço</SectionTitle>
              <SectionHint>Localização exibida no cardápio.</SectionHint>
              <Panel>
                <Row
                  title="Endereço"
                  description="Rua, número e complemento."
                  align="start"
                >
                  <Input
                    {...textField("endereco")}
                    placeholder="Rua, número, complemento"
                    className={fieldClass}
                  />
                </Row>
                <Row title="Cidade" align="start">
                  <Input
                    {...textField("cidade")}
                    placeholder="Ex: São Paulo"
                    className={fieldClass}
                  />
                </Row>
                <Row title="Estado" last>
                  <Select
                    value={config.estado || ""}
                    onValueChange={(v) => edit({ estado: v }, true)}
                  >
                    <SelectTrigger className={cn(fieldClass, "max-w-[200px]")}>
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {estadosBrasil.map((uf) => (
                        <SelectItem key={uf} value={uf} className="text-sm">
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Row>
              </Panel>
              {config.endereco && config.cidade ? (
                <div className="mt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const q = `${config.endereco}, ${config.cidade}, ${config.estado || ""}`;
                      window.open(
                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
                        "_blank",
                      );
                    }}
                    className="h-9 border-[#E5E7EB] text-sm hover:border-[#C8285F]/40 hover:text-[#C8285F]"
                  >
                    Abrir no Google Maps
                  </Button>
                </div>
              ) : null}
            </div>
          )}

          {/* ——— CONTATO ——— */}
          {section === "contato" && (
            <div>
              <SectionTitle status={saveStatus}>Contato</SectionTitle>
              <SectionHint>Telefone e redes sociais da loja.</SectionHint>
              <Panel>
                <Row
                  title="Telefone"
                  description="Número principal."
                  align="start"
                >
                  <Input
                    {...textField("telefone")}
                    type="tel"
                    autoComplete="off"
                    placeholder="(00) 00000-0000"
                    className={fieldClass}
                  />
                </Row>
                <Row
                  title="WhatsApp"
                  description="Contato direto com o cliente."
                  align="start"
                >
                  <Input
                    {...textField("whatsapp")}
                    type="tel"
                    autoComplete="off"
                    placeholder="(00) 00000-0000"
                    className={fieldClass}
                  />
                </Row>
                <Row
                  title="Instagram"
                  description="@perfil ou URL."
                  align="start"
                >
                  <Input
                    {...textField("instagram")}
                    placeholder="@seuperfil"
                    className={fieldClass}
                  />
                </Row>
                <Row
                  title="Facebook"
                  description="URL da página."
                  align="start"
                  last
                >
                  <Input
                    {...textField("facebook")}
                    placeholder="https://facebook.com/..."
                    className={fieldClass}
                  />
                </Row>
              </Panel>
            </div>
          )}

          {/* ——— HORÁRIOS ——— */}
          {section === "horario" && (
            <div className="space-y-6">
              <div>
                <SectionTitle status={saveStatus}>Horários</SectionTitle>
                <SectionHint>
                  Dias e horários em que a loja recebe pedidos.
                </SectionHint>
                <Panel>
                  <Row title="Abertura" description="Horário de abertura.">
                    <Input
                      type="time"
                      {...textField("horario_abertura")}
                      value={hhmm(config.horario_abertura)}
                      className={cn(fieldClass, "max-w-[160px]")}
                    />
                  </Row>
                  <Row
                    title="Fechamento"
                    description="Horário de fechamento."
                    last
                  >
                    <Input
                      type="time"
                      {...textField("horario_fechamento")}
                      value={hhmm(config.horario_fechamento)}
                      className={cn(fieldClass, "max-w-[160px]")}
                    />
                  </Row>
                </Panel>
              </div>

              <div>
                <SectionTitle>Dias de funcionamento</SectionTitle>
                <Panel>
                  {diasSemana.map((dia, i) => (
                    <Row
                      key={dia.value}
                      title={dia.label}
                      last={i === diasSemana.length - 1}
                    >
                      <Checkbox
                        checked={diasFuncionamento.includes(dia.value)}
                        onCheckedChange={(checked) =>
                          handleDiaToggle(dia.value, Boolean(checked))
                        }
                        className="border-[#D1D5DB] data-[state=checked]:border-[#C8285F] data-[state=checked]:bg-[#C8285F]"
                        aria-label={dia.label}
                      />
                    </Row>
                  ))}
                </Panel>
              </div>
            </div>
          )}

          {/* ——— DELIVERY ——— */}
          {section === "delivery" && (
            <div>
              <SectionTitle status={saveStatus}>Delivery</SectionTitle>
              <SectionHint>Taxas, pedido mínimo e tempo estimado.</SectionHint>
              <Panel>
                <Row
                  title="Taxa de entrega"
                  description="Valor cobrado na entrega (R$)."
                >
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...numberField("taxa_entrega")}
                    placeholder="0,00"
                    className={cn(fieldClass, "max-w-[140px]")}
                  />
                  <FieldError message={errors.taxa_entrega} />
                </Row>
                <Row
                  title="Pedido mínimo"
                  description="Valor mínimo do carrinho (R$)."
                >
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...numberField("pedido_minimo")}
                    placeholder="0,00"
                    className={cn(fieldClass, "max-w-[140px]")}
                  />
                  <FieldError message={errors.pedido_minimo} />
                </Row>
                <Row
                  title="Tempo mínimo"
                  description="Estimativa mínima em minutos."
                >
                  <Input
                    type="number"
                    min="0"
                    {...numberField("tempo_entrega_min", true)}
                    placeholder="30"
                    className={cn(fieldClass, "max-w-[140px]")}
                  />
                  <FieldError message={errors.tempo_entrega_min} />
                </Row>
                <Row
                  title="Tempo máximo"
                  description="Estimativa máxima em minutos."
                  last
                >
                  <Input
                    type="number"
                    min="0"
                    {...numberField("tempo_entrega_max", true)}
                    placeholder="45"
                    className={cn(fieldClass, "max-w-[140px]")}
                  />
                  <FieldError message={errors.tempo_entrega_max} />
                </Row>
              </Panel>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
