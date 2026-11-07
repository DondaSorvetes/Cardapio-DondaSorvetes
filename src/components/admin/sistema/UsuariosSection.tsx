"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Shield,
  UserRound,
  RefreshCw,
  Eye,
  Wrench,
  AlertCircle,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listProfiles,
  updateProfileAcessos,
  updateProfileCapabilities,
  updateProfileRole,
  type ProfileRow,
} from "@/actions/admin/profiles";
import {
  ADMIN_PAGE_META,
  ALL_ADMIN_PAGES,
  MANAGEABLE_CAPABILITIES,
  roleLabel,
  type AdminPageAccess,
  type AppRole,
  type StaffCapability,
} from "@/lib/security/rbac";
import { cn } from "@/lib/utils";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 text-lg font-semibold text-[#111827]">{children}</h2>
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
        className
      )}
    >
      {children}
    </div>
  );
}

const STAFF_ROLES: Exclude<AppRole, "cliente">[] = [
  "admin",
  "gerente",
  "atendente",
];

export function UsuariosSection() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listProfiles();
      setProfiles(rows);
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        return rows[0]?.id ?? null;
      });
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Não foi possível carregar usuários.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = profiles.find((p) => p.id === selectedId) ?? null;

  const handleRoleChange = async (role: Exclude<AppRole, "cliente">) => {
    if (!selected || selected.role === role) return;
    setSaving(true);
    try {
      const updated = await updateProfileRole(selected.id, role);
      setProfiles((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
      toast.success("Papel atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar papel.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAcesso = async (page: AdminPageAccess, enabled: boolean) => {
    if (!selected || selected.role === "admin") return;

    const current = new Set(selected.acessos);
    if (enabled) current.add(page);
    else current.delete(page);

    if (current.size === 0) {
      toast.error("O usuário precisa de ao menos uma tela liberada.");
      return;
    }

    const next = ALL_ADMIN_PAGES.filter((p) => current.has(p));
    setSaving(true);
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === selected.id
          ? { ...p, acessos: next, acessos_custom: next }
          : p
      )
    );
    try {
      const updated = await updateProfileAcessos(selected.id, next);
      setProfiles((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
      toast.success("Telas atualizadas.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar telas.");
      void load();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCapability = async (
    key: StaffCapability,
    enabled: boolean
  ) => {
    if (!selected || selected.role === "admin") return;

    const current = new Set(selected.capabilities);
    if (enabled) current.add(key);
    else current.delete(key);

    const next = MANAGEABLE_CAPABILITIES.map((c) => c.key).filter((k) =>
      current.has(k)
    );

    setSaving(true);
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === selected.id ? { ...p, capabilities: next } : p
      )
    );
    try {
      const updated = await updateProfileCapabilities(selected.id, next);
      setProfiles((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
      toast.success("Permissões atualizadas.");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Erro ao atualizar permissões."
      );
      void load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#6B7280]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando usuários da tabela perfis…
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <SectionTitle>Usuários</SectionTitle>
        <Panel>
          <div className="flex flex-col items-start gap-3 px-5 py-6">
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <p className="text-sm text-[#6B7280]">
              Confirme se a tabela <strong>public.perfis</strong> existe e se
              seu usuário tem role <code className="text-xs">admin</code>.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => void load()}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Tentar de novo
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div>
        <SectionTitle>Usuários</SectionTitle>
        <SectionHint>
          Nenhum registro em <code className="text-xs">perfis</code>. Crie o
          usuário no Auth e a linha correspondente na tabela.
        </SectionHint>
        <Panel>
          <div className="space-y-2 px-5 py-6 text-sm text-[#6B7280]">
            <p>
              Cada linha em <strong>perfis</strong> precisa do mesmo{" "}
              <code className="text-xs">id</code> (UUID) do Auth, além de nome,
              e-mail e role.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => void load()}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Atualizar lista
            </Button>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionTitle>Usuários</SectionTitle>
          <SectionHint>
            Gerencie quem acessa o painel: papel, telas visíveis e o que cada
            pessoa pode fazer. Fonte: tabela <strong>perfis</strong> (
            {profiles.length}{" "}
            {profiles.length === 1 ? "usuário" : "usuários"}).
          </SectionHint>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0"
          disabled={loading || saving}
          onClick={() => void load()}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", saving && "animate-spin")} />
          <span className="ml-1.5 hidden sm:inline">Atualizar</span>
        </Button>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[280px_minmax(0,1fr)]">
        {/* Lista de perfis */}
        <Panel className="h-fit max-h-[min(70vh,640px)] overflow-y-auto">
          <div className="border-b border-[#E5E7EB] px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
              Perfis
            </p>
          </div>
          <ul className="divide-y divide-[#E5E7EB]">
            {profiles.map((p) => {
              const active = p.id === selectedId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors",
                      active ? "bg-[#FDE6EE]/60" : "hover:bg-[#F9FAFB]"
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        p.role === "admin"
                          ? "bg-[#FDE6EE] text-[#C8285F]"
                          : p.role === "gerente"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-gray-100 text-gray-600"
                      )}
                    >
                      {p.role === "admin" ? (
                        <Shield className="h-4 w-4" />
                      ) : (
                        <UserRound className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#111827]">
                        {p.nome || p.email || "Sem nome"}
                      </p>
                      <p className="truncate text-xs text-[#6B7280]">
                        {p.email || "—"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[10px] font-semibold text-[#C8285F]">
                          {roleLabel(p.role)}
                        </span>
                        {p.role !== "admin" && (
                          <span className="text-[10px] text-[#9CA3AF]">
                            {p.acessos.length} tela
                            {p.acessos.length === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        {/* Detalhe / gestão */}
        {selected && (
          <div className="space-y-4">
            <Panel>
              <div className="flex flex-col gap-4 px-5 py-4 xl:flex-row xl:flex-wrap xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <p className="text-[17px] font-semibold text-[#111827]">
                    {selected.nome || selected.email || "Usuário"}
                  </p>
                  <p className="mt-0.5 text-sm text-[#6B7280]">
                    {selected.email || "Sem e-mail"}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-[#9CA3AF] truncate">
                    {selected.id}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#6B7280]">Papel</span>
                  <Select
                    value={selected.role}
                    disabled={saving}
                    onValueChange={(v) =>
                      void handleRoleChange(v as Exclude<AppRole, "cliente">)
                    }
                  >
                    <SelectTrigger className="h-9 w-[170px] rounded-md border-[#E5E7EB] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_ROLES.map((r) => (
                        <SelectItem key={r} value={r} className="text-sm">
                          {roleLabel(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Panel>

            {/* Telas */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Eye className="h-4 w-4 text-[#C8285F]" />
                <h3 className="text-sm font-semibold text-[#111827]">
                  O que pode ver (telas)
                </h3>
              </div>
              {selected.role === "admin" ? (
                <Panel>
                  <div className="px-5 py-4 text-sm text-[#6B7280]">
                    Administradores veem todas as telas. Mude o papel para
                    limitar.
                  </div>
                </Panel>
              ) : (
                <Panel>
                  {ALL_ADMIN_PAGES.map((page, idx) => {
                    const meta = ADMIN_PAGE_META[page];
                    const checked = selected.acessos.includes(page);
                    const last = idx === ALL_ADMIN_PAGES.length - 1;
                    return (
                      <div
                        key={page}
                        className={cn(
                          "flex items-center justify-between gap-4 px-5 py-3.5",
                          !last && "border-b border-[#E5E7EB]"
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#111827]">
                            {meta.label}
                          </p>
                          <p className="text-xs text-[#6B7280]">
                            {meta.description}
                          </p>
                        </div>
                        <Switch
                          checked={checked}
                          disabled={saving}
                          onCheckedChange={(v) =>
                            void handleToggleAcesso(page, v)
                          }
                          aria-label={`Ver tela ${meta.label}`}
                          className={cn(
                            "h-5 w-9 shrink-0",
                            "data-[state=checked]:bg-[#111827] data-[state=unchecked]:bg-[#D1D5DB]",
                            "[&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
                          )}
                        />
                      </div>
                    );
                  })}
                </Panel>
              )}
            </div>

            {/* Ações */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-[#C8285F]" />
                <h3 className="text-sm font-semibold text-[#111827]">
                  O que pode fazer (ações)
                </h3>
              </div>
              {selected.role === "admin" ? (
                <Panel>
                  <div className="px-5 py-4 text-sm text-[#6B7280]">
                    Administradores podem executar todas as ações do painel.
                  </div>
                </Panel>
              ) : (
                <Panel>
                  {MANAGEABLE_CAPABILITIES.map((cap, idx) => {
                    const checked = selected.capabilities.includes(cap.key);
                    const last = idx === MANAGEABLE_CAPABILITIES.length - 1;
                    return (
                      <div
                        key={cap.key}
                        className={cn(
                          "flex items-center justify-between gap-4 px-5 py-3.5",
                          !last && "border-b border-[#E5E7EB]"
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#111827]">
                            {cap.label}
                          </p>
                          <p className="text-xs text-[#6B7280]">
                            {cap.description}
                          </p>
                        </div>
                        <Switch
                          checked={checked}
                          disabled={saving}
                          onCheckedChange={(v) =>
                            void handleToggleCapability(cap.key, v)
                          }
                          aria-label={cap.label}
                          className={cn(
                            "h-5 w-9 shrink-0",
                            "data-[state=checked]:bg-[#111827] data-[state=unchecked]:bg-[#D1D5DB]",
                            "[&>span]:h-4 [&>span]:w-4 [&>span]:data-[state=checked]:translate-x-4"
                          )}
                        />
                      </div>
                    );
                  })}
                </Panel>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
