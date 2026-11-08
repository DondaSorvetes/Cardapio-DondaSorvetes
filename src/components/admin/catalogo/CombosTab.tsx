"use client";

import { useEffect, useMemo, useState } from "react";
import type { OptionGroup } from "@/data/tipos";
import { resolveComboChoices } from "@/lib/combos/options";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  createCombo,
  deleteCombo,
  getComboProductOptions,
  type ComboAdmin,
} from "@/actions/admin/combos";
import type { CatalogProduto } from "./types";

const moeda = (valor: number) =>
  valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const avulso = (combo: ComboAdmin) =>
  combo.itens.reduce((sum, item) => sum + item.preco_base * item.quantidade, 0);

const MODO_LABEL: Record<string, string> = {
  cliente: "Cliente escolhe",
  fixo: "Opções fixas",
};

export function CombosTab({
  products,
  initial,
  loadError,
  createOpen,
  onCreateOpenChange,
}: {
  products: CatalogProduto[];
  initial: ComboAdmin[];
  loadError: string | null;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}) {
  const [items, setItems] = useState(initial);
  const [deleteTarget, setDeleteTarget] = useState<ComboAdmin | null>(null);

  const remove = async () => {
    const combo = deleteTarget;
    if (!combo) return;
    try {
      await deleteCombo(combo.id);
      setItems((current) => current.filter((item) => item.id !== combo.id));
      toast.success("Combo removido do cardápio");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir o combo.");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="catalog-module">
      {loadError && (
        <div role="alert" className="catalog-alert">
          {loadError}
        </div>
      )}

      {items.length === 0 ? (
        <div className="catalog-surface catalog-empty-block">
          <p className="catalog-empty-title">Nenhum combo ainda</p>
          <p className="catalog-empty-text">Junte dois ou mais produtos com um preço especial.</p>
          <Button
            type="button"
            onClick={() => onCreateOpenChange(true)}
            disabled={Boolean(loadError)}
            className="mt-4 bg-[#C8285F] hover:bg-[#A51F50]"
          >
            Criar combo
          </Button>
        </div>
      ) : (
        <div className="catalog-surface">
          <table className="catalog-data-table catalog-combos-table">
            <thead>
              <tr>
                <th scope="col">Combo</th>
                <th scope="col">Escolhas</th>
                <th scope="col" className="is-num">Preço</th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((combo) => {
                const separado = avulso(combo);
                const economia = separado > combo.preco ? Math.round((1 - combo.preco / separado) * 100) : 0;
                return (
                  <tr key={combo.id}>
                    <td data-label="Combo">
                      <p className="catalog-data-title">{combo.nome}</p>
                      <p className="catalog-data-sub">
                        {combo.itens.map((item) => `${item.quantidade}× ${item.nome}`).join(" + ")}
                      </p>
                    </td>
                    <td data-label="Escolhas">
                      <span className="catalog-chip">
                        {MODO_LABEL[combo.opcoes_config?.modo ?? ""] ?? "Composição fechada"}
                      </span>
                    </td>
                    <td data-label="Preço" className="is-num">
                      <p className="catalog-data-title">{moeda(combo.preco)}</p>
                      {economia > 0 && (
                        <p className="catalog-data-sub">
                          <s>{moeda(separado)}</s> <span className="catalog-discount">-{economia}%</span>
                        </p>
                      )}
                    </td>
                    <td className="is-action">
                      <button
                        type="button"
                        className="catalog-text-danger"
                        onClick={() => setDeleteTarget(combo)}
                        aria-label={`Excluir combo ${combo.nome}`}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <NovoComboSheet
        open={createOpen}
        onOpenChange={onCreateOpenChange}
        products={products}
        blocked={Boolean(loadError)}
        onCreated={(combo) => setItems((current) => [combo, ...current])}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir combo?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.nome}” sairá do cardápio. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => void remove()}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NovoComboSheet({
  open,
  onOpenChange,
  products,
  blocked,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: CatalogProduto[];
  blocked: boolean;
  onCreated: (combo: ComboAdmin) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"cliente" | "fixo">("cliente");
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [choices, setChoices] = useState<Record<string, string[]>>({});
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState("");

  const chosen = useMemo(
    () => Object.entries(selected).filter(([, quantity]) => quantity > 0),
    [selected],
  );
  const visibleProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? products.filter((p) => p.nome.toLowerCase().includes(q)) : products;
  }, [products, query]);
  const referencePrice = useMemo(
    () =>
      chosen.reduce((sum, [id, quantity]) => {
        const product = products.find((item) => String(item.id) === id);
        return sum + Number(product?.preco_base ?? 0) * quantity;
      }, 0),
    [chosen, products],
  );

  useEffect(() => {
    let cancelled = false;
    setChoices({});
    setGroups([]);
    setOptionsError("");
    setOptionsLoading(chosen.length > 0);
    if (!chosen.length) return;
    getComboProductOptions(chosen.map(([id, quantidade]) => ({ produto_id: Number(id), quantidade })))
      .then((data) => {
        if (!cancelled) setGroups(data);
      })
      .catch((error) => {
        if (!cancelled)
          setOptionsError(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar as opções. Selecione os produtos novamente.",
          );
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chosen]);

  let fixedExtras = 0;
  let choicesError = "";
  if (mode === "fixo") {
    try {
      fixedExtras = resolveComboChoices(groups, choices).extras;
    } catch (error) {
      choicesError = error instanceof Error ? error.message : "Confira as opções.";
    }
  }
  const separatePrice = referencePrice + fixedExtras;
  const numericPrice = Number(price);
  const savings = separatePrice > numericPrice && numericPrice > 0 ? separatePrice - numericPrice : 0;

  const reset = () => {
    setName("");
    setDescription("");
    setPrice("");
    setQuery("");
    setSelected({});
    setMode("cliente");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const combo = await createCombo({
        nome: name,
        descricao: description,
        preco: numericPrice,
        opcoes_config: { modo: mode, selecoes: mode === "fixo" ? choices : {} },
        itens: chosen.map(([id, quantidade]) => ({ produto_id: Number(id), quantidade })),
      });
      onCreated(combo);
      reset();
      onOpenChange(false);
      toast.success("Combo criado e publicado no cardápio");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar o combo.");
    } finally {
      setSaving(false);
    }
  };

  const canSubmit =
    !saving && !optionsLoading && !optionsError && !choicesError && !blocked && chosen.length >= 2;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="catalog-sheet admin-side-sheet flex h-dvh w-full flex-col gap-0 border-l border-[#E9E5EF] p-0"
        style={{ "--side-sheet-width": "520px" } as React.CSSProperties}
      >
        <SheetHeader className="catalog-sheet-header">
          <SheetTitle>Novo combo</SheetTitle>
          <SheetDescription className="sr-only">
            Escolha os produtos, as opções e o preço do combo.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="catalog-sheet-body">
            <section className="catalog-form-section">
              <h3>1. Informações</h3>
              <div className="space-y-1.5">
                <Label htmlFor="combo-name">Nome</Label>
                <Input
                  id="combo-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Combo Açaí + Água"
                  maxLength={100}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="combo-description">Descrição (opcional)</Label>
                <Textarea
                  id="combo-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </section>

            <section className="catalog-form-section">
              <div className="catalog-form-section-head">
                <h3>2. Produtos</h3>
                <span>{chosen.length} selecionado{chosen.length === 1 ? "" : "s"}</span>
              </div>
              <Input
                type="search"
                aria-label="Filtrar produtos"
                placeholder="Filtrar produtos"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <ul className="catalog-pick-list">
                {visibleProducts.map((product) => {
                  const key = String(product.id);
                  const quantity = selected[key] ?? 0;
                  return (
                    <li key={key} className={quantity > 0 ? "is-selected" : undefined}>
                      <label>
                        <input
                          type="checkbox"
                          checked={quantity > 0}
                          onChange={(e) =>
                            setSelected((current) => ({ ...current, [key]: e.target.checked ? 1 : 0 }))
                          }
                          className="h-4 w-4 accent-[#C8285F]"
                        />
                        <span className="catalog-pick-name">{product.nome}</span>
                        <span className="catalog-pick-price">{moeda(Number(product.preco_base))}</span>
                      </label>
                      {quantity > 0 && (
                        <Input
                          aria-label={`Quantidade de ${product.nome}`}
                          type="number"
                          min="1"
                          max="20"
                          value={quantity}
                          onChange={(e) =>
                            setSelected((current) => ({
                              ...current,
                              [key]: Math.min(20, Math.max(1, Number(e.target.value) || 1)),
                            }))
                          }
                          className="h-8 w-16 text-center"
                        />
                      )}
                    </li>
                  );
                })}
                {visibleProducts.length === 0 && (
                  <li className="catalog-pick-empty">
                    {products.length ? "Nenhum produto encontrado." : "Cadastre produtos antes de montar combos."}
                  </li>
                )}
              </ul>
            </section>

            <section className="catalog-form-section">
              <h3>3. Opções dos produtos</h3>
              <div className="catalog-segmented" role="radiogroup" aria-label="Quem escolhe as opções">
                {(
                  [
                    ["cliente", "Cliente escolhe"],
                    ["fixo", "Opções fixas"],
                  ] as const
                ).map(([value, title]) => (
                  <label key={value} className={mode === value ? "is-active" : undefined}>
                    <input
                      type="radio"
                      name="combo-options-mode"
                      value={value}
                      checked={mode === value}
                      onChange={() => setMode(value)}
                      className="sr-only"
                    />
                    {title}
                  </label>
                ))}
              </div>
              <p className="catalog-form-help">
                {mode === "cliente"
                  ? "Sabores e adicionais são escolhidos no cardápio; adicionais pagos somam ao preço."
                  : "As escolhas abaixo ficam incluídas no preço do combo."}
              </p>
              {optionsLoading && (
                <p role="status" className="catalog-form-help">
                  Carregando opções…
                </p>
              )}
              {optionsError && (
                <p role="alert" className="text-sm text-red-700">
                  {optionsError}
                </p>
              )}
              {mode === "fixo" && !optionsLoading && !optionsError && chosen.length > 0 && groups.length === 0 && (
                <p className="catalog-form-help">Os produtos selecionados não possuem opções.</p>
              )}
              {mode === "fixo" &&
                groups.map((group) => (
                  <fieldset key={group.id} className="catalog-option-group">
                    <legend>
                      {group.name}
                      <span>{group.required ? "Obrigatório" : "Opcional"}</span>
                    </legend>
                    {group.items.map((option) => (
                      <label key={option.id}>
                        <input
                          type="checkbox"
                          checked={(choices[group.id] ?? []).includes(option.id)}
                          disabled={option.disponivel === false}
                          className="h-4 w-4 accent-[#C8285F]"
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setChoices((current) => ({
                              ...current,
                              [group.id]: checked
                                ? group.max === 1
                                  ? [option.id]
                                  : [...(current[group.id] ?? []), option.id]
                                : (current[group.id] ?? []).filter((id) => id !== option.id),
                            }));
                          }}
                        />
                        <span className="min-w-0 flex-1">
                          {option.name}
                          {option.disponivel === false ? " (indisponível)" : ""}
                        </span>
                        {Boolean(option.priceDelta) && <span>+ {moeda(option.priceDelta!)}</span>}
                      </label>
                    ))}
                  </fieldset>
                ))}
              {mode === "fixo" && choicesError && (
                <p role="status" className="catalog-form-help">
                  {choicesError}
                </p>
              )}
            </section>

            <section className="catalog-form-section">
              <h3>4. Preço</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="combo-reference">Valor separado</Label>
                  <Input id="combo-reference" value={moeda(separatePrice)} disabled className="bg-[#FBF6F7]" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="combo-price">Preço do combo</Label>
                  <Input
                    id="combo-price"
                    type="number"
                    min="0.01"
                    max={separatePrice > 0 ? (separatePrice - 0.01).toFixed(2) : undefined}
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0,00"
                    required
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="catalog-sheet-footer">
            <span className="catalog-sheet-summary">
              {savings > 0 ? (
                <>
                  Cliente economiza <strong>{moeda(savings)}</strong>
                </>
              ) : chosen.length < 2 ? (
                "Selecione ao menos 2 produtos"
              ) : null}
            </span>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit} className="bg-[#C8285F] hover:bg-[#A51F50]">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Criar combo
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
