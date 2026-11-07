"use server";

import { requirePermission } from "@/lib/admin/auth";
import { createServiceRoleClient } from "@/integrations/supabase/client.server";
import { writeAudit } from "@/lib/security/audit";
import { securityLog } from "@/lib/security/logger";
import {
  APP_ENTREGADOR_TAG,
  normalizeEmail,
  validateEntregador,
  type AppEntregadorDownload,
  type Entregador,
  type EntregadoresResumo,
} from "@/lib/entregadores";
import { BACKUP_REPO } from "@/lib/backups";

/*
 * Entregadores (app mobile). Contas no Supabase Auth criadas só aqui, no servidor,
 * com a service_role (nunca exposta). Gerenciar exige admin:manage; o resumo
 * (quem está selecionado, nomes) só pedido:read, para o Kanban.
 * Tudo devolve { ok, error } em vez de lançar: em produção o Next.js esconde a
 * mensagem de erros lançados em Server Actions.
 */
type Fail = { ok: false; error: string; fieldErrors?: Record<string, string>; code?: string };
type Ok<T = object> = { ok: true } & T;

/** Bloqueio no Auth de quem é desativado: impede renovar a sessão no app. */
const BAN = "876000h";

async function gerente() {
  try {
    return await requirePermission("admin:manage");
  } catch {
    return null;
  }
}
const SEM_PERMISSAO: Fail = { ok: false, error: "Apenas o administrador pode gerenciar entregadores." };

function falha(acao: string, error: unknown, mensagem: string): Fail {
  securityLog({
    event: "api.error",
    level: "error",
    path: `entregadores:${acao}`,
    result: "fail",
    meta: { reason: error instanceof Error ? error.message.slice(0, 160) : String(error).slice(0, 160) },
  });
  return { ok: false, error: mensagem };
}

const db = () => createServiceRoleClient();
const entregadores = () => db().from("entregadores");

async function contaPorEmail(email: string) {
  const auth = db().auth.admin;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await auth.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => normalizeEmail(u.email) === email);
    if (found) return found;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ehDaEquipe(id: string) {
  const { data } = await db().from("perfis").select("id").eq("id", id).maybeSingle();
  return Boolean(data);
}

export async function listEntregadores(): Promise<Ok<{ items: Entregador[] }> | Fail> {
  if (!(await gerente())) return SEM_PERMISSAO;
  try {
    const { data, error } = await entregadores()
      .select("id, nome, email, ativo, selecionado, created_at")
      .order("nome", { ascending: true });
    if (error) throw error;
    const { data: emAndamento, error: e2 } = await db()
      .from("pedidos")
      .select("entregador_id")
      .eq("status", "saiu_entrega")
      .not("entregador_id", "is", null);
    if (e2) throw e2;
    const contagem = new Map<string, number>();
    for (const row of (emAndamento ?? []) as Array<{ entregador_id: string }>)
      contagem.set(row.entregador_id, (contagem.get(row.entregador_id) ?? 0) + 1);
    const items = ((data ?? []) as Array<Omit<Entregador, "entregas_em_andamento">>).map((e) => ({
      ...e,
      entregas_em_andamento: contagem.get(e.id) ?? 0,
    }));
    return { ok: true, items };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (/entregadores|entregador_id/.test(msg) && /does not exist|not find|schema cache/i.test(msg))
      return { ok: false, code: "SEM_MIGRATION", error: "O banco ainda não tem a estrutura de entregadores (migration 0019)." };
    return falha("list", error, "Não foi possível carregar os entregadores.");
  }
}

