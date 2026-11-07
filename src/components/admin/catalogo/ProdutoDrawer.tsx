"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getProdutoGrupoIds } from "@/actions/admin/grupos-opcoes";
import type { CatalogCategoria, CatalogProduto } from "./types";
import { ProdutoComplementosPanel } from "./ProdutoComplementosPanel";
import { ProdutoTagsPanel } from "./ProdutoTagsPanel";
import { ProdutoImageUpload } from "@/components/admin/produto-image-upload";

const schema = z
  .object({
    nome: z.string().min(1, "Nome é obrigatório"),
    descricao: z.string().optional(),
    preco_base: z.coerce.number<number>().min(0, "Preço inválido"),
    /** string vazia = sem promoção */
    preco_promocional: z.union([z.coerce.number<number>().min(0), z.literal("")]).optional(),
    categoria_id: z.string().optional(),
    esta_disponivel: z.boolean(),
    pergunta_colher: z.boolean(),
    imagem_url: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const promo =
      data.preco_promocional === "" || data.preco_promocional == null
        ? null
        : Number(data.preco_promocional);
    if (promo != null && Number.isFinite(promo) && promo > 0) {
      if (promo >= Number(data.preco_base)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Deve ser menor que o preço base",
          path: ["preco_promocional"],
        });
      }
    }
  });

export type ProdutoFormValues = z.infer<typeof schema> & {
  /** IDs de grupos_opcoes vinculados */
  grupoIds: string[];
  /** Tag destacada (produtos.tag_id) — uma por produto no schema atual */
  tagId: string | null;
  /**
   * Se false, o save NÃO mexe em produto_grupos (evita apagar complementos
   * quando a lista ainda não foi carregada).
   */
  syncGrupos?: boolean;
};

