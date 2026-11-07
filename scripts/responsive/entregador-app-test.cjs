/** App do entregador (mobile/entregador): regras puras e garantias de segurança. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const APP = "mobile/entregador";
function load(file) {
  const mod = { exports: {} };
  const out = ts.transpileModule(fs.readFileSync(path.resolve(file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function("require", "module", "exports", out)(require, mod, mod.exports);
  return mod.exports;
}
const lib = load(`${APP}/src/lib/entregas.ts`);
const read = (f) => fs.readFileSync(path.join(APP, f), "utf8");

test("endereço do cardápio (jsonb ou texto) vira linhas legíveis", () => {
  const e = lib.formatarEndereco({ logradouro: "Rua das Flores", numero: "120", bairro: "Centro", cidade: "Poloni", estado: "SP", cep: "15160-000", complemento: "Apto 3", referencia: "Ao lado da padaria" });
  assert.equal(e.linha1, "Rua das Flores, 120 — Centro");
  assert.equal(e.linha2, "Poloni/SP · CEP 15160-000");
  assert.equal(e.complemento, "Apto 3");
  assert.equal(e.referencia, "Ao lado da padaria");
  assert.equal(lib.formatarEndereco(JSON.stringify({ logradouro: "Rua A", numero: "1" })).linha1, "Rua A, 1");
  assert.equal(lib.formatarEndereco("Rua B, 2").linha1, "Rua B, 2");
  assert.equal(lib.formatarEndereco(null).linha1, "Endereço não informado");
});

test("pagamento: forma e valor sempre; troco só em dinheiro", () => {
  assert.deepEqual(lib.resumoPagamento({ meio_pagamento: "pix", total: 45, troco_para: "50" }), { forma: "Pix", valor: "R$ 45,00", troco: null, levarTroco: false, valorTroco: null });
  const din = lib.resumoPagamento({ meio_pagamento: "dinheiro", total: 45, troco_para: "100" });
  assert.equal(din.forma, "Dinheiro");
  assert.equal(din.levarTroco, true);
  assert.equal(din.valorTroco, "R$ 55,00");
  assert.equal(din.troco, "Levar R$ 55,00 de troco (cliente paga com R$ 100,00)");
  assert.equal(lib.resumoPagamento({ meio_pagamento: "dinheiro", total: 45, troco_para: null }).troco, "Sem troco");
  assert.equal(lib.resumoPagamento({ meio_pagamento: "dinheiro", total: 45, troco_para: "45" }).troco, "Sem troco");
  assert.equal(lib.resumoPagamento({ meio_pagamento: "cartao", total: 10, troco_para: null }).forma, "Cartão");
  assert.equal(lib.parseTroco("R$ 1.234,50"), 1234.5);
  assert.equal(lib.parseTroco("não"), null);
});

test("telefone e horário de saída", () => {
  assert.equal(lib.formatarTelefone("5517991234567"), "(17) 99123-4567");
  assert.equal(lib.formatarTelefone("1733334444"), "(17) 3333-4444");
  assert.equal(lib.linkTelefone("(17) 99123-4567"), "tel:17991234567");
  assert.equal(lib.linkTelefone(""), null);
  const saiu = Date.parse("2026-11-04T17:30:00Z");
  assert.equal(lib.horaSaida("2026-11-04T17:30:00Z", saiu + 12 * 60000), "Saiu às 14:30 · há 12 min");
});

test("erros do banco e do login viram mensagens claras", () => {
  assert.equal(lib.traduzirErro({ message: "NAO_ENTREGADOR" }).tipo, "sem_acesso");
  assert.equal(lib.traduzirErro({ message: "ENTREGADOR_INATIVO" }).tipo, "desativado");
  assert.equal(lib.traduzirErro({ message: "User is banned" }).tipo, "desativado");
  assert.equal(lib.traduzirErro({ message: "PEDIDO_INDISPONIVEL" }).tipo, "indisponivel");
  assert.equal(lib.traduzirErro({ message: "Invalid login credentials" }).mensagem, "E-mail ou senha incorretos.");
  assert.equal(lib.traduzirErro({ message: "TypeError: Network request failed" }).tipo, "conexao");
});

test("lista do banco é normalizada sem quebrar com dados faltando", () => {
  const [e] = lib.normalizarEntregas([{ id: "abc", numero: "ABC12345", cliente_nome: "Ana", itens: [{ qtd: 2, nome: "Açaí", obs: null }], total: "45.50", meio_pagamento: "pix" }]);
  assert.equal(e.total, 45.5);
  assert.deepEqual(e.itens, [{ qtd: 2, nome: "Açaí", obs: null }]);
  assert.deepEqual(lib.normalizarEntregas(null), []);
});

test("app só fala com o banco pelas funções e pelo canal privado da migration 0019", () => {
  const migration = fs.readFileSync("supabase/migrations/0019_entregadores.sql", "utf8");
  const codigo = ["src/hooks/useAuth.ts", "src/hooks/useEntregas.ts", "src/lib/supabase.ts", "App.tsx"].map(read).join("\n");
  for (const rpc of codigo.matchAll(/\.rpc\("(\w+)"/g)) assert.match(migration, new RegExp(`FUNCTION public\\.${rpc[1]}\\(`), rpc[1]);
  assert.doesNotMatch(codigo, /\.from\("pedidos"\)|\.from\('pedidos'\)/, "nada de ler/alterar pedidos direto");
  assert.match(codigo, /channel\(`entregador:\$\{userId\}`, \{ config: \{ private: true \} \}\)/);
  assert.match(migration, /'entregador:' \|\| alvo::text/);
  assert.match(codigo, /event: "entregas_mudaram"/);
  assert.match(migration, /'entregas_mudaram'/);
  assert.match(codigo, /realtime\.setAuth/);
});

test("sem chave secreta, sem cadastro público, sessão no SecureStore", () => {
  const todos = ["App.tsx", "app.json", ".env.example", "src/lib/supabase.ts", "src/lib/secureStorage.ts", "src/hooks/useAuth.ts", "src/screens/LoginScreen.tsx"].map(read).join("\n");
  assert.doesNotMatch(todos, /SERVICE_ROLE_KEY|sb_secret_/i, "nenhuma chave secreta no app");
  assert.doesNotMatch(read("src/lib/supabase.ts") + read("src/hooks/useAuth.ts"), /signUp|signInWithOAuth|signInWithOtp/);
  assert.match(read("src/lib/supabase.ts"), /storage: secureStorage/);
  assert.match(read(".gitignore"), /\.env\*\.local/);
});

test("concluir: botão travado durante o envio e card só sai com a confirmação do servidor", () => {
  const detalhe = read("src/screens/EntregaDetalhe.tsx");
  assert.match(detalhe, /if \(!entrega \|\| enviando\) return;/);
  assert.match(detalhe, /carregando=\{enviando\}/);
  // O card compacto só abre os detalhes; a ação fica nos detalhes.
  assert.doesNotMatch(read("src/components/EntregaCard.tsx"), /onConcluir|Marcar como entregue/);
  assert.equal(JSON.parse(read("app.json")).expo.userInterfaceStyle, "light", "app sempre branco");
  const hook = read("src/hooks/useEntregas.ts");
  const concluir = hook.slice(hook.indexOf("const concluir"));
  assert.ok(concluir.indexOf("if (error)") < concluir.indexOf("setEntregas((lista) => lista.filter"), "remove só depois de conferir o erro");
  assert.match(hook, /state === "background"[\s\S]*desconectar\(\)/, "fecha o canal em segundo plano");
  assert.doesNotMatch(hook, /setInterval/, "sem polling");
});

test("busca por cliente, número ou rua ignora acento, maiúscula e # e exige todas as palavras", () => {
  const lista = lib.normalizarEntregas([
    { id: "1", numero: "AB12CD34", cliente_nome: "João Silva", endereco: { logradouro: "Rua São Bento", numero: "10" } },
    { id: "2", numero: "EF56GH78", cliente_nome: "Ana Paula", endereco: { logradouro: "Av. Brasil", numero: "200" } },
  ]);
  const ids = (q) => lib.filtrarEntregas(lista, q).map((e) => e.id);
  assert.deepEqual(ids(""), ["1", "2"]);
  assert.deepEqual(ids("joao"), ["1"]);
  assert.deepEqual(ids("  ANA  "), ["2"]);
  assert.deepEqual(ids("#ef56"), ["2"]);
  assert.deepEqual(ids("sao bento"), ["1"]);
  assert.deepEqual(ids("joao brasil"), [], "todas as palavras");
});

test("saudação pelo horário de São Paulo e contagem", () => {
  assert.equal(lib.saudacao(Date.parse("2026-11-04T11:00:00Z")), "Bom dia"); // 08h
  assert.equal(lib.saudacao(Date.parse("2026-11-04T17:00:00Z")), "Boa tarde"); // 14h
  assert.equal(lib.saudacao(Date.parse("2026-11-04T23:30:00Z")), "Boa noite"); // 20h30
  assert.equal(lib.contagemEntregas(0), "Nenhuma entrega no momento");
  assert.equal(lib.contagemEntregas(1), "1 entrega para fazer");
  assert.equal(lib.contagemEntregas(3), "3 entregas para fazer");
});

test("tela de entregas: sem logo, nome em destaque, busca e acessibilidade", () => {
  const tela = read("src/screens/EntregasScreen.tsx");
  assert.doesNotMatch(tela, /logo\.png/, "sem imagem no topo da lista");
  assert.match(tela, /accessibilityRole="header"[\s\S]{0,40}numberOfLines=\{2\}/);
  assert.match(tela, /<BarraBusca/);
  assert.match(tela, /anunciar\(`Nova entrega/);
  assert.match(tela, /useReduzirMovimento/);
  assert.match(read("src/components/BarraBusca.tsx"), /accessibilityLabel="Buscar entrega"/);
  const card = read("src/components/EntregaCard.tsx");
  assert.match(card, /fontScale/, "letra grande quebra linha em vez de cortar");
  assert.match(card, /levar troco de/);
  assert.doesNotMatch(read("src/screens/LoginScreen.tsx"), /placeholderTextColor=\{t\.subtle\}/, "contraste do texto de exemplo");
});
