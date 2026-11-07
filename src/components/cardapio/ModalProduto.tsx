"use client";

import { getCatalogVersion, subscribeCatalogUpdates } from "@/lib/catalog-updates";
import { useEffect, useRef, useState } from "react";
import { StorageImage as Image } from "@/components/ui/storage-image";
import { usePathname } from "next/navigation";
import { Minus, Plus, X, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  formatBRL,
  getProductUnitPrice,
  notesOptionGroup,
  type OptionGroup,
  type Product,
} from "@/data/tipos";
import { PrecoProduto } from "./PrecoProduto";
import { useCarrinho } from "@/context/CarrinhoContext";
import { TagBadge } from "@/components/ui/TagBadge";
import { FreteGratisBadge } from "@/components/ui/FreteGratisBadge";
import { useLoja } from "@/hooks/useLoja";
import { toast } from "sonner";
import { comboGroupLimit, isSharedComboAddon, resolveComboChoices } from "@/lib/combos/options";

const optionCache = new Map<string, { at: number; version: number; groups: OptionGroup[] }>();
const optionRequests = new Map<string, Promise<OptionGroup[]>>();

type Props = {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProductDetailDialog({ product, open, onOpenChange }: Props) {
  const { adicionarItem } = useCarrinho();
  const { loja, isLoading } = useLoja();
  const pathname = usePathname();
  const previousPathname=useRef(pathname);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const lojaAberta = isLoading ? true : Boolean(loja?.esta_aberto);
  const [loadedOptionGroups, setLoadedOptionGroups] = useState<OptionGroup[] | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  // Falha ao buscar opções: bloqueia "Adicionar" (senão iria sem os complementos) e oferece tentar de novo.
  const [optionsError, setOptionsError] = useState(false);
  const [optionsAttempt, setOptionsAttempt] = useState(0);
  const groups = loadedOptionGroups ?? product?.optionGroups ?? [notesOptionGroup];

  const productId = product?.id;
  const needsOptions = Boolean(product && !product.comboId && /^\d+$/.test(product.id) && !(product.optionGroups ?? []).some(group => group.id !== "obs"));
  useEffect(() => {
    setLoadedOptionGroups(null); setOptionsLoading(false); setOptionsError(false);
    if (!open || !productId || !needsOptions) return;
    // Não aborta o fetch: no dev (StrictMode) o efeito monta duas vezes e o abort gerava
    // uma requisição "cancelada/erro" seguida de outra. Requisições em voo são compartilhadas.
    let active = true;
    const load = (force = false) => {
      const cached = optionCache.get(productId);
      if (!force && cached && cached.version === getCatalogVersion() && Date.now() - cached.at < 30_000) {
        setLoadedOptionGroups(cached.groups); return;
      }
      const version = getCatalogVersion();
      const key = productId + ":" + version;
      let request = optionRequests.get(key);
      if (!request) {
        request = fetch("/api/cardapio/produto/" + productId + "/opcoes", { cache: "no-store" })
          .then(async response => { if (!response.ok) throw new Error("Não foi possível carregar as opções do produto."); return response.json() as Promise<{ optionGroups: OptionGroup[] }>; })
          .then(data => {
            if (optionCache.size >= 100) optionCache.clear();
            optionCache.set(productId, { at: Date.now(), version, groups: data.optionGroups });
            return data.optionGroups;
          })
          .finally(() => { optionRequests.delete(key); });
        optionRequests.set(key, request);
      }
      setOptionsLoading(true); setOptionsError(false);
      request
        .then(optionGroups => { if (active) setLoadedOptionGroups(optionGroups); })
        .catch((error: unknown) => { if (active) { setOptionsError(true); toast.error(error instanceof Error ? error.message : "Falha ao carregar opções."); } })
        .finally(() => { if (active) setOptionsLoading(false); });
    };
    load();
    const unsubscribe = subscribeCatalogUpdates(reason => { if (reason !== "initial") load(true); });
    return () => { active = false; unsubscribe(); };
  }, [open, productId, needsOptions, optionsAttempt]);

  // Fecha ao trocar de aba na bottom nav
  useEffect(() => {
    if (previousPathname.current !== pathname && open) onOpenChange(false);
    previousPathname.current=pathname;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  /** "Deseja colher?" — null até o cliente responder (obrigatório quando o produto pergunta). */
  const [colher, setColher] = useState<boolean | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    setSelections({});
    setQty(1);
    setNotes("");
    setColher(null);
    sectionRefs.current = {};
  }, [product?.id]);

  if (!product) return null;

  const getDynamicMaxForGroup = (group: OptionGroup) => comboGroupLimit(group, groups, selections, product.name);
  const isSharedAddonsGroup = (group: OptionGroup) => isSharedComboAddon(group, product.name);
  const getTotalSharedAddonsSelected = (group: OptionGroup) => groups
    .filter(g => g.comboUnitKey === group.comboUnitKey && isSharedAddonsGroup(g))
    .reduce((total, g) => total + (selections[g.id] ?? []).length, 0);

  // Função para rolar para a próxima seção
  const scrollToNextSection = (currentGroupId: string) => {
    const currentIndex = groups.findIndex(g => g.id === currentGroupId);
    if (currentIndex === -1 || currentIndex >= groups.length - 1) return;

    const nextGroup = groups[currentIndex + 1];
    const nextSection = sectionRefs.current[nextGroup.id];
    
    if (nextSection && scrollContainerRef.current) {
      // Pequeno delay para garantir que a UI atualizou
      setTimeout(() => {
        const container = scrollContainerRef.current;
        if (container) container.scrollTo({ top: nextSection.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      }, 100);
    }
  };

  const toggle = (group: OptionGroup, itemId: string) => {
    // Verifica se o item está disponível
    const item = group.items.find((i) => i.id === itemId);
    if (item && item.disponivel === false) {
      toast.error("Item esgotado", {
        description: "Este complemento está indisponível no momento.",
      });
      return;
    }

    setSelections((prev) => {
      const current = prev[group.id] ?? [];
      const has = current.includes(itemId);
      const dynamicMax = getDynamicMaxForGroup(group);
      if (!has && group.max !== 1 && current.length >= dynamicMax) return prev;
      
      // Para grupos compartilhados, verifica o total geral
      if (isSharedAddonsGroup(group)) {
        const totalSelected = groups
          .filter(g => g.comboUnitKey === group.comboUnitKey && isSharedAddonsGroup(g))
          .reduce((total, g) => {
            return total + (prev[g.id] ?? []).length;
          }, 0);
        
        // Se não tem o item selecionado e já atingiu o limite geral, bloqueia
        if (!has && totalSelected >= dynamicMax) {
          return prev;
        }
      }
      
      let next: string[];
      if (group.max === 1) {
        next = has ? [] : [itemId];
        // Se for seleção única (radio) e está selecionando (não removendo), rola para próxima seção
        if (!has) {
          scrollToNextSection(group.id);
        }
      } else {
        if (has) next = current.filter((id) => id !== itemId);
        else next = [...current, itemId];
      }
      return { ...prev, [group.id]: next };
    });
  };

  const extras = groups.reduce((sum, g) => {
    const ids = selections[g.id] ?? [];
    return (
      sum +
      ids.reduce((s, id) => {
        const it = g.items.find((i) => i.id === id);
        return s + (it?.priceDelta ?? 0);
      }, 0)
    );
  }, 0);

  const unitPrice = getProductUnitPrice(product);
  const total = (unitPrice + extras) * qty;

  let comboValid = true;
  if (product.comboOptionsMode === "cliente") {
    try { resolveComboChoices(groups.filter(group => group.id !== "obs"), selections); } catch { comboValid = false; }
  }
  const perguntaColher = product.perguntaColher === true;
  const canAdd = comboValid && (!perguntaColher || colher !== null) && !optionsLoading && !optionsError && product.disponivel !== false && groups.every((g) => {
    if (!g.required) return true;
    const count = (selections[g.id] ?? []).length;
    return count >= (g.min ?? 1);
  });

  // "Deseja colher?" — entre as opções do produto e as observações.
  const colherSection = perguntaColher ? (
    <section aria-labelledby="pergunta-colher">
      <header className="flex items-center justify-between gap-3 bg-muted px-5 py-3">
        <div>
          <h3 id="pergunta-colher" className="text-sm font-semibold text-foreground">Deseja colher?</h3>
          <p className="text-xs text-muted-foreground">Escolha uma opção</p>
        </div>
        <span className="rounded bg-foreground px-2 py-0.5 text-[11px] font-semibold text-background">
          Obrigatório
        </span>
      </header>
      <div role="radiogroup" aria-labelledby="pergunta-colher" className="divide-y divide-border bg-card">
        {([true, false] as const).map((valor) => {
          const marcado = colher === valor;
          return (
            <button
              key={String(valor)}
              type="button"
              role="radio"
              aria-checked={marcado}
              onClick={() => setColher(valor)}
              className={[
                "flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                marcado ? "bg-primary/5" : "",
              ].join(" ")}
            >
              <span className="text-sm font-medium text-foreground">{valor ? "Sim, quero colher" : "Não, obrigado"}</span>
              <span
                className={[
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition",
                  marcado ? "border-primary bg-primary" : "border-muted-foreground/40 bg-card",
                ].join(" ")}
              >
                {marcado && <span className="h-2 w-2 rounded-full bg-primary-foreground" />}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  ) : null;
  const temObservacoes = groups.some((g) => g.id === "obs");

  const handleAdicionar = () => {
    if (!lojaAberta) {
      toast.error("Loja fechada", {
        description: "No momento não estamos aceitando pedidos.",
      });
      return;
    }

    if (!canAdd) return;
    adicionarItem({
      produto: { ...product, optionGroups: groups },
      qty,
      selections,
      observacoes: notes,
      ...(perguntaColher && colher !== null ? { colher } : {}),
      total,
    });

    // Limpar todas as seleções após adicionar
    setSelections({});
    setQty(1);
    setNotes("");
    setColher(null);
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose onOpenAutoFocus={event => { event.preventDefault(); returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; headingRef.current?.focus({ preventScroll: true }); }} onCloseAutoFocus={event => { if (returnFocusRef.current?.isConnected) { event.preventDefault(); returnFocusRef.current.focus({ preventScroll: true }); } }} overlayClassName="z-[80] max-md:bottom-0 motion-reduce:animate-none motion-reduce:duration-0" className="z-[90] motion-reduce:animate-none motion-reduce:duration-0 flex h-dvh max-h-dvh w-full max-w-md flex-col gap-0 overflow-hidden border-0 p-0 top-0 translate-y-0 rounded-none md:top-[50%] md:translate-y-[-50%] md:h-[92dvh] md:max-h-[92dvh] md:rounded-2xl">
        <DialogTitle className="sr-only">{product.name}</DialogTitle>
        <DialogDescription className="sr-only">{product.description}</DialogDescription>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" ref={scrollContainerRef}>
          {/* Image */}
          <div className="relative aspect-square w-full bg-muted">
            <button type="button" onClick={() => onOpenChange(false)} aria-label="Fechar produto" className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-10 flex h-11 w-11 items-center justify-center rounded-full bg-card text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"><X aria-hidden="true" className="h-5 w-5" /></button>
            {product.image ? (
              <Image preset="productDetail" src={product.image} alt={product.name} fill sizes="(max-width: 448px) 100vw, 448px" quality={90} className="object-cover" />
            ) : null}
          </div>

          {/* Header info */}
          <div className="space-y-2 bg-card px-5 py-5">
            <div className="flex items-start justify-between gap-3">
              <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary">{product.name}</h2>
              {product.tag && <TagBadge tag={product.tag} />}
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{product.description}</p>
            {product.freteGratis && <FreteGratisBadge prazo={product.freteGratisPrazo} />}
            <div className="pt-1">
              <PrecoProduto product={product} size="lg" />
            </div>
          </div>

          {product.comboOptionsMode === "fixo" && Boolean(product.comboFixedChoices?.length) && <section className="space-y-2 bg-card px-5 pb-5">
            <h3 className="text-sm font-semibold">Este combo inclui</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">{product.comboFixedChoices?.map(choice => <li key={choice.groupId + choice.id}>{choice.groupName}: {choice.name}</li>)}</ul>
          </section>}
          {/* Option groups */}
          <div className="space-y-3 pb-4">
            {groups.map((g) => {
              const selected = selections[g.id] ?? [];
              const dynamicMax = getDynamicMaxForGroup(g);
              const isShared = isSharedAddonsGroup(g);
              const totalSharedSelected = isShared ? getTotalSharedAddonsSelected(g) : selected.length;
              const displayMax = isShared ? dynamicMax : g.max;
              
              if (g.id === "obs") {
                return (
                  <div key={g.id} className="space-y-3">
                  {colherSection}
                  <section
                    ref={(el) => { sectionRefs.current[g.id] = el; }}
                  >
                    <header className="flex items-center justify-between bg-muted px-5 py-3">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{g.name}</h3>
                        {g.helper && <p className="text-xs text-muted-foreground">{g.helper}</p>}
                      </div>
                    </header>
                    <div className="bg-card px-5 py-4">
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={3}
                        aria-label="Observações do pedido"
                        placeholder="Ex: sem amendoim, capricha na cobertura..."
                        className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:border-primary"
                      />
                    </div>
                  </section>
                  </div>
                );
              }
              return (
                <section 
                  key={g.id}
                  ref={(el) => { sectionRefs.current[g.id] = el; }}
                >
                  <header className="flex items-center justify-between gap-3 bg-muted px-5 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-foreground">{g.name}</h3>
                        {g.tag && <TagBadge tag={g.tag} />}
                      </div>
                      {g.helper && (
                        <p className="text-xs text-muted-foreground">
                          {/* Para grupos compartilhados de açaí, mostra o helper dinâmico */}
                          {isShared ? (
                            <>
                              Escolha até{' '}
                              <span className="text-destructive">{displayMax}</span>
                              {' '}opções
                            </>
                          ) : (
                            g.helper.split(/(\d+)/).map((part, i) =>
                              /^\d+$/.test(part) ? (
                                <span key={i} className="text-destructive">
                                  {part}
                                </span>
                              ) : (
                                <span key={i}>{part}</span>
                              ),
                            )
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-foreground/80 px-2 py-0.5 text-[11px] font-semibold text-background">
                        {totalSharedSelected} / {displayMax}
                      </span>
                      {g.required && (
                        <span className="rounded bg-foreground px-2 py-0.5 text-[11px] font-semibold text-background">
                          Obrigatório
                        </span>
                      )}
                    </div>
                  </header>
                  <ul className="divide-y divide-border bg-card">
                    {/* Disponíveis primeiro (selecionados no topo), esgotados no fim com tarja */}
                    {[
                      ...g.items.filter(
                        (item) =>
                          item.disponivel !== false &&
                          selected.includes(item.id)
                      ),
                      ...g.items.filter(
                        (item) =>
                          item.disponivel !== false &&
                          !selected.includes(item.id)
                      ),
                      ...g.items.filter((item) => item.disponivel === false),
                    ].map((item) => {
                      const isSelected = selected.includes(item.id);
                      const isUnavailable = item.disponivel === false;
                      const totalSelected = isShared
                        ? totalSharedSelected
                        : selected.length;
                      const disabled =
                        isUnavailable ||
                        (!isSelected &&
                          g.max > 1 &&
                          totalSelected >= displayMax);
                      const isRadio = g.max === 1;

                      return (
                        <li
                          key={item.id}
                          className={
                            isUnavailable
                              ? "relative overflow-hidden bg-muted/40"
                              : isSelected
                                ? "bg-primary/5"
                                : ""
                          }
                        >
                          {/* Tarja diagonal — só em esgotados */}
                          {isUnavailable && (
                            <>
                              <div
                                className="pointer-events-none absolute inset-0 z-10 bg-black/10"
                                aria-hidden
                              />
                              <div
                                className="pointer-events-none absolute top-3 -right-10 z-20 w-36 rotate-45 bg-red-600 py-1 text-center shadow-md"
                                aria-hidden
                              >
                                <span className="text-[10px] font-bold uppercase tracking-wider text-white">
                                  Indisponível
                                </span>
                              </div>
                            </>
                          )}

                          <button
                            type="button"
                            disabled={disabled}
                            aria-pressed={isSelected}
                            onClick={() =>
                              !isUnavailable && toggle(g, item.id)
                            }
                            className={[
                              "relative z-[5] flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition",
                              isUnavailable
                                ? "cursor-not-allowed"
                                : "hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                              isSelected && !isUnavailable
                                ? ""
                                : "",
                            ].join(" ")}
                          >
                            <div className="flex min-w-0 flex-col pr-8">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={[
                                    "text-sm font-medium",
                                    isUnavailable
                                      ? "text-muted-foreground line-through"
                                      : "text-foreground",
                                  ].join(" ")}
                                >
                                  {item.name}
                                </span>
                                {isUnavailable && (
                                  <span className="inline-flex items-center rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                    Esgotado
                                  </span>
                                )}
                                {item.tag && !isUnavailable && (
                                  <TagBadge tag={item.tag} />
                                )}
                              </div>
                              {item.priceDelta ? (
                                <span
                                  className={[
                                    "text-xs",
                                    isUnavailable
                                      ? "text-muted-foreground/70 line-through"
                                      : "text-muted-foreground",
                                  ].join(" ")}
                                >
                                  + {formatBRL(item.priceDelta)}
                                </span>
                              ) : null}
                            </div>

                            {!isUnavailable && (
                              <span
                                className={[
                                  "flex h-5 w-5 shrink-0 items-center justify-center border-2 transition",
                                  isRadio ? "rounded-full" : "rounded",
                                  isSelected
                                    ? "border-primary bg-primary"
                                    : "border-muted-foreground/40 bg-card",
                                ].join(" ")}
                              >
                                {isSelected &&
                                  (isRadio ? (
                                    <span className="h-2 w-2 rounded-full bg-primary-foreground" />
                                  ) : (
                                    <svg
                                      viewBox="0 0 12 12"
                                      className="h-3 w-3 text-primary-foreground"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth={2.5}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <polyline points="2.5,6.5 5,9 9.5,3.5" />
                                    </svg>
                                  ))}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
            {!temObservacoes && colherSection}
          </div>
        </div>

        <button type="button" onClick={() => onOpenChange(false)} className="sr-only focus:not-sr-only focus:shrink-0 focus:bg-card focus:px-5 focus:py-3 focus:text-primary"><ArrowLeft aria-hidden="true" className="inline h-4 w-4" /> Voltar ao cardápio</button>
        {/* Footer */}
        <div className="shrink-0 flex items-center gap-3 border-t border-border bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3 rounded-full border border-border px-2 py-1.5">
            <button
              type="button"
              aria-label="Diminuir"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="flex h-11 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-5 text-center text-sm font-semibold">{qty}</span>
            <button
              type="button"
              aria-label="Aumentar"
              onClick={() => setQty((q) => q + 1)}
              className="flex h-11 w-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {optionsError ? (
          <button
            type="button"
            onClick={() => setOptionsAttempt((n) => n + 1)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/5"
          >
            Não carregou as opções · Tentar novamente
          </button>
          ) : (
          <button
            type="button"
            disabled={!canAdd || !lojaAberta}
            onClick={handleAdicionar}
            className="flex flex-1 items-center justify-between gap-3 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span>{lojaAberta ? "Adicionar" : "Loja fechada"}</span>
            <span>{formatBRL(total)}</span>
          </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
