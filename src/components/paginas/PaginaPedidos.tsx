import Link from "next/link";
import { ShoppingBag } from "lucide-react";

export default function PaginaPedidos() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-16 text-center lg:px-6">
      <ShoppingBag className="h-16 w-16 text-muted-foreground" strokeWidth={1.25} />
      <h1 className="mt-4 text-2xl font-bold">Nenhum pedido por aqui</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Quando você fizer um pedido, ele aparecerá nesta tela para você acompanhar.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        Ver cardápio
      </Link>
    </div>
  );
}
