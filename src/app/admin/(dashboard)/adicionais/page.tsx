import { redirect } from "next/navigation";

/** Adicionais/complementos ficam dentro do Catálogo unificado. */
export default function AdicionaisPage() {
  redirect("/admin/produtos");
}
