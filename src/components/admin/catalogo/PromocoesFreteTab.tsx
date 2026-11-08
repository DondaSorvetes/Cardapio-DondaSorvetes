"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createPromocaoFrete,
  deletePromocaoFrete,
  type PromocaoFrete,
} from "@/actions/admin/promocoes-frete";
import type { CatalogProduto } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";

type Situacao = "ativa" | "agendada" | "encerrada";

const SITUACOES: { id: Situacao; label: string }[] = [
  { id: "ativa", label: "Ativas agora" },
  { id: "agendada", label: "Agendadas" },
  { id: "encerrada", label: "Encerradas" },
];

const toDate = (date: string, time: string) => new Date(`${date}T${time.slice(0, 5)}:00`);

export function situacaoCampanha(item: PromocaoFrete, now: Date): Situacao {
  if (item.ativa === false) return "encerrada";
  if (now < toDate(item.data_inicio, item.hora_inicio)) return "agendada";
  if (now > toDate(item.data_fim, item.hora_fim)) return "encerrada";
  return "ativa";
}

const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

function periodo(item: PromocaoFrete) {
  const startClock = item.hora_inicio.slice(0, 5);
  const endClock = item.hora_fim.slice(0, 5);
  if (item.data_inicio === item.data_fim)
    return `${dateLabel(item.data_inicio)}, ${startClock}–${endClock}`;
  return `${dateLabel(item.data_inicio)} ${startClock} → ${dateLabel(item.data_fim)} ${endClock}`;
}

