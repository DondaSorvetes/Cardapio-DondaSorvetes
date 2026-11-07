"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StoreHero } from "@/components/cardapio/HeroLoja";
import { CategoryBar } from "@/components/cardapio/BarraCategorias";
import { FeaturedCarousel } from "@/components/cardapio/CarrosselDestaques";
import { ProductSection } from "@/components/cardapio/SecaoProdutos";
import { useMenu } from "@/hooks/useCardapio";
import { type Category, type Product, type Tag } from "@/data/tipos";

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function filterCategories(
  categories: Category[],
  selectedCategoryId: string | null,
  searchQuery: string
): Category[] {
  const query = normalize(searchQuery);

  return categories
    .filter((c) => !selectedCategoryId || c.id === selectedCategoryId)
    .map((c) => {
      if (!query) return c;
      const products = c.products.filter(
        (p) =>
          normalize(p.name).includes(query) ||
          normalize(p.description ?? "").includes(query)
      );
      return { ...c, products };
    })
    .filter((c) => c.products.length > 0);
}

export default function PaginaInicio() {
  const { categories, isLoading, error, live } = useMenu();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [buscando, setBuscando] = useState(false);
  const searchRef = useRef(searchQuery);
  searchRef.current = searchQuery;
  useEffect(() => {
    const restore = () => {
      setSelectedCategoryId(new URL(location.href).searchParams.get("categoria"));
      setSearchQuery(history.state?.dondaMenu?.search ?? "");
      const y = history.state?.dondaMenu?.scrollY;
      if (typeof y === "number") requestAnimationFrame(() => window.scrollTo({ top: y, behavior: "instant" }));
    };
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);

  // Busca restaurada pelo histórico mantém o campo aberto.
  useEffect(() => {
    if (searchQuery) setBuscando(true);
  }, [searchQuery]);

  useEffect(() => {
    history.replaceState({ ...history.state, dondaMenu: { ...history.state?.dondaMenu, search: searchQuery } }, "", location.href);
  }, [searchQuery]);

  const orderedCategories = useMemo(() => {
    const products = categories.flatMap(category => category.products);
    const combos = products.filter(product => product.disponivel !== false &&
      (product.comboId != null || normalize(product.name).includes("combo do dia")));
    const comboIds = new Set(combos.map(product => product.id));
    // Produtos em promoção ficam na própria categoria, com a mini tag "Promoção".
    // O topo do cardápio é só a tag escolhida pelo admin.
    const highlightedIds = comboIds;
    const remaining = categories.map(category => ({ ...category,
      products: category.products.filter(product => !highlightedIds.has(product.id)),
    })).filter(category => category.products.length > 0);
    return [
      ...(combos.length ? [{ id: "ofertas-combos", name: "Combo do dia", products: combos }] : []),
      ...remaining,
    ];
  }, [categories]);

  // Destaque único do topo: a tag marcada pelo admin (tags.destaque_cardapio).
  // Só entram os produtos com essa tag (quantos o admin quiser). Tag de
  // promoção/oferta usa o card horizontal com preço riscado; as demais, a vitrine.
  const destaque = useMemo(() => {
    const products = orderedCategories
      .filter(category => !category.id.startsWith("ofertas-"))
      .flatMap(category => category.products)
      .concat(orderedCategories.filter(category => category.id.startsWith("ofertas-")).flatMap(category => category.products));
    const tag: Tag | undefined = products.find(product => product.tag?.destaque)?.tag;
    if (!tag) return null;
    const variant: "promo" | "vitrine" = /promo|oferta/.test(normalize(tag.nome)) ? "promo" : "vitrine";
    const seen = new Set<string>();
    const items: Product[] = products.filter(product => {
      if (product.disponivel === false || seen.has(product.id)) return false;
      const match = product.tag?.id === tag.id;
      if (match) seen.add(product.id);
      return match;
    });
    return items.length ? { tag, variant, products: items } : null;
  }, [orderedCategories]);

  const filteredCategories = useMemo(
    () => filterCategories(orderedCategories, selectedCategoryId, searchQuery),
    [orderedCategories, selectedCategoryId, searchQuery]
  );

  const isFiltering = Boolean(selectedCategoryId || searchQuery.trim());

  const handleSelectCategory = useCallback((categoryId: string | null) => {
    const url = new URL(location.href);
    const current = url.searchParams.get("categoria");
    if (current !== categoryId) {
      history.replaceState({ ...history.state, dondaMenu: { search: searchRef.current, scrollY: window.scrollY } }, "", location.href);
      if (categoryId) url.searchParams.set("categoria", categoryId);
      else url.searchParams.delete("categoria");
      history.pushState({ ...history.state, dondaMenu: { search: searchRef.current, scrollY: 0 } }, "", url);
    }
    setSelectedCategoryId(categoryId);

    if (!categoryId) {
      window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      return;
    }

    // Aguarda o re-render (filtro) antes de rolar até a seção
    window.setTimeout(() => {
      document
        .getElementById(`categoria-${categoryId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 font-cardapio lg:px-6">
      <main className="space-y-5">
        <h1 className="sr-only">Sorvetes Donda — Cardápio</h1>
        <StoreHero busca={{ buscando, onBuscandoChange: setBuscando, searchQuery, onSearchChange: setSearchQuery }} />
        <CategoryBar
          categories={orderedCategories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={handleSelectCategory}
        />
        {isLoading && (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Carregando cardápio...
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
            Erro ao carregar cardápio: {error}
          </div>
        )}
        {!isLoading && !error && categories.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Nenhum produto disponível no cardápio.
          </div>
        )}
        {/* Indicador discreto de sincronização ao vivo */}
        {live && !isLoading && !error && (
          <p className="sr-only" aria-live="polite">
            Cardápio sincronizado em tempo real
          </p>
        )}
        {!isFiltering && destaque && (
          <FeaturedCarousel tag={destaque.tag} products={destaque.products} variant={destaque.variant} />
        )}
        {!isLoading &&
          !error &&
          categories.length > 0 &&
          filteredCategories.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              {searchQuery.trim()
                ? `Nenhum produto encontrado para “${searchQuery.trim()}”.`
                : "Nenhum produto nesta categoria."}
            </div>
          )}
        {filteredCategories.map((c) => (
          <ProductSection key={c.id} category={c} />
        ))}
      </main>
    </div>
  );
}
