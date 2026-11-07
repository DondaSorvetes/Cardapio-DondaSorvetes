// Endereço do painel: "adminOrigin" no package.json (vai junto no instalador).
// DONDA_ADMIN_ORIGIN substitui em desenvolvimento e nos testes.
// Só HTTPS; vazio ou inválido = app não abre nenhum site.
function normalizeOrigin(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.origin : '';
  } catch { return ''; }
}
const ORIGIN = normalizeOrigin(process.env.DONDA_ADMIN_ORIGIN || require('./package.json').adminOrigin);
const START_URL = ORIGIN ? ORIGIN + '/admin/pedidos' : '';
function trustedUrl(value) {
  if (!ORIGIN) return false;
  try { const url = new URL(value); return url.origin === ORIGIN && (url.pathname === '/admin' || url.pathname.startsWith('/admin/')); } catch { return false; }
}
function physicalPrinter(printer) {
  return !/Microsoft Print to PDF|OneNote|XPS|Fax|Save as PDF/i.test([printer.name, printer.displayName, printer.description].join(' '));
}
function selectPrinter(printers, configuredName) {
  const physical = printers.filter(physicalPrinter);
  if (configuredName) return physical.find(printer => printer.name === configuredName) || null;
  return physical.find(printer => printer.isDefault) || (physical.length === 1 ? physical[0] : null);
}
module.exports = { ORIGIN, START_URL, normalizeOrigin, trustedUrl, physicalPrinter, selectPrinter };
