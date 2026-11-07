"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  atualizarEntregador,
  criarEntregador,
  definirAcessoEntregador,
  getAppEntregadorDownload,
  listEntregadores,
  selecionarEntregador,
  vincularContaExistente,
} from "@/actions/admin/entregadores";
import { SENHA_MINIMA, type AppEntregadorDownload, type Entregador } from "@/lib/entregadores";
import { formatBytes } from "@/lib/backups";

type FormState = { nome: string; email: string; senha: string };
type FieldErrors = Partial<Record<keyof FormState, string>>;
const EMPTY: FormState = { nome: "", email: "", senha: "" };

/** Senha inicial legível (sem 0/O, 1/l) para passar ao entregador. */
function gerarSenha() {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

function Status({ e }: { e: Entregador }) {
  const [label, cls, dot] = !e.ativo
    ? ["Desativado", "bg-[#F3F4F6] text-[#6B7280]", "bg-[#9CA3AF]"]
    : e.selecionado
      ? ["Ativo para entregas", "bg-emerald-50 text-emerald-700", "bg-emerald-500"]
      : ["Disponível", "bg-[#FDF0F4] text-[#C8285F]", "bg-[#A78BDA]"];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", cls)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} aria-hidden="true" />
      {label}
    </span>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium text-[#111827]">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-[#B42318]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-[#6B7280]">{hint}</p>
      ) : null}
    </div>
  );
}

