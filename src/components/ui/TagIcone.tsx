import {
  Award,
  Baby,
  BadgeCheck,
  ChefHat,
  Coins,
  CupSoda,
  Dumbbell,
  Flame,
  Gift,
  Heart,
  IceCreamCone,
  Leaf,
  MilkOff,
  Package,
  Percent,
  Salad,
  Snowflake,
  Sparkles,
  Star,
  Tag,
  ThumbsUp,
  Timer,
  Truck,
  WheatOff,
  Zap,
  Crown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type IconeDef = { label: string; Icon: LucideIcon; palavras: string[] };

/**
 * Ícones das tags. A ordem importa na detecção automática pelo nome
 * (ex.: "Ofertas da casa" casa com `oferta` antes de `chef`).
 */
export const TAG_ICONES = {
  mais_pedido: { label: "Mais pedido", Icon: Flame, palavras: ["mais pedid", "quente", "hot", "bomba"] },
  mais_vendido: { label: "Mais vendido", Icon: Star, palavras: ["mais vendid", "vendid", "sucesso", "estrela"] },
  promocao: { label: "Promoção", Icon: Percent, palavras: ["promo", "desconto", "% off", " off", "black"] },
  oferta: { label: "Oferta", Icon: Tag, palavras: ["oferta", "preco", "barat", "economi"] },
  cashback: { label: "Cashback", Icon: Coins, palavras: ["cashback", "pontos", "moeda"] },
  novidade: { label: "Novidade", Icon: Sparkles, palavras: ["novidade", "novo", "nova", "lancamento"] },
  premium: { label: "Premium", Icon: Crown, palavras: ["premium", "gourmet", "vip", "luxo"] },
  favorito: { label: "Favorito", Icon: Heart, palavras: ["favorit", "querid", "amor", "love"] },
  recomendado: { label: "Recomendado", Icon: ThumbsUp, palavras: ["recomend", "indica", "aprovad"] },
  chef: { label: "Chef / da casa", Icon: ChefHat, palavras: ["chef", "da casa", "especial", "artesanal"] },
  limitado: { label: "Tempo limitado", Icon: Timer, palavras: ["limitad", "tempo", "hoje", "do dia", "semana"] },
  rapido: { label: "Rápido", Icon: Zap, palavras: ["rapid", "express", "relampago", "flash"] },
  frete: { label: "Frete / entrega", Icon: Truck, palavras: ["frete", "entrega"] },
  combo: { label: "Combo", Icon: Package, palavras: ["combo", "kit", "galera", "familia"] },
  presente: { label: "Brinde", Icon: Gift, palavras: ["brinde", "presente", "gratis", "surpresa"] },
  vegano: { label: "Vegano", Icon: Leaf, palavras: ["vegan", "vegetarian", "natural", "organico"] },
  saudavel: { label: "Saudável", Icon: Salad, palavras: ["saudavel", "light", "zero", "diet"] },
  fit: { label: "Fit", Icon: Dumbbell, palavras: ["fit", "proteina", "whey", "treino"] },
  sem_lactose: { label: "Sem lactose", Icon: MilkOff, palavras: ["lactose"] },
  sem_gluten: { label: "Sem glúten", Icon: WheatOff, palavras: ["gluten"] },
  kids: { label: "Kids", Icon: Baby, palavras: ["kids", "infantil", "crianca"] },
  sorvete: { label: "Sorvete / shake", Icon: IceCreamCone, palavras: ["sorvete", "acai", "shake", "milk", "casquinha"] },
  gelado: { label: "Gelado", Icon: Snowflake, palavras: ["gelad", "frio", "verao", "refrescante"] },
  bebida: { label: "Bebida", Icon: CupSoda, palavras: ["bebida", "refri", "suco", "drink"] },
  destaque: { label: "Destaque", Icon: Award, palavras: ["destaque", "top", "melhor", "campea"] },
  padrao: { label: "Selo", Icon: BadgeCheck, palavras: [] },
} satisfies Record<string, IconeDef>;

export type TagIconeKey = keyof typeof TAG_ICONES;

export const TAG_ICONE_KEYS = Object.keys(TAG_ICONES) as TagIconeKey[];

function normalizar(texto: string) {
  return ` ${texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()} `;
}

/** Ícone salvo na tag (se válido) ou escolhido pelo nome. */
export function resolverTagIcone(nome: string, icone?: string | null): TagIconeKey {
  if (icone && icone in TAG_ICONES) return icone as TagIconeKey;
  const n = normalizar(nome);
  for (const key of TAG_ICONE_KEYS) {
    if (TAG_ICONES[key].palavras.some((p) => n.includes(p))) return key;
  }
  return "padrao";
}

/** Contorno serrilhado de selo (12 pontas) num viewBox 24×24. */
const SELO_PATH = (() => {
  const pontas = 12;
  const centro = 12;
  const interno = 10.2;
  const externo = 12.4;
  const ponto = (r: number, a: number) =>
    `${(centro + r * Math.cos(a)).toFixed(2)} ${(centro + r * Math.sin(a)).toFixed(2)}`;
  let d = `M${ponto(interno, -Math.PI / 2)}`;
  for (let i = 0; i < pontas; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / pontas;
    const meio = a + Math.PI / pontas;
    const fim = a + (2 * Math.PI) / pontas;
    d += ` Q${ponto(externo, meio)} ${ponto(interno, fim)}`;
  }
  return `${d} Z`;
})();

/**
 * Ícone da tag. `selo`: forma serrilhada na cor da tag com o símbolo por cima
 * (títulos do cardápio). `glifo`: só o símbolo (dentro de badges).
 */
export function TagIcone({
  nome,
  icone,
  cor = "#EF4444",
  corSimbolo = "#FFFFFF",
  variante = "selo",
  className,
}: {
  nome: string;
  icone?: string | null;
  cor?: string;
  corSimbolo?: string;
  variante?: "selo" | "glifo";
  className?: string;
}) {
  const { Icon } = TAG_ICONES[resolverTagIcone(nome, icone)];
  if (variante === "glifo") {
    return (
      <Icon
        aria-hidden="true"
        className={cn("h-3 w-3 shrink-0", className)}
        strokeWidth={2.4}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-flex h-7 w-7 shrink-0 items-center justify-center", className)}
    >
      <svg viewBox="0 0 24 24" className="absolute inset-0 h-full w-full">
        <path d={SELO_PATH} fill={cor} />
      </svg>
      <Icon
        className="relative h-[55%] w-[55%]"
        strokeWidth={2.6}
        style={{ color: corSimbolo }}
      />
    </span>
  );
}
