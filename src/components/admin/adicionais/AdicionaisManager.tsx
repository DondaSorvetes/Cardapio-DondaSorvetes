"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Opcao, GrupoOpcoes } from "@/types/adicional";
import {
  createGrupoOpcoes,
  updateGrupoOpcoes,
  deleteGrupoOpcoes,
  createOpcaoInGrupo,
  setProdutoGrupos,
  getProdutoGrupoIds,
} from "@/actions/admin/grupos-opcoes";
import { updateOpcao, deleteOpcao } from "@/actions/admin/adicionais";
import { toast } from "sonner";
import {
  Layers,
  Plus,
  Loader2,
  FolderOpen,
  Link2,
  Trash2,
  Pencil,
  Check,
  X,
  Package,
  Search,
  ChevronRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Tab = "grupos" | "itens" | "produtos";
type ProdutoMini = { id: number; nome: string };

const STEPS = [
  {
    n: 1,
    tab: "grupos" as Tab,
    title: "Grupos",
    desc: "Ex.: Cremes, Frutas, Coberturas",
  },
  {
    n: 2,
    tab: "itens" as Tab,
    title: "Itens",
    desc: "Ex.: Granola, Morango…",
  },
  {
    n: 3,
    tab: "produtos" as Tab,
    title: "Produtos",
    desc: "Quais produtos usam cada grupo",
  },
];

export function AdicionaisManager() {
  const [tab, setTab] = useState<Tab>("grupos");
  const [grupos, setGrupos] = useState<GrupoOpcoes[]>([]);
  const [opcoes, setOpcoes] = useState<Opcao[]>([]);
  const [produtos, setProdutos] = useState<ProdutoMini[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const supabase = createClient();

  // Grupos
  const [novoGrupoNome, setNovoGrupoNome] = useState("");
  const [novoGrupoMin, setNovoGrupoMin] = useState(0);
  const [novoGrupoMax, setNovoGrupoMax] = useState(1);
  const [editGrupoId, setEditGrupoId] = useState<string | number | null>(null);
  const [editGrupo, setEditGrupo] = useState({
    nome: "",
    min_escolha: 0,
    max_escolha: 1,
  });
  const [deleteGrupoId, setDeleteGrupoId] = useState<string | number | null>(
    null
  );

  // Itens
  const [novoAdNome, setNovoAdNome] = useState("");
  const [novoAdPreco, setNovoAdPreco] = useState(0);
  const [novoAdGrupo, setNovoAdGrupo] = useState("");
  const [filtroGrupo, setFiltroGrupo] = useState("todos");
  const [editOpcaoId, setEditOpcaoId] = useState<string | number | null>(null);
  const [editOpcao, setEditOpcao] = useState({
    nome: "",
    preco_adicional: 0,
    grupo_id: "",
    esta_disponivel: true,
  });
  const [deleteOpcaoId, setDeleteOpcaoId] = useState<string | number | null>(
    null
  );

  // Produtos
  const [produtoLinkId, setProdutoLinkId] = useState("");
  const [gruposDoProduto, setGruposDoProduto] = useState<number[]>([]);
  const [loadingLink, setLoadingLink] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, o, p] = await Promise.all([
        supabase.from("grupos_opcoes").select("*").order("nome"),
        supabase
          .from("opcoes")
          .select("*, grupo:grupos_opcoes(id, nome)")
          .order("ordem"),
        supabase.from("produtos").select("id, nome").order("nome"),
      ]);
      if (g.error) throw g.error;
      if (o.error) throw o.error;
      if (p.error) throw p.error;

      const gs = (g.data || []) as GrupoOpcoes[];
      setGrupos(gs);
      setOpcoes((o.data || []) as Opcao[]);
      setProdutos((p.data || []) as ProdutoMini[]);

      setNovoAdGrupo((prev) => {
        if (prev) return prev;
        return gs[0] ? String(gs[0].id) : "";
      });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!produtoLinkId) {
      setGruposDoProduto([]);
      return;
    }
    let cancelled = false;
    setLoadingLink(true);
    void getProdutoGrupoIds(produtoLinkId)
      .then((ids) => {
        if (!cancelled) setGruposDoProduto(ids.map(Number));
      })
      .catch(() => {
        if (!cancelled) toast.error("Erro ao carregar vínculos");
      })
      .finally(() => {
        if (!cancelled) setLoadingLink(false);
      });
    return () => {
      cancelled = true;
    };
  }, [produtoLinkId]);

  const countItens = useCallback(
    (grupoId: string | number) =>
      opcoes.filter((o) => String(o.grupo_id) === String(grupoId)).length,
    [opcoes]
  );

  const gruposFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || tab !== "grupos") return grupos;
    return grupos.filter((g) => g.nome.toLowerCase().includes(q));
  }, [grupos, search, tab]);

  const opcoesAgrupadas = useMemo(() => {
    let list = opcoes;
    if (filtroGrupo !== "todos") {
      list = list.filter((o) => String(o.grupo_id) === filtroGrupo);
    }
    const q = search.trim().toLowerCase();
    if (q && tab === "itens") {
      list = list.filter(
        (o) =>
          o.nome.toLowerCase().includes(q) ||
          o.grupo?.nome?.toLowerCase().includes(q)
      );
    }

    const map = new Map<string, { grupo: GrupoOpcoes | null; itens: Opcao[] }>();
    for (const o of list) {
      const key = String(o.grupo_id ?? "sem");
      if (!map.has(key)) {
        const g =
          grupos.find((x) => String(x.id) === key) ||
          (o.grupo
            ? ({
                id: o.grupo.id,
                nome: o.grupo.nome,
                min_escolha: 0,
                max_escolha: 1,
              } as GrupoOpcoes)
            : null);
        map.set(key, { grupo: g, itens: [] });
      }
      map.get(key)!.itens.push(o);
    }
    return Array.from(map.values());
  }, [opcoes, filtroGrupo, search, tab, grupos]);

  // --- handlers grupos ---
  const handleCreateGrupo = async () => {
    if (!novoGrupoNome.trim()) {
      toast.error("Digite o nome do grupo");
      return;
    }
    setBusy(true);
    try {
      await createGrupoOpcoes({
        nome: novoGrupoNome,
        min_escolha: novoGrupoMin,
        max_escolha: novoGrupoMax,
      });
      setNovoGrupoNome("");
      setNovoGrupoMin(0);
      setNovoGrupoMax(1);
      toast.success("Grupo criado");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveGrupo = async () => {
    if (editGrupoId == null) return;
    setBusy(true);
    try {
      await updateGrupoOpcoes(editGrupoId, editGrupo);
      toast.success("Grupo atualizado");
      setEditGrupoId(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteGrupo = async () => {
    if (deleteGrupoId == null) return;
    setBusy(true);
    try {
      await deleteGrupoOpcoes(deleteGrupoId);
      toast.success("Grupo excluído");
      setDeleteGrupoId(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setBusy(false);
    }
  };

  // --- handlers itens ---
  const handleCreateOpcao = async () => {
    if (!novoAdNome.trim()) {
      toast.error("Digite o nome do item");
      return;
    }
    if (!novoAdGrupo) {
      toast.error("Selecione um grupo");
      return;
    }
    setBusy(true);
    try {
      await createOpcaoInGrupo({
        nome: novoAdNome,
        grupo_id: novoAdGrupo,
        preco_adicional: novoAdPreco,
      });
      setNovoAdNome("");
      setNovoAdPreco(0);
      toast.success("Item criado");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveOpcao = async () => {
    if (editOpcaoId == null) return;
    setBusy(true);
    try {
      await updateOpcao(editOpcaoId, {
        nome: editOpcao.nome,
        preco_adicional: editOpcao.preco_adicional,
        grupo_id: editOpcao.grupo_id,
        esta_disponivel: editOpcao.esta_disponivel,
      });
      toast.success("Item atualizado");
      setEditOpcaoId(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteOpcao = async () => {
    if (deleteOpcaoId == null) return;
    setBusy(true);
    try {
      await deleteOpcao(deleteOpcaoId);
      toast.success("Item excluído");
      setDeleteOpcaoId(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setBusy(false);
    }
  };

  // --- produtos ---
  const toggleGrupoProduto = (grupoId: number) => {
    setGruposDoProduto((prev) =>
      prev.includes(grupoId)
        ? prev.filter((id) => id !== grupoId)
        : [...prev, grupoId]
    );
  };

  const handleSaveVinculos = async () => {
    if (!produtoLinkId) {
      toast.error("Selecione um produto");
      return;
    }
    setBusy(true);
    try {
      await setProdutoGrupos(produtoLinkId, gruposDoProduto);
      toast.success("Salvo! O produto exibirá os grupos marcados.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  };

  const goTab = (t: Tab) => {
    setSearch("");
    setTab(t);
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col overflow-hidden bg-[#F7F8FC]">
      {/* Header + passos */}
      <div className="bg-white border-b border-[#E5E7EB] px-6 py-5 shrink-0">
        <h1 className="text-2xl font-bold text-[#111827] tracking-tight">
          Adicionais
        </h1>
        <p className="text-sm text-[#6B7280] mt-1 max-w-2xl leading-relaxed">
          Complementos que o cliente escolhe no pedido (granola, cremes, frutas…).
          Configure em 3 passos simples:
        </p>

      </div>

      {/* Layout vertical: passos à esquerda + conteúdo à direita */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Navegação vertical dos passos */}
        <aside className="w-[240px] shrink-0 border-r border-[#E5E7EB] bg-white flex flex-col">
          <div className="px-4 pt-4 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
              Passos
            </p>
          </div>
          <nav className="flex-1 px-3 pb-4 space-y-1.5 overflow-y-auto">
            {STEPS.map((s, idx) => {
              const active = tab === s.tab;
              return (
                <div key={s.tab}>
                  <button
                    type="button"
                    onClick={() => goTab(s.tab)}
                    className={cn(
                      "w-full text-left rounded-xl border px-3 py-3 transition-all",
                      active
                        ? "border-[#C8285F] bg-[#FFF9FA] shadow-sm"
                        : "border-transparent hover:bg-[#F9FAFB] hover:border-[#E5E7EB]"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center shrink-0 mt-0.5",
                          active
                            ? "bg-[#C8285F] text-white"
                            : "bg-[#F3F4F6] text-[#6B7280]"
                        )}
                      >
                        {s.n}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-sm font-bold leading-tight",
                            active ? "text-[#C8285F]" : "text-[#111827]"
                          )}
                        >
                          {s.title}
                        </p>
                        <p className="text-[11px] text-[#9CA3AF] mt-0.5 leading-snug">
                          {s.desc}
                        </p>
                      </div>
                      {active && (
                        <ChevronRight className="w-4 h-4 text-[#C8285F] shrink-0 mt-1" />
                      )}
                    </div>
                  </button>
                  {idx < STEPS.length - 1 && (
                    <div className="flex justify-start pl-[22px] py-0.5">
                      <div className="w-px h-3 bg-[#E5E7EB]" />
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Conteúdo do passo ativo */}
        <ScrollArea className="flex-1">
          <div className="max-w-2xl mx-auto p-6 space-y-5">
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-7 h-7 text-[#C8285F] animate-spin" />
              </div>
            ) : tab === "grupos" ? (
              <>
                <HelpCard
                  title="O que é um grupo?"
                  text="É o título da seção de escolhas no produto. Exemplo: no açaí, o grupo “Frutas” agrupa banana, morango e kiwi."
                />

                <Card title="Criar grupo">
                  <div className="flex flex-col gap-3">
                    <div>
                      <Label className="text-xs text-[#6B7280]">
                        Nome do grupo
                      </Label>
                      <Input
                        value={novoGrupoNome}
                        onChange={(e) => setNovoGrupoNome(e.target.value)}
                        placeholder="Ex.: Cremes, Frutas, Coberturas..."
                        className="h-11 rounded-xl mt-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleCreateGrupo();
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-[#6B7280]">
                        Mínimo de escolhas
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        value={novoGrupoMin}
                        onChange={(e) =>
                          setNovoGrupoMin(parseInt(e.target.value, 10) || 0)
                        }
                        className="h-11 rounded-xl mt-1"
                      />
                      <p className="text-[11px] text-[#9CA3AF] mt-1">
                        0 = opcional
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-[#6B7280]">
                        Máximo de escolhas
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        value={novoGrupoMax}
                        onChange={(e) =>
                          setNovoGrupoMax(parseInt(e.target.value, 10) || 1)
                        }
                        className="h-11 rounded-xl mt-1"
                      />
                      <p className="text-[11px] text-[#9CA3AF] mt-1">
                        Quantos o cliente pode marcar
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => void handleCreateGrupo()}
                    disabled={busy || !novoGrupoNome.trim()}
                    className="mt-4 h-11 rounded-xl bg-[#C8285F] hover:bg-[#E33E70] w-full"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Criar grupo
                  </Button>
                </Card>

                <Card
                  title="Grupos cadastrados"
                  badge={String(gruposFiltrados.length)}
                >
                  {grupos.length > 3 && (
                    <SearchField
                      value={search}
                      onChange={setSearch}
                      placeholder="Buscar grupo..."
                    />
                  )}
                  {gruposFiltrados.length === 0 ? (
                    <Empty
                      icon={FolderOpen}
                      title="Nenhum grupo ainda"
                      text="Crie o primeiro grupo acima (ex.: Frutas)"
                    />
                  ) : (
                    <ul className="divide-y divide-[#F3F4F6] -mx-5">
                      {gruposFiltrados.map((g) => {
                        const editing = String(editGrupoId) === String(g.id);
                        const n = countItens(g.id);
                        return (
                          <li key={g.id} className="px-5 py-3.5">
                            {editing ? (
                              <div className="space-y-2">
                                <Input
                                  value={editGrupo.nome}
                                  onChange={(e) =>
                                    setEditGrupo((s) => ({
                                      ...s,
                                      nome: e.target.value,
                                    }))
                                  }
                                  className="h-10 rounded-xl"
                                />
                                <div className="flex flex-col gap-2">
                                  <Input
                                    type="number"
                                    value={editGrupo.min_escolha}
                                    onChange={(e) =>
                                      setEditGrupo((s) => ({
                                        ...s,
                                        min_escolha:
                                          parseInt(e.target.value, 10) || 0,
                                      }))
                                    }
                                    className="h-10 rounded-xl"
                                    placeholder="Mínimo"
                                  />
                                  <Input
                                    type="number"
                                    value={editGrupo.max_escolha}
                                    onChange={(e) =>
                                      setEditGrupo((s) => ({
                                        ...s,
                                        max_escolha:
                                          parseInt(e.target.value, 10) || 1,
                                      }))
                                    }
                                    className="h-10 rounded-xl"
                                    placeholder="Máximo"
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="icon"
                                      className="h-10 w-10 rounded-xl bg-[#C8285F] hover:bg-[#E33E70]"
                                      disabled={busy}
                                      onClick={() => void handleSaveGrupo()}
                                    >
                                      <Check className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="h-10 w-10 rounded-xl"
                                      onClick={() => setEditGrupoId(null)}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#FDE6EE] flex items-center justify-center shrink-0">
                                  <FolderOpen className="w-5 h-5 text-[#C8285F]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-[#111827]">
                                    {g.nome}
                                  </p>
                                  <p className="text-xs text-[#9CA3AF] mt-0.5">
                                    {n} item{n !== 1 ? "s" : ""} · cliente
                                    escolhe {g.min_escolha ?? 0} a{" "}
                                    {g.max_escolha ?? 1}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  className="w-9 h-9 rounded-xl text-[#6B7280] hover:bg-[#F3F4F6] flex items-center justify-center"
                                  onClick={() => {
                                    setEditGrupoId(g.id);
                                    setEditGrupo({
                                      nome: g.nome,
                                      min_escolha: g.min_escolha ?? 0,
                                      max_escolha: g.max_escolha ?? 1,
                                    });
                                  }}
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  className="w-9 h-9 rounded-xl text-[#9CA3AF] hover:bg-red-50 hover:text-red-600 flex items-center justify-center"
                                  onClick={() => setDeleteGrupoId(g.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>

                {grupos.length > 0 && (
                  <Button
                    variant="outline"
                    className="w-full h-11 rounded-xl border-[#E5E7EB] text-[#C8285F] font-semibold"
                    onClick={() => goTab("itens")}
                  >
                    Próximo: cadastrar itens
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                )}
              </>
            ) : tab === "itens" ? (
              <>
                <HelpCard
                  title="O que é um item?"
                  text="É cada opção dentro do grupo. Exemplo: no grupo “Frutas”, os itens são banana, morango e kiwi — cada um com seu preço."
                />

                {grupos.length === 0 ? (
                  <Card title="Cadastre um grupo primeiro">
                    <p className="text-sm text-[#6B7280] mb-3">
                      Os itens precisam ficar dentro de um grupo.
                    </p>
                    <Button
                      className="rounded-xl bg-[#C8285F] hover:bg-[#E33E70] w-full"
                      onClick={() => goTab("grupos")}
                    >
                      Ir para grupos
                    </Button>
                  </Card>
                ) : (
                  <>
                    <Card title="Adicionar item">
                      <div className="flex flex-col gap-3">
                        <div>
                          <Label className="text-xs text-[#6B7280]">Nome</Label>
                          <Input
                            value={novoAdNome}
                            onChange={(e) => setNovoAdNome(e.target.value)}
                            placeholder="Ex.: Granola"
                            className="h-11 rounded-xl mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-[#6B7280]">
                            Em qual grupo?
                          </Label>
                          <Select
                            value={novoAdGrupo}
                            onValueChange={setNovoAdGrupo}
                          >
                            <SelectTrigger className="h-11 rounded-xl mt-1">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {grupos.map((g) => (
                                <SelectItem key={g.id} value={String(g.id)}>
                                  {g.nome}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs text-[#6B7280]">
                            Preço extra (R$)
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={novoAdPreco}
                            onChange={(e) =>
                              setNovoAdPreco(parseFloat(e.target.value) || 0)
                            }
                            className="h-11 rounded-xl mt-1"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={() => void handleCreateOpcao()}
                        disabled={busy || !novoAdNome.trim() || !novoAdGrupo}
                        className="mt-4 h-11 rounded-xl bg-[#C8285F] hover:bg-[#E33E70] w-full"
                      >
                        <Plus className="w-4 h-4 mr-1.5" />
                        Adicionar item
                      </Button>
                    </Card>

                    <div className="flex flex-col gap-2">
                      <SearchField
                        value={search}
                        onChange={setSearch}
                        placeholder="Buscar item..."
                      />
                      <Select value={filtroGrupo} onValueChange={setFiltroGrupo}>
                        <SelectTrigger className="h-10 w-full rounded-xl bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos os grupos</SelectItem>
                          {grupos.map((g) => (
                            <SelectItem key={g.id} value={String(g.id)}>
                              {g.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {opcoesAgrupadas.length === 0 ? (
                      <Card title="Itens">
                        <Empty
                          icon={Layers}
                          title="Nenhum item ainda"
                          text="Adicione o primeiro item no formulário acima"
                        />
                      </Card>
                    ) : (
                      opcoesAgrupadas.map(({ grupo, itens }) => (
                        <Card
                          key={String(grupo?.id ?? "x")}
                          title={grupo?.nome || "Sem grupo"}
                          badge={`${itens.length}`}
                        >
                          <ul className="divide-y divide-[#F3F4F6] -mx-5">
                            {itens.map((o) => {
                              const editing =
                                String(editOpcaoId) === String(o.id);
                              return (
                                <li key={o.id} className="px-5 py-3">
                                  {editing ? (
                                    <div className="space-y-2">
                                      <div className="flex flex-col gap-2">
                                        <Input
                                          value={editOpcao.nome}
                                          onChange={(e) =>
                                            setEditOpcao((s) => ({
                                              ...s,
                                              nome: e.target.value,
                                            }))
                                          }
                                          className="h-10 rounded-xl"
                                        />
                                        <Select
                                          value={editOpcao.grupo_id}
                                          onValueChange={(v) =>
                                            setEditOpcao((s) => ({
                                              ...s,
                                              grupo_id: v,
                                            }))
                                          }
                                        >
                                          <SelectTrigger className="h-10 rounded-xl">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {grupos.map((g) => (
                                              <SelectItem
                                                key={g.id}
                                                value={String(g.id)}
                                              >
                                                {g.nome}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        <Input
                                          type="number"
                                          step="0.01"
                                          value={editOpcao.preco_adicional}
                                          onChange={(e) =>
                                            setEditOpcao((s) => ({
                                              ...s,
                                              preco_adicional:
                                                parseFloat(e.target.value) || 0,
                                            }))
                                          }
                                          className="h-10 rounded-xl"
                                        />
                                      </div>
                                      <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                          <Switch
                                            checked={editOpcao.esta_disponivel}
                                            onCheckedChange={(v) =>
                                              setEditOpcao((s) => ({
                                                ...s,
                                                esta_disponivel: v,
                                              }))
                                            }
                                            className="data-[state=checked]:bg-[#C8285F]"
                                          />
                                          <span className="text-xs text-[#6B7280]">
                                            Disponível
                                          </span>
                                        </div>
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            className="rounded-xl bg-[#C8285F] hover:bg-[#E33E70] flex-1"
                                            disabled={busy}
                                            onClick={() => void handleSaveOpcao()}
                                          >
                                            Salvar
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="rounded-xl flex-1"
                                            onClick={() => setEditOpcaoId(null)}
                                          >
                                            Cancelar
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-3">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-[#111827]">
                                          {o.nome}
                                        </p>
                                        <p className="text-xs text-[#9CA3AF]">
                                          +R${" "}
                                          {Number(o.preco_adicional || 0)
                                            .toFixed(2)
                                            .replace(".", ",")}
                                          {!o.esta_disponivel && (
                                            <span className="text-red-500">
                                              {" "}
                                              · esgotado
                                            </span>
                                          )}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        className="w-9 h-9 rounded-xl text-[#6B7280] hover:bg-[#F3F4F6] flex items-center justify-center"
                                        onClick={() => {
                                          setEditOpcaoId(o.id);
                                          setEditOpcao({
                                            nome: o.nome,
                                            preco_adicional: Number(
                                              o.preco_adicional || 0
                                            ),
                                            grupo_id: String(o.grupo_id),
                                            esta_disponivel: Boolean(
                                              o.esta_disponivel
                                            ),
                                          });
                                        }}
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        className="w-9 h-9 rounded-xl text-[#9CA3AF] hover:bg-red-50 hover:text-red-600 flex items-center justify-center"
                                        onClick={() => setDeleteOpcaoId(o.id)}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </Card>
                      ))
                    )}

                    {opcoes.length > 0 && (
                      <Button
                        variant="outline"
                        className="w-full h-11 rounded-xl border-[#E5E7EB] text-[#C8285F] font-semibold"
                        onClick={() => goTab("produtos")}
                      >
                        Próximo: vincular aos produtos
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <HelpCard
                  title="Por que vincular?"
                  text="Um produto só mostra os grupos que você marcar aqui. Ex.: o Picolé tem “Sabor do Picolé”; o Pote 1 Litro, “Sabor do Pote 1 Litro”."
                />

                <Card title="Escolha o produto">
                  <Select
                    value={produtoLinkId}
                    onValueChange={setProdutoLinkId}
                  >
                    <SelectTrigger className="h-11 rounded-xl w-full">
                      <SelectValue placeholder="Selecione um produto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {produtos.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Card>

                {!produtoLinkId ? (
                  <Empty
                    icon={Package}
                    title="Selecione um produto"
                    text="Depois marque quais grupos ele deve mostrar no cardápio"
                  />
                ) : loadingLink ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-[#C8285F]" />
                  </div>
                ) : grupos.length === 0 ? (
                  <Card title="Sem grupos">
                    <p className="text-sm text-[#6B7280] mb-3">
                      Crie grupos e itens antes de vincular.
                    </p>
                    <Button
                      className="rounded-xl bg-[#C8285F] hover:bg-[#E33E70] w-full"
                      onClick={() => goTab("grupos")}
                    >
                      Ir para grupos
                    </Button>
                  </Card>
                ) : (
                  <Card
                    title="Quais grupos este produto usa?"
                    badge={`${gruposDoProduto.length}/${grupos.length}`}
                  >
                    <div className="flex flex-col gap-2">
                      {grupos.map((g) => {
                        const checked = gruposDoProduto.includes(Number(g.id));
                        const n = countItens(g.id);
                        return (
                          <label
                            key={g.id}
                            className={cn(
                              "flex items-center gap-3 rounded-xl border px-4 py-3.5 cursor-pointer transition-colors",
                              checked
                                ? "border-[#C8285F]/40 bg-[#FFF9FA]"
                                : "border-[#E5E7EB] hover:bg-[#F9FAFB]"
                            )}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-[#D1D5DB] text-[#C8285F] focus:ring-[#C8285F]"
                              checked={checked}
                              onChange={() => toggleGrupoProduto(Number(g.id))}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[#111827]">
                                {g.nome}
                              </p>
                              <p className="text-xs text-[#9CA3AF]">
                                {n} item{n !== 1 ? "s" : ""}
                                {n === 0 && " · grupo vazio"}
                              </p>
                            </div>
                            {checked && (
                              <Check className="w-4 h-4 text-[#C8285F] shrink-0" />
                            )}
                          </label>
                        );
                      })}
                    </div>
                    <Button
                      onClick={() => void handleSaveVinculos()}
                      disabled={busy}
                      className="mt-4 h-11 rounded-xl bg-[#C8285F] hover:bg-[#E33E70] w-full"
                    >
                      {busy ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Link2 className="w-4 h-4 mr-2" />
                      )}
                      Salvar no produto
                    </Button>
                  </Card>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      <AlertDialog
        open={deleteGrupoId != null}
        onOpenChange={(o) => !o && setDeleteGrupoId(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os itens do grupo e os vínculos com produtos serão
              removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 rounded-xl"
              onClick={() => void handleDeleteGrupo()}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteOpcaoId != null}
        onOpenChange={(o) => !o && setDeleteOpcaoId(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este item?</AlertDialogTitle>
            <AlertDialogDescription>
              Ele deixa de aparecer em todos os produtos que usam o grupo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 rounded-xl"
              onClick={() => void handleDeleteOpcao()}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ——— UI helpers ——— */

function HelpCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-[#E8E0F5] bg-[#FFF9FA] px-4 py-3.5 flex gap-3">
      <div className="w-8 h-8 rounded-lg bg-white border border-[#FDE6EE] flex items-center justify-center shrink-0">
        <Info className="w-4 h-4 text-[#C8285F]" />
      </div>
      <div>
        <p className="text-sm font-semibold text-[#111827]">{title}</p>
        <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function Card({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#F3F4F6] flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#111827]">{title}</h2>
        {badge != null && (
          <span className="text-xs font-medium text-[#9CA3AF] tabular-nums">
            {badge}
          </span>
        )}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Empty({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="text-center py-10">
      <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-[#F3F4F6] flex items-center justify-center">
        <Icon className="w-6 h-6 text-[#D1D5DB]" />
      </div>
      <p className="text-sm font-medium text-[#374151]">{title}</p>
      <p className="text-xs text-[#9CA3AF] mt-1">{text}</p>
    </div>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 h-10 rounded-xl bg-white"
      />
    </div>
  );
}