export function PromocoesFreteTab({
  products,
  initial,
  loadError,
  createOpen,
  onCreateOpenChange,
}: {
  products: CatalogProduto[];
  initial: PromocaoFrete[];
  loadError: string | null;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}) {
  const [items, setItems] = useState(initial);
  const [deleteTarget, setDeleteTarget] = useState<PromocaoFrete | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  // Situação depende do relógio do navegador; recalcula a cada minuto.
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const grupos = useMemo(() => {
    const map: Record<Situacao, PromocaoFrete[]> = { ativa: [], agendada: [], encerrada: [] };
    if (!now) return map;
    for (const item of items) map[situacaoCampanha(item, now)].push(item);
    map.agendada.sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
    map.encerrada.sort((a, b) => b.data_fim.localeCompare(a.data_fim));
    return map;
  }, [items, now]);

  const remove = async () => {
    const target = deleteTarget;
    if (!target) return;
    try {
      await deletePromocaoFrete(target.id);
      setItems((current) => current.filter((item) => item.id !== target.id));
      toast.success("Campanha removida");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover a campanha.");
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="catalog-module">
      {loadError && (
        <div role="alert" className="catalog-alert">
          <strong>Não foi possível carregar as campanhas.</strong> {loadError}
        </div>
      )}

      {items.length === 0 && !loadError ? (
        <div className="catalog-surface catalog-empty-block">
          <p className="catalog-empty-title">Nenhuma campanha</p>
          <p className="catalog-empty-text">Agende frete grátis para a loja toda ou para um produto.</p>
          <Button
            type="button"
            onClick={() => onCreateOpenChange(true)}
            className="mt-4 bg-[#C8285F] hover:bg-[#A51F50]"
          >
            Criar campanha
          </Button>
        </div>
      ) : (
        <div className="catalog-promo-groups">
          {SITUACOES.map(({ id, label }) => {
            const list = grupos[id];
            if (!list.length) return null;
            return (
              <section key={id} aria-labelledby={`promo-${id}`}>
                <h2 id={`promo-${id}`} className="catalog-group-title">
                  {label} <span className="catalog-count">{list.length}</span>
                </h2>
                <div className={cn("catalog-surface", id === "encerrada" && "is-muted")}>
                  <table className="catalog-data-table">
                    <thead>
                      <tr>
                        <th scope="col">Aplicado a</th>
                        <th scope="col">Período</th>
                        <th scope="col">Situação</th>
                        <th scope="col">
                          <span className="sr-only">Ações</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((item) => (
                        <tr key={item.id}>
                          <td data-label="Aplicado a">
                            <p className="catalog-data-title">{item.produto?.nome ?? "Toda a loja"}</p>
                            <p className="catalog-data-sub">Frete grátis</p>
                          </td>
                          <td data-label="Período" className="catalog-data-period">
                            {periodo(item)}
                          </td>
                          <td data-label="Situação">
                            <span className={cn("catalog-state", `is-${id}`)}>
                              {id === "ativa" ? "Ativa" : id === "agendada" ? "Agendada" : "Encerrada"}
                            </span>
                          </td>
                          <td className="is-action">
                            <button
                              type="button"
                              className="catalog-text-danger"
                              onClick={() => setDeleteTarget(item)}
                              aria-label={`Remover campanha de ${item.produto?.nome ?? "toda a loja"}`}
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <NovaCampanhaSheet
        open={createOpen}
        onOpenChange={onCreateOpenChange}
        products={products}
        blocked={Boolean(loadError)}
        onCreated={(created) => setItems((current) => [created, ...current])}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              O frete grátis de “{deleteTarget?.produto?.nome ?? "toda a loja"}” deixará de valer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => void remove()}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NovaCampanhaSheet({
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
  onCreated: (item: PromocaoFrete) => void;
}) {
  const [product, setProduct] = useState("all");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!start || !end || !startTime || !endTime || end < start || (end === start && endTime < startTime)) {
      toast.error("Confira as datas e os horários da campanha.");
      return;
    }
    setSaving(true);
    try {
      const productId = product === "all" ? null : Number(product);
      const id = await createPromocaoFrete({
        produto_id: productId,
        data_inicio: start,
        data_fim: end,
        hora_inicio: startTime,
        hora_fim: endTime,
      });
      onCreated({
        id,
        produto_id: productId,
        data_inicio: start,
        data_fim: end,
        hora_inicio: startTime,
        hora_fim: endTime,
        ativa: true,
        produto:
          productId == null
            ? null
            : { nome: products.find((item) => String(item.id) === product)?.nome ?? "Produto" },
      });
      setStart("");
      setEnd("");
      setStartTime("00:00");
      setEndTime("23:59");
      setProduct("all");
      onOpenChange(false);
      toast.success("Campanha agendada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a campanha.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="catalog-sheet admin-side-sheet flex h-dvh w-full flex-col gap-0 border-l border-[#E9E5EF] p-0"
        style={{ "--side-sheet-width": "440px" } as React.CSSProperties}
      >
        <SheetHeader className="catalog-sheet-header">
          <SheetTitle>Nova campanha de frete grátis</SheetTitle>
          <SheetDescription className="sr-only">
            Escolha onde a campanha vale e o período.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="catalog-sheet-body">
            <section className="catalog-form-section">
              <h3>1. Onde vale</h3>
              <Select value={product} onValueChange={setProduct}>
                <SelectTrigger id="frete-product" aria-label="Aplicar a" className="h-11 shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda a loja</SelectItem>
                  {products.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>
            <section className="catalog-form-section">
              <h3>2. Período</h3>
              <div className="space-y-1.5">
                <Label htmlFor="frete-start">Início</Label>
                <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
                  <Input id="frete-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
                  <Input
                    type="time"
                    aria-label="Horário de início"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="frete-end">Término</Label>
                <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2">
                  <Input
                    id="frete-end"
                    type="date"
                    value={end}
                    min={start || undefined}
                    onChange={(e) => setEnd(e.target.value)}
                    required
                  />
                  <Input
                    type="time"
                    aria-label="Horário de término"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>
              <p className="catalog-form-help">Para um único dia, use a mesma data. Horário local da loja.</p>
            </section>
          </div>
          <div className="catalog-sheet-footer">
            <span className="catalog-sheet-summary" />
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || products.length === 0 || blocked}
              className="bg-[#C8285F] hover:bg-[#A51F50]"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Agendar
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