export async function criarEntregador(input: { nome: string; email: string; senha: string }): Promise<Ok<{ id: string }> | Fail> {
  const admin = await gerente();
  if (!admin) return SEM_PERMISSAO;
  const fieldErrors = validateEntregador(input, true);
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Confira os campos.", fieldErrors };
  const nome = input.nome.trim();
  const email = normalizeEmail(input.email);
  try {
    const { data, error } = await db().auth.admin.createUser({
      email,
      password: input.senha,
      email_confirm: true,
      user_metadata: { nome, tipo: "entregador" },
    });
    if (error) {
      if (/already|registered|exists/i.test(error.message))
        return {
          ok: false,
          code: "EMAIL_EXISTE",
          error: "Já existe uma conta com este e-mail. Você pode vincular essa conta como entregador.",
          fieldErrors: { email: "E-mail já cadastrado." },
        };
      throw error;
    }
    const id = data.user.id;
    const { error: e2 } = await entregadores().insert({ id, nome, email });
    if (e2) {
      // Não deixa conta solta no Auth se o cadastro falhar.
      await db().auth.admin.deleteUser(id).catch(() => {});
      throw e2;
    }
    await writeAudit({
      actorId: admin.admin.id,
      actorEmail: admin.admin.email,
      action: "entregador.create",
      entity: "entregadores",
      entityId: id,
      after: { nome, email },
    });
    return { ok: true, id };
  } catch (error) {
    return falha("create", error, "Não foi possível cadastrar o entregador.");
  }
}

/** Conta já criada no Supabase Auth (ex.: manualmente) vira entregador. */
export async function vincularContaExistente(input: { nome: string; email: string }): Promise<Ok<{ id: string }> | Fail> {
  const admin = await gerente();
  if (!admin) return SEM_PERMISSAO;
  const fieldErrors = validateEntregador(input, false);
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Confira os campos.", fieldErrors };
  const nome = input.nome.trim();
  const email = normalizeEmail(input.email);
  try {
    const conta = await contaPorEmail(email);
    if (!conta) return { ok: false, error: "Nenhuma conta encontrada com este e-mail.", fieldErrors: { email: "Conta não encontrada." } };
    if (await ehDaEquipe(conta.id))
      return { ok: false, error: "Esta conta é da equipe do painel e não pode ser entregador." };
    const { error } = await entregadores().insert({ id: conta.id, nome, email });
    if (error) {
      if (/duplicate|unique/i.test(error.message)) return { ok: false, error: "Esta conta já é um entregador." };
      throw error;
    }
    await db().auth.admin.updateUserById(conta.id, { ban_duration: "none" }).catch(() => {});
    await writeAudit({
      actorId: admin.admin.id,
      actorEmail: admin.admin.email,
      action: "entregador.link",
      entity: "entregadores",
      entityId: conta.id,
      after: { nome, email },
    });
    return { ok: true, id: conta.id };
  } catch (error) {
    return falha("link", error, "Não foi possível vincular a conta.");
  }
}

export async function atualizarEntregador(
  id: string,
  input: { nome: string; email: string; senha?: string },
): Promise<Ok | Fail> {
  const admin = await gerente();
  if (!admin) return SEM_PERMISSAO;
  const fieldErrors = validateEntregador(input, false);
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Confira os campos.", fieldErrors };
  const nome = input.nome.trim();
  const email = normalizeEmail(input.email);
  try {
    const { data: antes, error: e0 } = await entregadores().select("nome, email").eq("id", id).maybeSingle();
    if (e0) throw e0;
    if (!antes) return { ok: false, error: "Entregador não encontrado." };
    const anterior = antes as { nome: string; email: string };
    const mudancas: { email?: string; email_confirm?: boolean; password?: string } = {};
    if (email !== anterior.email) Object.assign(mudancas, { email, email_confirm: true });
    if (input.senha) mudancas.password = input.senha;
    if (Object.keys(mudancas).length) {
      const { error } = await db().auth.admin.updateUserById(id, mudancas);
      if (error) {
        if (/already|registered|exists/i.test(error.message))
          return { ok: false, error: "Este e-mail já é usado por outra conta.", fieldErrors: { email: "E-mail em uso." } };
        throw error;
      }
    }
    const { error } = await entregadores().update({ nome, email }).eq("id", id);
    if (error) throw error;
    await writeAudit({
      actorId: admin.admin.id,
      actorEmail: admin.admin.email,
      action: input.senha ? "entregador.update_password" : "entregador.update",
      entity: "entregadores",
      entityId: id,
      before: anterior,
      after: { nome, email },
    });
    return { ok: true };
  } catch (error) {
    return falha("update", error, "Não foi possível salvar o entregador.");
  }
}