export function EntregadoresSection() {
  const [items, setItems] = useState<Entregador[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [app, setApp] = useState<AppEntregadorDownload | null>(null);

  const [editing, setEditing] = useState<Entregador | "novo" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [canLink, setCanLink] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disabling, setDisabling] = useState<Entregador | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const result = await listEntregadores();
      if (result.ok) setItems(result.items);
      else setLoadError(result.error);
    } catch {
      setLoadError("O painel não conseguiu falar com o servidor. Recarregue a página.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void getAppEntregadorDownload()
      .then((r) => r.ok && setApp(r.app))
      .catch(() => {});
  }, [load]);

  const selecionado = items.find((e) => e.selecionado) ?? null;

  const run = async (key: string, action: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    setBusy(key);
    try {
      const result = await action();
      if (result.ok) {
        toast.success(success);
        await load();
      } else toast.error(result.error ?? "Não foi possível concluir.");
    } catch {
      toast.error("O painel não conseguiu falar com o servidor. Recarregue a página.");
    } finally {
      setBusy(null);
    }
  };

  const openNovo = () => {
    setForm({ ...EMPTY, senha: gerarSenha() });
    setErrors({});
    setFormError("");
    setCanLink(false);
    setEditing("novo");
  };
  const openEditar = (e: Entregador) => {
    setForm({ nome: e.nome, email: e.email, senha: "" });
    setErrors({});
    setFormError("");
    setCanLink(false);
    setEditing(e);
  };

  const salvar = async (vincular = false) => {
    setSaving(true);
    setFormError("");
    try {
      const result =
        editing === "novo"
          ? vincular
            ? await vincularContaExistente({ nome: form.nome, email: form.email })
            : await criarEntregador(form)
          : await atualizarEntregador(editing!.id, { nome: form.nome, email: form.email, senha: form.senha || undefined });
      if (!result.ok) {
        setErrors((result.fieldErrors ?? {}) as FieldErrors);
        setFormError(result.error);
        setCanLink(result.code === "EMAIL_EXISTE");
        return;
      }
      toast.success(
        editing === "novo"
          ? vincular
            ? "Conta vinculada como entregador."
            : "Entregador cadastrado. Passe o e-mail e a senha para ele entrar no app."
          : "Entregador atualizado.",
      );
      setEditing(null);
      await load();
    } catch {
      setFormError("O painel não conseguiu falar com o servidor. Recarregue a página.");
    } finally {
      setSaving(false);
    }
  };

  const novo = editing === "novo";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="mb-1 text-lg font-semibold text-[#111827]">Entregadores</h2>
          <p className="text-sm text-[#6B7280]">
            Cadastre quem faz as entregas e escolha quem está trabalhando agora. Os pedidos que forem marcados como
            “Saiu para entrega” vão para o app desse entregador.
          </p>
        </div>
        <Button type="button" onClick={openNovo} className="h-9 bg-[#C8285F] hover:bg-[#A51F50]">
          Novo entregador
        </Button>
      </div>

      {/* Responsável agora */}
      <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
          <div>
            <p className="text-sm text-[#6B7280]">Responsável pelas entregas agora</p>
            {loading ? (
              <div className="mt-1 h-6 w-40 animate-pulse rounded bg-[#F3F4F6]" />
            ) : selecionado ? (
              <p className="text-lg font-semibold text-[#111827]">{selecionado.nome}</p>
            ) : (
              <p className="text-lg font-semibold text-amber-800">Nenhum entregador selecionado</p>
            )}
            <p className="mt-0.5 text-xs text-[#6B7280]">
              {selecionado
                ? "Trocar de entregador não transfere os pedidos que já saíram com outro."
                : "Pedidos que saírem para entrega ficam sem entregador até você escolher um."}
            </p>
          </div>
          {selecionado && (
            <Button
              type="button"
              variant="outline"
              className="h-9"
              disabled={busy !== null}
              onClick={() => void run("sel:none", () => selecionarEntregador(null), "Nenhum entregador selecionado.")}
            >
              Ninguém por enquanto
            </Button>
          )}
        </div>
      </div>

      {loadError && (
        <p role="alert" className="rounded-lg border border-[#FECDCA] bg-[#FEF3F2] px-4 py-3 text-sm text-[#B42318]">
          {loadError}
        </p>
      )}

      {/* Lista */}
      <section aria-labelledby="lista-entregadores">
        <h3 id="lista-entregadores" className="mb-2 text-sm font-semibold text-[#111827]">
          Cadastrados {items.length > 0 && <span className="font-normal text-[#9CA3AF]">({items.length})</span>}
        </h3>
        <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
          {loading ? (
            <ul className="divide-y divide-[#F3F4F6]" aria-label="Carregando entregadores">
              {[0, 1].map((n) => (
                <li key={n} className="flex items-center justify-between px-4 py-4">
                  <div className="space-y-1.5">
                    <div className="h-4 w-36 animate-pulse rounded bg-[#F3F4F6]" />
                    <div className="h-3 w-48 animate-pulse rounded bg-[#F3F4F6]" />
                  </div>
                  <div className="h-8 w-24 animate-pulse rounded bg-[#F3F4F6]" />
                </li>
              ))}
            </ul>
          ) : items.length === 0 && !loadError ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-[#111827]">Nenhum entregador cadastrado</p>
              <p className="mt-1 text-sm text-[#6B7280]">Cadastre o primeiro para começar a usar o app.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[#F3F4F6]">
              {items.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#111827]">
                      {e.nome} <Status e={e} />
                    </p>
                    <p className="truncate text-xs text-[#6B7280]">
                      {e.email}
                      {e.entregas_em_andamento > 0 &&
                        ` · ${e.entregas_em_andamento} ${e.entregas_em_andamento === 1 ? "entrega em andamento" : "entregas em andamento"}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {e.ativo && !e.selecionado && (
                      <Button
                        type="button"
                        className="h-8 bg-[#C8285F] text-xs hover:bg-[#A51F50]"
                        disabled={busy !== null}
                        onClick={() =>
                          void run(`sel:${e.id}`, () => selecionarEntregador(e.id), `${e.nome} agora recebe as entregas.`)
                        }
                      >
                        {busy === `sel:${e.id}` && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                        Selecionar para entregas
                      </Button>
                    )}
                    <Button type="button" variant="outline" className="h-8 text-xs" disabled={busy !== null} onClick={() => openEditar(e)}>
                      Editar
                    </Button>
                    {e.ativo ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 text-xs text-[#B42318] hover:bg-[#FEF3F2] hover:text-[#B42318]"
                        disabled={busy !== null}
                        onClick={() => setDisabling(e)}
                      >
                        Desativar
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 text-xs"
                        disabled={busy !== null}
                        onClick={() => void run(`on:${e.id}`, () => definirAcessoEntregador(e.id, true), `Acesso de ${e.nome} reativado.`)}
                      >
                        {busy === `on:${e.id}` && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                        Reativar
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* App do entregador */}
      <section aria-labelledby="app-entregador">
        <h3 id="app-entregador" className="mb-2 text-sm font-semibold text-[#111827]">
          App do entregador
        </h3>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#E5E7EB] bg-white px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#111827]">Android (.apk)</p>
            <p className="text-sm text-[#6B7280]">
              {app === null
                ? "Verificando a versão publicada…"
                : app.disponivel
                  ? `Versão ${app.versao} · ${formatBytes(app.tamanho)}${
                      app.publicadoEm ? ` · publicada em ${new Date(app.publicadoEm).toLocaleDateString("pt-BR")}` : ""
                    }`
                  : "O app ainda não foi publicado. Assim que a primeira versão for gerada, o download aparece aqui."}
            </p>
            <p className="mt-1 text-xs text-[#6B7280]">
              Abra este link no celular do entregador. O Android pode pedir para permitir a instalação de apps desta
              fonte. O entregador entra com o e-mail e a senha cadastrados aqui.
            </p>
          </div>
          {app?.disponivel && app.url && (
            <Button asChild className="h-10 gap-1.5 bg-[#C8285F] hover:bg-[#A51F50]">
              <a href={app.url} rel="noreferrer">
                <Download className="h-4 w-4" aria-hidden="true" />
                Baixar app
              </a>
            </Button>
          )}
        </div>
      </section>

      {/* Novo / editar */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && !saving && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{novo ? "Novo entregador" : "Editar entregador"}</DialogTitle>
            <DialogDescription>
              {novo
                ? "O entregador entra no app com este e-mail e senha. Ele não tem acesso ao painel."
                : "Deixe a nova senha em branco para manter a atual."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(ev) => {
              ev.preventDefault();
              void salvar();
            }}
          >
            <Field id="ent-nome" label="Nome" error={errors.nome}>
              <Input
                id="ent-nome"
                value={form.nome}
                maxLength={80}
                autoComplete="off"
                onChange={(ev) => setForm((f) => ({ ...f, nome: ev.target.value }))}
                aria-invalid={Boolean(errors.nome) || undefined}
              />
            </Field>
            <Field id="ent-email" label="E-mail de acesso" error={errors.email}>
              <Input
                id="ent-email"
                type="email"
                inputMode="email"
                autoComplete="off"
                value={form.email}
                onChange={(ev) => {
                  setForm((f) => ({ ...f, email: ev.target.value }));
                  setCanLink(false);
                }}
                aria-invalid={Boolean(errors.email) || undefined}
              />
            </Field>
            {!canLink && (
              <Field
                id="ent-senha"
                label={novo ? "Senha inicial" : "Nova senha"}
                error={errors.senha}
                hint={novo ? `Gerada automaticamente; pode trocar. Mínimo de ${SENHA_MINIMA} caracteres.` : undefined}
              >
                <div className="flex gap-2">
                  <Input
                    id="ent-senha"
                    value={form.senha}
                    autoComplete="new-password"
                    spellCheck={false}
                    className="font-mono"
                    onChange={(ev) => setForm((f) => ({ ...f, senha: ev.target.value }))}
                    aria-invalid={Boolean(errors.senha) || undefined}
                  />
                  <Button type="button" variant="outline" onClick={() => setForm((f) => ({ ...f, senha: gerarSenha() }))}>
                    Gerar
                  </Button>
                </div>
              </Field>
            )}
            {formError && (
              <p role="alert" className="rounded-md bg-[#FEF3F2] px-3 py-2 text-sm text-[#B42318]">
                {formError}
              </p>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              {canLink ? (
                <Button type="button" disabled={saving} onClick={() => void salvar(true)} className="bg-[#C8285F] hover:bg-[#A51F50]">
                  {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
                  Vincular conta existente
                </Button>
              ) : (
                <Button type="submit" disabled={saving} className="bg-[#C8285F] hover:bg-[#A51F50]">
                  {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />}
                  {novo ? "Cadastrar" : "Salvar"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Desativar */}
      <AlertDialog open={disabling !== null} onOpenChange={(open) => !open && setDisabling(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar {disabling?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ele sai do app na hora e não consegue mais concluir entregas.
              {disabling?.selecionado && " Também deixa de receber os próximos pedidos."}
              {disabling && disabling.entregas_em_andamento > 0 &&
                ` As ${disabling.entregas_em_andamento} entregas em andamento continuam com ele: conclua-as pelo Kanban.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#B42318] hover:bg-[#912018]"
              onClick={() => {
                const e = disabling;
                setDisabling(null);
                if (e) void run(`off:${e.id}`, () => definirAcessoEntregador(e.id, false), `Acesso de ${e.nome} desativado.`);
              }}
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
