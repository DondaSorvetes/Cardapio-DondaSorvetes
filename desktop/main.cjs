const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { ORIGIN, START_URL, trustedUrl, physicalPrinter, selectPrinter } = require('./policy.cjs');
const { createUpdater } = require('./updater.cjs');

app.setName('Sorvetes Donda');
// Preserve the existing login and printer preferences when upgrading the renamed app.
app.setPath('userData', path.join(app.getPath('appData'), 'Donda Admin'));
app.setAppUserModelId('br.com.sorvetesdonda.admin');
let mainWindow, printing = false;
function readSettings() {
  try { return JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'printer.json'), 'utf8')); } catch { return {}; }
}
function savePrinter(name) {
  fs.writeFileSync(path.join(app.getPath('userData'), 'printer.json'), JSON.stringify({ printerName: name }));
}
function validateSender(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame || !trustedUrl(event.senderFrame.url)) throw Error('Origem de impressão inválida.');
}
const updater = createUpdater({ app, ipcMain, getWindow: () => mainWindow, validateSender, loadAutoUpdater: () => require('electron-updater').autoUpdater });
ipcMain.handle('donda:printers', async event => {
  validateSender(event);
  return { selected: readSettings().printerName || '', printers: (await mainWindow.webContents.getPrintersAsync()).filter(physicalPrinter).map(p => ({ name: p.name, label: p.displayName || p.name, isDefault: p.isDefault })) };
});
ipcMain.handle('donda:select-printer', async (event, name) => {
  validateSender(event);
  if (typeof name !== 'string' || (name !== '' && !(await mainWindow.webContents.getPrintersAsync()).some(p => physicalPrinter(p) && p.name === name))) throw Error('Impressora indisponível. Atualize a lista e tente novamente.');
  savePrinter(name);
});
ipcMain.handle('donda:windows-printers', async event => {
  validateSender(event);
  await shell.openExternal('ms-settings:printers');
});

ipcMain.handle('donda:print', async event => {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame || !trustedUrl(event.senderFrame.url)) throw Error('Origem de impressão inválida.');
  if (printing) throw Error('Já existe uma impressão em andamento.');
  printing = true;
  try {
    const ready = await mainWindow.webContents.executeJavaScript("Boolean(document.querySelector('.print-root .print-ticket'))");
    if (!ready) throw Error('A comanda ainda não está pronta para impressão.');
    const printer = selectPrinter(await mainWindow.webContents.getPrintersAsync(), readSettings().printerName);
    if (!printer) throw Error('Escolha uma impressora física nas configurações de impressão do painel.');
    await new Promise((resolve, reject) => mainWindow.webContents.print({ silent: true, printBackground: true, deviceName: printer.name, usePrinterDefaultPageSize: true }, (success, reason) => success ? resolve() : reject(Error(reason || 'O Windows não aceitou a impressão.'))));
    return { accepted: true };
  } catch (error) {
    await dialog.showMessageBox(mainWindow, { type: 'error', title: 'Não foi possível imprimir', message: error.message, detail: 'Confira a impressora nas configurações de impressão. O pedido continua no painel e pode ser reimpresso manualmente.' });
    throw error;
  } finally { printing = false; }
});

async function createWindow() {
  if (!ORIGIN) {
    // Sem endereço do painel configurado o app não abre nenhum site.
    await dialog.showMessageBox({ type: 'error', title: 'Sorvetes Donda', message: 'Endereço do painel não configurado.', detail: 'Defina "adminOrigin" (ex.: https://seu-dominio.com.br) no package.json do app desktop e gere o instalador de novo.', buttons: ['Fechar'] });
    app.quit();
    return;
  }
  mainWindow = new BrowserWindow({ width: 1360, height: 900, minWidth: 800, minHeight: 600, title: 'Sorvetes Donda', icon: path.join(__dirname, 'assets/icon.png'), backgroundColor: '#F7F8FC', show: false, fullscreen: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, backgroundThrottling: false, partition: 'persist:donda-admin', additionalArguments: ['--donda-origin=' + ORIGIN] } });
  Menu.setApplicationMenu(null);
  mainWindow.setMenuBarVisibility(false);
  // Janela normal maximizada: mantém a barra do Windows com minimizar, restaurar e fechar.
  mainWindow.once('ready-to-show', () => { mainWindow.maximize(); mainWindow.show(); });
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.isAutoRepeat) return;
    if (input.key === 'F11') {
      event.preventDefault();
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    } else if (input.key === 'F5' || ((input.control || input.meta) && !input.alt && input.key.toLowerCase() === 'r')) {
      // Sem menu não há atalho nativo de recarregar: sem isso o painel ficava preso
      // na versão de antes de uma publicação nova, e as ações do servidor falhavam.
      event.preventDefault();
      mainWindow.webContents.reloadIgnoringCache();
    }
  });
  mainWindow.webContents.on('page-title-updated', event => { event.preventDefault(); mainWindow.setTitle('Sorvetes Donda'); });
  mainWindow.webContents.on('will-navigate', (event, url) => { if (!trustedUrl(url)) event.preventDefault(); });
  mainWindow.webContents.on('will-redirect', (event, url) => { if (!trustedUrl(url)) event.preventDefault(); });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try { const target = new URL(url); if (target.protocol === 'https:') void shell.openExternal(target.href); } catch { /* Ignore malformed URLs. */ }
    return { action: 'deny' };
  });
  mainWindow.webContents.session.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(permission === 'clipboard-sanitized-write' && contents === mainWindow.webContents && trustedUrl(details.requestingUrl || contents.getURL()));
  });
  mainWindow.webContents.on('did-fail-load', (_event, code, _description, _url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    mainWindow.show();
    void dialog.showMessageBox(mainWindow, { type: 'warning', title: 'Conexão com o Sorvetes Donda', message: 'Não foi possível abrir o painel. Confira a internet.', buttons: ['Tentar novamente', 'Fechar'] }).then(({ response }) => response === 0 ? mainWindow.loadURL(START_URL) : mainWindow.close());
  });
  // Refresh HTTP cache on launch only. Cookies, local storage and printer settings remain.
  try { await mainWindow.webContents.session.clearCache(); }
  catch { /* The explicit no-cache navigation still checks the current panel. */ }
  if (!mainWindow.isDestroyed()) {
    void mainWindow.loadURL(START_URL, { extraHeaders: 'Cache-Control: no-cache\nPragma: no-cache' }).catch(() => {});
  }
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } });
  app.whenReady().then(async () => { await createWindow(); if (ORIGIN) updater.start(); });
  app.on('window-all-closed', () => app.quit());
}
