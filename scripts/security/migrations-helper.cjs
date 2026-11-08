/**
 * Aplica a migration 0024 (softshake_* → donda_*) num banco de teste, na mesma
 * ordem de produção. Os rollbacks já usam os nomes novos (donda_security,
 * donda_*), então os testes precisam passar pela 0024 antes de rodá-los.
 */
const fs = require("node:fs");

async function aplicarRenomeacaoDonda(db) {
  // A 0024 também renomeia a loja em configuracoes_loja; os bancos de teste
  // não têm essa tabela, então cria uma mínima quando ela não existe.
  await db.exec("CREATE TABLE IF NOT EXISTS public.configuracoes_loja (id serial PRIMARY KEY, nome text)");
  await db.exec(fs.readFileSync("supabase/migrations/0024_renomear_softshake_para_donda.sql", "utf8"));
}

module.exports = { aplicarRenomeacaoDonda };
