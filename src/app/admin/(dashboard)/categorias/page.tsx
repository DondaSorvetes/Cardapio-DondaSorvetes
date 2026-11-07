import { redirect } from "next/navigation";

/** Categorias ficam dentro do Catálogo unificado. */
export default function CategoriasPage() {
  redirect("/admin/produtos");
}