/** Desativar: some da seleção, perde as operações na hora e não renova a sessão. */
export async function definirAcessoEntregador(id: string, ativo: boolean): Promise<Ok | Fail> {
  const admin = await gerente();
  if (!admin) return SEM_PERMISSAO;
  try {
    const { data, error } = await entregadores().update({ ativo }).eq("id", id).select("id").maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, error: "Entregador não encontrado." };
    const { error: e2 } = await db().auth.admin.updateUserById(id, { ban_duration: ativo ? "none" : BAN });
    if (e2) throw e2;
    await writeAudit({
      actorId: admin.admin.id,
      actorEmail: admin.admin.email,
      action: ativo ? "entregador.enable" : "entregador.disable",
      entity: "entregadores",
      entityId: id,
    });
    return { ok: true };
  } catch (error) {
    return falha("access", error, "Não foi possível alterar o acesso.");
  }
}

/** Quem recebe os próximos pedidos que saírem para entrega (null = ninguém). */
export async function selecionarEntregador(id: string | null): Promise<Ok | Fail> {
  const admin = await gerente();
  if (!admin) return SEM_PERMISSAO;
  try {
    const { error } = await db().rpc("admin_selecionar_entregador", { p_entregador_id: id });
    if (error) {
      if (/ENTREGADOR_INVALIDO/.test(error.message)) return { ok: false, error: "Só um entregador ativo pode ser selecionado." };
      throw error;
    }
    await writeAudit({
      actorId: admin.admin.id,
      actorEmail: admin.admin.email,
      action: "entregador.select",
      entity: "entregadores",
      entityId: id,
    });
    return { ok: true };
  } catch (error) {
    return falha("select", error, "Não foi possível selecionar o entregador.");
  }
}

/** Para o Kanban: quem está selecionado e o nome de cada entregador. */
export async function getEntregadoresResumo(): Promise<Ok<{ resumo: EntregadoresResumo }> | Fail> {
  try {
    await requirePermission("pedido:read");
  } catch {
    return { ok: false, error: "Sem permissão." };
  }
  try {
    const { data, error } = await entregadores().select("id, nome, selecionado");
    if (error) throw error;
    const rows = (data ?? []) as Array<{ id: string; nome: string; selecionado: boolean }>;
    const sel = rows.find((r) => r.selecionado);
    return {
      ok: true,
      resumo: {
        selecionado: sel ? { id: sel.id, nome: sel.nome } : null,
        nomes: Object.fromEntries(rows.map((r) => [r.id, r.nome])),
      },
    };
  } catch (error) {
    return falha("summary", error, "Não foi possível consultar os entregadores.");
  }
}

/** Último .apk publicado (release "entregador-vX.Y.Z" no GitHub). */
export async function getAppEntregadorDownload(): Promise<Ok<{ app: AppEntregadorDownload }> | Fail> {
  if (!(await gerente())) return SEM_PERMISSAO;
  const vazio: AppEntregadorDownload = { disponivel: false, versao: null, url: null, tamanho: null, publicadoEm: null };
  try {
    const res = await fetch(`https://api.github.com/repos/${BACKUP_REPO}/releases?per_page=30`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "donda-painel" },
      next: { revalidate: 600 },
    });
    if (!res.ok) throw new Error(`GITHUB_${res.status}`);
    const releases = (await res.json()) as Array<{
      tag_name: string;
      draft: boolean;
      published_at: string | null;
      assets: Array<{ name: string; browser_download_url: string; size: number }>;
    }>;
    for (const release of releases) {
      const m = APP_ENTREGADOR_TAG.exec(release.tag_name);
      const apk = release.assets.find((a) => a.name.toLowerCase().endsWith(".apk"));
      if (!m || release.draft || !apk) continue;
      return {
        ok: true,
        app: { disponivel: true, versao: m[1], url: apk.browser_download_url, tamanho: apk.size, publicadoEm: release.published_at },
      };
    }
    return { ok: true, app: vazio };
  } catch (error) {
    return falha("apk", error, "Não foi possível consultar o app do entregador.");
  }
}