export function ProdutoDrawer({
  open,
  onOpenChange,
  produto,
  categorias,
  defaultCategoriaId,
  onSave,
  readOnly = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto?: CatalogProduto | null;
  categorias: CatalogCategoria[];
  defaultCategoriaId?: string | null;
  onSave: (values: ProdutoFormValues) => Promise<void>;
  readOnly?: boolean;
}) {
  const isEdit = Boolean(produto?.id);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("info");
  const [grupoIds, setGrupoIds] = useState<string[]>([]);
  const [tagId, setTagId] = useState<string | null>(null);
  /** Só grava vínculos de complementos depois de carregar o estado do servidor */
  const [gruposHydrated, setGruposHydrated] = useState(false);
  const openedForIdRef = useRef<string | null>(null);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: "",
      descricao: "",
      preco_base: 0,
      preco_promocional: "",
      categoria_id: "",
      esta_disponivel: true,
      pergunta_colher: true,
      imagem_url: "",
    },
  });

  const productIdKey =
    open && produto?.id != null ? String(produto.id) : open ? "__new__" : null;

  // Reset / hydrate apenas ao abrir ou trocar de produto (por id).
  // Não depende do objeto `produto` inteiro (realtime/tag não zeram complementos).
  useEffect(() => {
    if (!open || productIdKey == null) {
      openedForIdRef.current = null;
      return;
    }

    // Mesmo produto já aberto: não zera complementos
    if (openedForIdRef.current === productIdKey) {
      return;
    }
    openedForIdRef.current = productIdKey;

    setTab("info");
    setGruposHydrated(false);

    if (productIdKey !== "__new__" && produto) {
      setTagId(
        produto.tag_id != null
          ? String(produto.tag_id)
          : produto.tag?.id != null
            ? String(produto.tag.id)
            : null
      );
      form.reset({
        nome: produto.nome || "",
        descricao: produto.descricao || "",
        preco_base: Number(produto.preco_base) || 0,
        preco_promocional:
          produto.preco_promocional != null &&
          Number(produto.preco_promocional) > 0
            ? Number(produto.preco_promocional)
            : "",
        categoria_id:
          produto.categoria_id != null ? String(produto.categoria_id) : "",
        esta_disponivel: produto.esta_disponivel !== false,
        pergunta_colher: produto.pergunta_colher !== false,
        imagem_url: produto.imagem_url || "",
      });

      const pid = produto.id;
      let cancelled = false;
      void (async () => {
        try {
          const ids = await getProdutoGrupoIds(pid);
          if (cancelled) return;
          setGrupoIds(ids.map(String));
        } catch {
          if (!cancelled) setGrupoIds([]);
        } finally {
          if (!cancelled) setGruposHydrated(true);
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    // Produto novo
    setTagId(null);
    setGrupoIds([]);
    setGruposHydrated(true);
    form.reset({
      nome: "",
      descricao: "",
      preco_base: 0,
      preco_promocional: "",
      categoria_id:
        defaultCategoriaId && defaultCategoriaId !== "__none__"
          ? defaultCategoriaId
          : "",
      esta_disponivel: true,
      pergunta_colher: true,
      imagem_url: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só open + id do produto
  }, [open, productIdKey, defaultCategoriaId, form]);

  const submit = form.handleSubmit(async (values) => {
    if (readOnly) return;
    setSaving(true);
    try {
      // Se por algum motivo ainda não hidratou, busca de novo antes de salvar
      // para NUNCA apagar complementos com lista vazia acidental.
      let links = grupoIds;
      let linksReady = gruposHydrated;
      if (produto?.id != null && !gruposHydrated) {
        try {
          const ids = await getProdutoGrupoIds(produto.id);
          links = ids.map(String);
          linksReady = true;
          setGrupoIds(links);
          setGruposHydrated(true);
        } catch {
          linksReady = false;
        }
      }

      await onSave({
        ...values,
        grupoIds: links,
        tagId,
        // false = não chamar setProdutoGrupos (preserva vínculos no banco)
        syncGrupos: linksReady || produto?.id == null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="admin-product-sheet h-dvh w-full sm:max-w-[520px] p-0 flex flex-col gap-0 border-l border-[#E5E7EB]"
      >
        <SheetHeader className="shrink-0 pl-4 pr-16 py-3 border-b border-[#E5E7EB] space-y-0.5">
          <SheetTitle className="text-[15px] font-semibold text-[#111827]">
            {readOnly
              ? "Visualizar produto"
              : isEdit
                ? "Editar produto"
                : "Novo produto"}
          </SheetTitle>
          <SheetDescription className="text-[12px] text-[#6B7280]">
            {readOnly
              ? "Somente leitura"
              : "Informações, preço e complementos"}
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={tab}
          onValueChange={setTab}
          className="flex-1 flex flex-col min-h-0"
        >
          <div className="px-4 pt-3 border-b border-[#E5E7EB]">
            <TabsList className="w-full h-auto bg-transparent p-0 gap-1 justify-start flex-wrap">
              {(
                [
                  ["info", "Informações"],
                  ["preco", "Preço"],
                  ["opcoes", "Complementos"],
                  ["tags", "Tags"],
                  ["disp", "Disponibilidade"],
                  ["seo", "SEO"],
                ] as const
              ).map(([id, label]) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="rounded-lg px-3 py-1.5 text-xs data-[state=active]:bg-[#FDF0F4] data-[state=active]:text-[#C8285F] data-[state=active]:shadow-none"
                >
                  {label}
                  {id === "opcoes" && grupoIds.length > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.1rem] h-4 px-1 rounded-full bg-[#C8285F] text-white text-[10px] font-bold">
                      {grupoIds.length}
                    </span>
                  )}
                  {id === "tags" && tagId && (
                    <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-[#C8285F]" />
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <form
              id="produto-drawer-form"
              onSubmit={submit}
              className="p-6 space-y-5"
            >
              <TabsContent value="info" className="mt-0 space-y-4">
                {produto?.updated_at && <p className="text-xs text-[#89838F]">Última atualização: {new Intl.DateTimeFormat("pt-BR", {dateStyle:"short",timeStyle:"short"}).format(new Date(produto.updated_at))}</p>}
                <Field label="Nome" error={form.formState.errors.nome?.message}>
                  <Input
                    {...form.register("nome")}
                    disabled={readOnly}
                    placeholder="Ex.: Açaí Tradicional 500ml"
                    className="rounded-xl"
                  />
                </Field>
                <Field label="Descrição">
                  <Textarea
                    {...form.register("descricao")}
                    disabled={readOnly}
                    rows={3}
                    placeholder="Granola + Banana…"
                    className="rounded-xl resize-none"
                  />
                </Field>
                <Field label="Categoria">
                  <Select
                    value={form.watch("categoria_id") || "__none__"}
                    onValueChange={(v) =>
                      form.setValue("categoria_id", v === "__none__" ? "" : v)
                    }
                    disabled={readOnly}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sem categoria</SelectItem>
                      {categorias.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Imagem do produto">
                  <ProdutoImageUpload
                    value={form.watch("imagem_url")}
                    onChange={(path) => {
                      form.setValue("imagem_url", path || "", {
                        shouldDirty: true,
                      });
                    }}
                    disabled={readOnly}
                  />
                </Field>
                <Field label="Código interno">
                  <Input
                    value={produto?.id != null ? String(produto.id) : "—"}
                    disabled
                    className="rounded-xl bg-[#F7F8FC]"
                  />
                </Field>
              </TabsContent>

              <TabsContent value="preco" className="mt-0 space-y-4">
                <Field
                  label="Preço base"
                  error={form.formState.errors.preco_base?.message}
                >
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...form.register("preco_base")}
                    disabled={readOnly}
                    className="rounded-xl"
                  />
                </Field>
                <Field
                  label="Preço promocional"
                  error={form.formState.errors.preco_promocional?.message}
                >
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Deixe vazio se não houver promoção"
                    {...form.register("preco_promocional")}
                    disabled={readOnly}
                    className="rounded-xl"
                  />
                  <p className="text-[11px] text-[#9CA3AF] mt-1">
                    Deve ser menor que o preço base. No cardápio o valor antigo
                    fica riscado e o promo em destaque.
                  </p>
                </Field>
                {(() => {
                  const base = Number(form.watch("preco_base") || 0);
                  const raw = form.watch("preco_promocional");
                  const promo =
                    raw === "" || raw == null ? null : Number(raw);
                  const active =
                    promo != null &&
                    Number.isFinite(promo) &&
                    promo > 0 &&
                    promo < base;
                  if (!active) return null;
                  const pct = Math.round(((base - promo) / base) * 100);
                  return (
                    <div className="rounded-xl border border-[#F6BFD2] bg-gradient-to-br from-[#F8F5FC] to-[#FDF0F4] p-4">
                      <p className="text-xs font-semibold text-[#C8285F] mb-2">
                        Prévia no cardápio
                      </p>
                      <div className="flex items-end gap-3">
                        <div>
                          <p className="text-xs text-[#9CA3AF] line-through tabular-nums">
                            R${" "}
                            {base.toFixed(2).replace(".", ",")}
                          </p>
                          <p className="text-lg font-bold text-[#C8285F] tabular-nums">
                            R${" "}
                            {promo.toFixed(2).replace(".", ",")}
                          </p>
                        </div>
                        <span className="mb-0.5 inline-flex rounded-full bg-gradient-to-r from-[#C8285F] to-[#E33E70] px-2 py-0.5 text-[10px] font-bold text-white shadow-sm shadow-[#C8285F]/25">
                          {pct}% OFF
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </TabsContent>

              <TabsContent value="opcoes" className="mt-0" forceMount>
                <div className={tab === "opcoes" ? "block" : "hidden"}>
                  <ProdutoComplementosPanel
                    produtoId={produto?.id}
                    selectedGrupoIds={grupoIds}
                    onChange={(ids) => {
                      setGrupoIds(ids);
                      setGruposHydrated(true);
                    }}
                    readOnly={readOnly}
                    /** Drawer já hidrata os IDs — painel não sobrescreve */
                    skipInitialLinkLoad
                  />
                </div>
              </TabsContent>

              <TabsContent value="tags" className="mt-0" forceMount>
                <div className={tab === "tags" ? "block" : "hidden"}>
                  <ProdutoTagsPanel
                    selectedTagId={tagId}
                    onChange={setTagId}
                    readOnly={readOnly}
                  />
                </div>
              </TabsContent>

              <TabsContent value="disp" className="mt-0 space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-[#E5E7EB] p-4">
                  <div>
                    <p className="text-sm font-medium text-[#111827]">
                      Produto ativo
                    </p>
                    <p className="text-xs text-[#6B7280]">
                      Visível no cardápio do cliente
                    </p>
                  </div>
                  <Switch
                    checked={form.watch("esta_disponivel")}
                    onCheckedChange={(v) =>
                      form.setValue("esta_disponivel", v, {
                        shouldDirty: true,
                      })
                    }
                    disabled={readOnly}
                    className="data-[state=checked]:bg-[#C8285F]"
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-[#E5E7EB] p-4">
                  <div>
                    <p className="text-sm font-medium text-[#111827]">
                      Perguntar se deseja colher
                    </p>
                    <p className="text-xs text-[#6B7280]">
                      O cliente responde Sim ou Não ao adicionar o produto
                    </p>
                  </div>
                  <Switch
                    checked={form.watch("pergunta_colher")}
                    onCheckedChange={(v) =>
                      form.setValue("pergunta_colher", v, {
                        shouldDirty: true,
                      })
                    }
                    disabled={readOnly}
                    aria-label="Perguntar se deseja colher"
                    className="data-[state=checked]:bg-[#C8285F]"
                  />
                </div>
              </TabsContent>

              <TabsContent value="seo" className="mt-0 space-y-4">
                <Field label="Slug">
                  <Input
                    disabled
                    value={
                      form
                        .watch("nome")
                        ?.toLowerCase()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/(^-|-$)/g, "") || ""
                    }
                    className="rounded-xl bg-[#F7F8FC]"
                  />
                </Field>
              </TabsContent>
            </form>
          </ScrollArea>
        </Tabs>

        {!readOnly && (
          <div className="px-6 py-4 border-t border-[#E5E7EB] flex gap-2 bg-white">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="produto-drawer-form"
              disabled={saving}
              className="flex-1 rounded-xl bg-[#C8285F] hover:bg-[#E33E70] text-white"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEdit ? "Salvar" : "Criar produto"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-[#374151]">{label}</Label>
      {children}
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
