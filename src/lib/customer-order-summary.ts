/** The database projects only the first product's name/image, never its full snapshot. */
export function resumirPedido(row: {
  id: string;
  status: string;
  created_at: string;
  updated_at?: string | null;
  total: number;
  produto_nome?: string | null;
  produto_imagem?: string | null;
}) {
  return {
    id: row.id,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    total: row.total,
    itens:
      row.produto_nome || row.produto_imagem
        ? [
            {
              produto: {
                name: row.produto_nome || "Seu pedido",
                image: row.produto_imagem ?? undefined,
              },
            },
          ]
        : [],
  };
}
