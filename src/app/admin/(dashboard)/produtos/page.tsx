import { requirePageAccess } from "@/lib/admin/auth";
import { listProdutosAdmin } from "@/actions/admin/produtos";
import { listCategorias } from "@/actions/admin/categorias";
import { CatalogoManager } from "@/components/admin/catalogo";
import type { CatalogProduto, CatalogCategoria } from "@/components/admin/catalogo/types";
import { listPromocoesFrete, type PromocaoFrete } from "@/actions/admin/promocoes-frete";
import { listCombos, type ComboAdmin } from "@/actions/admin/combos";

export const metadata = {
  title: "Catálogo | Donda Admin",
  description: "Gerenciamento de produtos, categorias e complementos",
};

export default async function ProdutosPage() {
  await requirePageAccess("catalogo");

  let produtos: CatalogProduto[] = [];
  let categorias: CatalogCategoria[] = [];
  let catalogoErro = false;
  let promocoesFrete: PromocaoFrete[] = [];
  let promocoesFreteErro: string | null = null;
  let combos: ComboAdmin[] = [];
  let combosErro: string | null = null;

  try {
    const [p, c] = await Promise.all([
      listProdutosAdmin(500),
      listCategorias(),
    ]);
    produtos = (p || []) as CatalogProduto[];
    categorias = (c || []) as CatalogCategoria[];
  } catch (error) {
    catalogoErro = true;
    console.error("Erro ao carregar catálogo:", error);
  }

  try {
    promocoesFrete = await listPromocoesFrete();
  } catch (error) {
    promocoesFreteErro =
      error instanceof Error
        ? error.message
        : "Não foi possível carregar as campanhas de frete.";
    console.error("Erro ao carregar campanhas de frete:", error);
  }

  try {
    combos = await listCombos();
  } catch (error) {
    combosErro = error instanceof Error ? error.message : "Não foi possível carregar os combos.";
  }

  return (
    <CatalogoManager
      produtosIniciais={produtos}
      categoriasIniciais={categorias}
      loadError={catalogoErro}
      promocoesFreteIniciais={promocoesFrete}
      promocoesFreteErro={promocoesFreteErro}
      combosIniciais={combos}
      combosErro={combosErro}
    />
  );
}
