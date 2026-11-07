"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, MoreHorizontal, Search } from "lucide-react";
import { toast } from "sonner";
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
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { getSaoPauloDateTime } from "@/lib/promocoes/frete";
import "./cupons.css";
import { createCupom, deleteCupom, type Cupom } from "@/actions/admin/cupons";

function hojeLocal() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
}

function dinheiro(value: number) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function dataBR(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

export function CuponsManager({
  initial,
  loadError,
}: {
  initial: Cupom[];
  loadError: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Cupom | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Cupom | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [today, setToday] = useState(() => getSaoPauloDateTime().date);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const id = window.setInterval(
      () => setToday(getSaoPauloDateTime().date),
      60000,
    );
    return () => window.clearInterval(id);
  }, []);
  const [items, setItems] = useState(initial);
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<Cupom["tipo"]>("percentual");
  const [valor, setValor] = useState("");
  const [valorMinimo, setValorMinimo] = useState("0");
  const [limiteUsos, setLimiteUsos] = useState("");
  const [dataInicio, setDataInicio] = useState(hojeLocal);
  const [dataFim, setDataFim] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const item = await createCupom({
        codigo,
        nome,
        tipo,
        valor: parseAmount(valor),
        valor_minimo: parseAmount(valorMinimo || "0"),
        limite_usos: limiteUsos ? Number(limiteUsos) : null,
        data_inicio: dataInicio,
        data_fim: dataFim || null,
      });
      setItems((current) => [item, ...current]);
      setCodigo("");
      setNome("");
      setValor("");
      setValorMinimo("0");
      setLimiteUsos("");
      setDataFim("");
      setOpen(false);
      toast.success("Cupom criado");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o cupom.",
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (cupom: Cupom) => {
    setDeleting(true);
    try {
      await deleteCupom(cupom.id);
      setItems((current) => current.filter((item) => item.id !== cupom.id));
      setDeleteTarget(null);
      toast.success(`Cupom ${cupom.codigo} removido`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível remover o cupom.",
      );
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (statusFilter === "todos" ||
            couponStatus(item, today) === statusFilter) &&
          [item.codigo, item.nome]
            .join(" ")
            .toLocaleLowerCase("pt-BR")
            .includes(search.trim().toLocaleLowerCase("pt-BR")),
      ),
    [items, search, statusFilter, today],
  );
  const openCreate = () => {
    opener.current = document.activeElement as HTMLElement;
    setDetail(null);
    setFormError("");
    setOpen(true);
  };
  const openDetail = (item: Cupom) => {
    opener.current = document.activeElement as HTMLElement;
    setDetail(item);
    setOpen(true);
  };
  return (
    <div className="coupons-page">
      <header className="coupons-heading">
        <div>
          <h1>Cupons</h1>
          <p>Gerencie descontos e campanhas promocionais.</p>
        </div>
        <Button
          id="coupon-create-trigger"
          onClick={openCreate}
          className="coupons-primary"
        >
          <Plus size={16} aria-hidden="true" />
          Novo cupom
        </Button>
      </header>
      {loadError && (
        <div role="alert" className="coupons-error">
          {loadError}{" "}
          <button type="button" onClick={() => window.location.reload()}>
            Tentar novamente
          </button>
        </div>
      )}
      <div className="coupons-toolbar">
        <div className="coupons-search">
          <Search size={16} aria-hidden="true" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar cupons"
            placeholder="Buscar código ou nome…"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="Status dos cupons">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {STATUS_LABELS.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <section className="coupons-list" aria-label="Cupons cadastrados">
        {filtered.length ? (
          <table className="coupons-table">
            <thead>
              <tr>
                {[
                  "Cupom",
                  "Desconto",
                  "Utilizações",
                  "Validade",
                  "Status",
                  "Ações",
                ].map((title) => (
                  <th scope="col" key={title}>
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td className="coupon-identity">
                    <button
                      type="button"
                      onClick={() => openDetail(item)}
                      aria-label={`Detalhes do cupom ${item.codigo}`}
                    >
                      {item.codigo}
                    </button>
                    <p>{item.nome}</p>
                  </td>
                  <td className="coupon-discount">
                    <strong>
                      {item.tipo === "percentual"
                        ? `${item.valor}%`
                        : dinheiro(item.valor)}
                    </strong>
                    <p>Mín. {dinheiro(item.valor_minimo)}</p>
                  </td>
                  <td className="coupon-usage">
                    {item.usos}
                    <span>
                      {item.limite_usos == null
                        ? " / ilimitado"
                        : ` / ${item.limite_usos}`}
                    </span>
                  </td>
                  <td className="coupon-validity">
                    {dataBR(item.data_inicio)}
                    <span>
                      {item.data_fim
                        ? `até ${dataBR(item.data_fim)}`
                        : "Sem data final"}
                    </span>
                  </td>
                  <td className="coupon-status">
                    <span data-status={couponStatus(item, today)}>
                      {couponStatus(item, today)}
                    </span>
                  </td>
                  <td className="coupon-actions">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Ações do cupom ${item.codigo}`}
                        >
                          <MoreHorizontal size={18} aria-hidden="true" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openDetail(item)}>
                          Ver detalhes
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => setDeleteTarget(item)}
                        >
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="coupons-empty">
            <h2>
              {items.length
                ? "Nenhum cupom encontrado"
                : loadError
                  ? "Catálogo de cupons indisponível"
                  : "Nenhum cupom cadastrado"}
            </h2>
            <p>
              {items.length
                ? "Tente outro código, nome ou status."
                : "Crie descontos para utilizar no checkout."}
            </p>
            {items.length ? (
              <button
                onClick={() => {
                  setSearch("");
                  setStatusFilter("todos");
                }}
              >
                Limpar filtros
              </button>
            ) : (
              !loadError && (
                <Button onClick={openCreate} className="coupons-primary">
                  Criar primeiro cupom
                </Button>
              )
            )}
          </div>
        )}
      </section>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!saving) setOpen(next);
        }}
      >
        <SheetContent
          side="right"
          className="coupon-sheet"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (opener.current?.isConnected) opener.current.focus();
            else document.getElementById("coupon-create-trigger")?.focus();
          }}
        >
          <SheetHeader className="coupon-sheet-heading">
            <SheetTitle>
              {detail ? "Detalhes do cupom" : "Novo cupom"}
            </SheetTitle>
            <SheetDescription>
              {detail
                ? "Confira as condições deste desconto."
                : "Configure o desconto e suas condições."}
            </SheetDescription>
          </SheetHeader>
          {detail ? (
            <>
              <div className="coupon-sheet-scroll">
                <dl className="coupon-details">
                  {[
                    ["Código", detail.codigo],
                    ["Nome interno", detail.nome],
                    [
                      "Tipo",
                      detail.tipo === "percentual"
                        ? "Percentual"
                        : "Valor fixo",
                    ],
                    [
                      "Desconto",
                      detail.tipo === "percentual"
                        ? `${detail.valor}%`
                        : dinheiro(detail.valor),
                    ],
                    ["Pedido mínimo", dinheiro(detail.valor_minimo)],
                    ["Utilizações", String(detail.usos)],
                    [
                      "Limite",
                      detail.limite_usos == null
                        ? "Ilimitado"
                        : String(detail.limite_usos),
                    ],
                    ["Início", dataBR(detail.data_inicio)],
                    [
                      "Fim",
                      detail.data_fim
                        ? dataBR(detail.data_fim)
                        : "Sem data final",
                    ],
                    ["Status", couponStatus(detail, today)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="coupon-sheet-footer">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Fechar
                </Button>
              </div>
            </>
          ) : (
            <form id="coupon-form" onSubmit={submit} className="coupon-form">
              <div className="coupon-sheet-scroll">
                {formError && (
                  <p role="alert" className="coupons-error">
                    {formError}
                  </p>
                )}
                <fieldset>
                  <legend>Identificação</legend>
                  <div>
                    <Label htmlFor="coupon-code">Código do cupom</Label>
                    <Input
                      id="coupon-code"
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                      placeholder="Ex.: BEMVINDO"
                      autoComplete="off"
                      spellCheck={false}
                      required
                      minLength={3}
                      maxLength={32}
                      pattern="[A-Z0-9_-]{3,32}"
                    />
                  </div>
                  <div>
                    <Label htmlFor="coupon-name">Nome interno</Label>
                    <Input
                      id="coupon-name"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex.: Primeira compra"
                      required
                      maxLength={80}
                    />
                  </div>
                </fieldset>
                <fieldset>
                  <legend>Configuração do desconto</legend>
                  <div>
                    <Label htmlFor="coupon-type">Tipo de desconto</Label>
                    <Select
                      value={tipo}
                      onValueChange={(v) => {
                        setTipo(v as Cupom["tipo"]);
                        if (valor && Number.isFinite(parseAmount(valor)))
                          setValor(String(parseAmount(valor)));
                      }}
                    >
                      <SelectTrigger id="coupon-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentual">
                          Percentual (%)
                        </SelectItem>
                        <SelectItem value="valor_fixo">
                          Valor fixo (R$)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="coupon-value">
                      {tipo === "percentual" ? "Desconto (%)" : "Desconto (R$)"}
                    </Label>
                    <Input
                      id="coupon-value"
                      type={tipo === "percentual" ? "number" : "text"}
                      inputMode="decimal"
                      min="0.01"
                      max={tipo === "percentual" ? 100 : undefined}
                      step="0.01"
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                      onBlur={() => {
                        if (
                          tipo === "valor_fixo" &&
                          Number.isFinite(parseAmount(valor))
                        )
                          setValor(decimalBR(parseAmount(valor)));
                      }}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="coupon-minimum">Pedido mínimo (R$)</Label>
                    <Input
                      id="coupon-minimum"
                      inputMode="decimal"
                      value={valorMinimo}
                      onChange={(e) => setValorMinimo(e.target.value)}
                      onBlur={() => {
                        if (Number.isFinite(parseAmount(valorMinimo)))
                          setValorMinimo(decimalBR(parseAmount(valorMinimo)));
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="coupon-limit">Limite de utilizações</Label>
                    <Input
                      id="coupon-limit"
                      type="number"
                      min="1"
                      step="1"
                      value={limiteUsos}
                      onChange={(e) => setLimiteUsos(e.target.value)}
                      placeholder="Ilimitado"
                    />
                    <p className="coupon-help">
                      Deixe vazio para não limitar as utilizações.
                    </p>
                  </div>
                </fieldset>
                <fieldset>
                  <legend>Período de validade</legend>
                  <div>
                    <Label htmlFor="coupon-start">Data inicial</Label>
                    <Input
                      id="coupon-start"
                      type="date"
                      value={dataInicio}
                      onChange={(e) => setDataInicio(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="coupon-end">Data final (opcional)</Label>
                    <Input
                      id="coupon-end"
                      type="date"
                      min={dataInicio}
                      value={dataFim}
                      onChange={(e) => setDataFim(e.target.value)}
                    />
                  </div>
                </fieldset>
              </div>
              <div className="coupon-sheet-footer">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => setOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={saving || Boolean(loadError)}
                  className="coupons-primary"
                >
                  {saving && (
                    <Loader2
                      size={15}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  {saving ? "Salvando…" : "Criar cupom"}
                </Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(next) => {
          if (!next && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir cupom {deleteTarget?.codigo}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O cupom será removido e não poderá mais ser utilizado no checkout.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
              onClick={(event) => {
                event.preventDefault();
                if (deleteTarget) void remove(deleteTarget);
              }}
            >
              {deleting ? "Excluindo…" : "Excluir cupom"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
const STATUS_LABELS = ["Ativo", "Agendado", "Expirado", "Esgotado", "Inativo"];
function couponStatus(item: Cupom, today: string) {
  if (!item.ativo) return "Inativo";
  if (today < item.data_inicio) return "Agendado";
  if (item.data_fim && today > item.data_fim) return "Expirado";
  if (item.limite_usos != null && item.usos >= item.limite_usos)
    return "Esgotado";
  return "Ativo";
}
function parseAmount(value: string) {
  return Number(
    value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value,
  );
}
function decimalBR(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
