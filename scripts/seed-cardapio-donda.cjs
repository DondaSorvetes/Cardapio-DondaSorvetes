/**
 * Popula o cardápio da Sorvetes Donda (categorias, produtos, grupos de opções e opções)
 * a partir do PDF "Cardápio Sorvetes Donda.pdf".
 *
 * Uso: node scripts/seed-cardapio-donda.cjs
 * Lê NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do .env.local.
 * Recusa rodar se já houver produtos cadastrados (para não duplicar).
 */
const fs = require("fs");
const path = require("path");

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(__dirname, "..", ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");

async function rest(method, table, { query = "", body } = {}) {
  const res = await fetch(`${URL_BASE}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${table}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

// ---------------- Dados do PDF ----------------
const SABORES_PICOLE = [
  "Uva", "Açaí", "Caju", "Limão", "Banana", "Abacaxi", "Groselha", "Morango", "Coalhada",
  "Tamarindo", "Céu Azul", "Chocolate", "Milho Verde", "Doce de Leite", "Coco Branco",
  "Coco Queimado", "Creme Holandês", "Salada de Frutas",
];
const SABORES_SKIMO = ["Tradicional", "Morango"];
const SABORES_PICOLE_GOURMET = [
  "Limão", "Nutella", "Choco Biscoito", "Morango Cravejado",
  "Morango c/ Choc. Preto", "Morango c/ Choc. Branco",
  "Maracujá c/ Choc. Preto", "Maracujá c/ Choc. Branco",
  "Frutas Vermelhas c/ Choc. Preto", "Frutas Vermelhas c/ Choc. Branco",
];
const SABORES_ESKI = ["Açaí", "Ninho", "Brownie", "Prestígio", "Morango", "Tradicional"];
// Pistache tem preço próprio (página "PISTACHE"), por isso vira produto separado.
const SABORES_POTE = [
  "Oreo", "Laka", "Flocos", "Ameixa", "Paçoca", "Brownie", "Chiclete", "Céu Azul", "Camafeu",
  "Morango", "Brigadeiro", "Terremoto", "Kinder Bueno", "Iogurte c/ Maracujá",
  "Abacaxi Caramelizado", "Raffaello", "Café Moka", "Leite Ninho", "Ovomaltine",
  "Doce de Leite", "Coco Branco", "Torta de Limão", "Ninho Trufado", "Ferrero Rocher",
  "Coco Queimado", "Iogurte c/ Frutas Vermelhas",
];
const SABORES_POTE_1L = [...SABORES_POTE, "Napolitano"]; // "Napolitano — apenas 1L"
const SABORES_ZERO = ["Chocolate", "Ninho Trufado", "Frutas Vermelhas"];
const SABORES_TORTA_PEQ = ["Limão", "Nutella", "Frutas Vermelhas"];
const SABORES_TORTA_GRD = ["Nutella", "Ferrero Rocher", "Frutas Vermelhas"];

const GRUPOS = {
  picole: { nome: "Sabor do Picolé", sabores: SABORES_PICOLE },
  skimo: { nome: "Sabor do Skimo", sabores: SABORES_SKIMO },
  gourmet: { nome: "Sabor do Picolé Gourmet", sabores: SABORES_PICOLE_GOURMET },
  eski: { nome: "Sabor do Eski Donda", sabores: SABORES_ESKI },
  pote: { nome: "Sabor do Pote", sabores: SABORES_POTE },
  pote1l: { nome: "Sabor do Pote 1 Litro", sabores: SABORES_POTE_1L },
  zero: { nome: "Sabor Zero Açúcar", sabores: SABORES_ZERO },
  tortaPeq: { nome: "Sabor da Torta (Individual/Fatia)", sabores: SABORES_TORTA_PEQ },
  tortaGrd: { nome: "Sabor da Torta (Média/Grande)", sabores: SABORES_TORTA_GRD },
};

const CATEGORIAS = [
  {
    nome: "Picolés",
    produtos: [
      { nome: "Picolé", preco: 3, grupo: "picole", descricao: "Picolé tradicional Donda. Escolha o sabor." },
      { nome: "Skimo", preco: 5, grupo: "skimo", descricao: "Skimo tradicional ou de morango." },
      { nome: "Picolé Gourmet", preco: 15, grupo: "gourmet", descricao: "Picolé gourmet recheado e coberto." },
      { nome: "Eski Donda", preco: 15, grupo: "eski", descricao: "O picolé especial da casa." },
    ],
  },
  {
    nome: "Potes",
    produtos: [
      { nome: "Pote 200ml", preco: 8, grupo: "pote", descricao: "Sorvete de massa no pote de 200ml." },
      { nome: "Pote 500ml", preco: 18, grupo: "pote", descricao: "Sorvete de massa no pote de 500ml." },
      { nome: "Pote 1 Litro", preco: 30, grupo: "pote1l", descricao: "Sorvete de massa no pote de 1 litro." },
      { nome: "Pote Pistache 200ml", preco: 13, descricao: "Sorvete de pistache no pote de 200ml." },
      { nome: "Pote Pistache 500ml", preco: 25, descricao: "Sorvete de pistache no pote de 500ml." },
      { nome: "Pote Pistache 1 Litro", preco: 45, descricao: "Sorvete de pistache no pote de 1 litro." },
    ],
  },
  {
    nome: "Potes Zero Açúcar",
    produtos: [
      { nome: "Pote Zero Açúcar 200ml", preco: 13, grupo: "zero", descricao: "Sorvete zero açúcar no pote de 200ml." },
      { nome: "Pote Zero Açúcar 500ml", preco: 25, grupo: "zero", descricao: "Sorvete zero açúcar no pote de 500ml." },
    ],
  },
  {
    nome: "Tortas Gourmet",
    produtos: [
      { nome: "Torta Individual", preco: 12, grupo: "tortaPeq", descricao: "Torta gourmet individual." },
      { nome: "Torta Fatia", preco: 20, grupo: "tortaPeq", descricao: "Fatia de torta gourmet." },
      { nome: "Torta Média", preco: 50, grupo: "tortaGrd", descricao: "Torta gourmet tamanho médio." },
      { nome: "Torta Grande", preco: 110, grupo: "tortaGrd", descricao: "Torta gourmet tamanho grande." },
    ],
  },
  {
    nome: "Casquinhas e Coberturas",
    produtos: [
      { nome: "Casquinha c/ 10un", preco: 5, descricao: "Pacote com 10 casquinhas." },
      { nome: "Cascão c/ 10un", preco: 7, descricao: "Pacote com 10 cascões." },
      { nome: "Cobertura 300g", preco: 13, descricao: "Cobertura para sorvete, 300g." },
    ],
  },
];

async function main() {
  const existentes = await rest("GET", "produtos", { query: "?select=id&limit=1" });
  if (existentes.length) throw new Error("Já existem produtos cadastrados; abortando para não duplicar.");

  // Remove as categorias de modelo (sem produtos, pois a tabela está vazia).
  await rest("DELETE", "categorias", { query: "?id=gt.0" });

  const grupoIds = {};
  for (const [chave, g] of Object.entries(GRUPOS)) {
    const [grupo] = await rest("POST", "grupos_opcoes", {
      body: { nome: g.nome, min_escolha: 1, max_escolha: 1 },
    });
    grupoIds[chave] = grupo.id;
    await rest("POST", "opcoes", {
      body: g.sabores.map((nome, i) => ({
        nome, grupo_id: grupo.id, preco_adicional: 0, ordem: i + 1, status: "disponivel", esta_disponivel: true,
      })),
    });
  }

  let totalProdutos = 0;
  for (const [ci, cat] of CATEGORIAS.entries()) {
    const [categoria] = await rest("POST", "categorias", { body: { nome: cat.nome, ordem: ci + 1 } });
    for (const [pi, p] of cat.produtos.entries()) {
      const [produto] = await rest("POST", "produtos", {
        body: {
          nome: p.nome, descricao: p.descricao, preco_base: p.preco,
          categoria_id: categoria.id, esta_disponivel: true, ordem: pi + 1,
        },
      });
      totalProdutos++;
      if (p.grupo) {
        await rest("POST", "produto_grupos", {
          body: { produto_id: produto.id, grupo_id: grupoIds[p.grupo], ordem: 1 },
        });
      }
    }
  }

  const totalOpcoes = Object.values(GRUPOS).reduce((n, g) => n + g.sabores.length, 0);
  console.log(`OK: ${CATEGORIAS.length} categorias, ${totalProdutos} produtos, ${Object.keys(GRUPOS).length} grupos, ${totalOpcoes} opções.`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
