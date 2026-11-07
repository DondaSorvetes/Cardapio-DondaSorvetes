// Atualização pelo GitHub Releases (electron-updater), sempre sob demanda:
// nada é verificado, baixado ou instalado sem um clique em "Verificar agora" e
// "Reiniciar e atualizar" na aba Atualizações do painel.

function plainNotes(notes) {
  // electron-updater pode entregar HTML ou uma lista por versão: o painel recebe só texto.
  const raw = Array.isArray(notes) ? notes.map(n => n && n.note).filter(Boolean).join('\n') : notes || '';
  return String(raw).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim().slice(0, 4000);
}

/** Converte erros do electron-updater (stack + headers HTTP) em uma frase curta. */
function friendlyError(error) {
  const message = String((error && error.message) || error || '');
  if (/latest\.yml|404/i.test(message)) return 'A versão publicada no GitHub ainda não está completa. Tente novamente em alguns minutos.';
  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET|net::ERR_|getaddrinfo|offline/i.test(message)) return 'Sem conexão com o GitHub. Confira a internet e tente novamente.';
  if (/sha512|checksum/i.test(message)) return 'O download chegou corrompido. Tente verificar novamente.';
  return message.split('\n')[0].slice(0, 200) || 'Não foi possível verificar atualizações.';
}

function createUpdater({ app, ipcMain, getWindow, validateSender, loadAutoUpdater, now = () => new Date() }) {
  const state = { status: 'idle', version: typeof app.getVersion === 'function' ? app.getVersion() : '', available: null, progress: null, notes: '', releaseDate: null, checkedAt: null, error: null };
  let autoUpdater = null;
  const emit = patch => {
    Object.assign(state, patch);
    const win = getWindow();
    if (win && !win.isDestroyed() && typeof win.webContents.send === 'function') win.webContents.send('donda:update-status', { ...state });
  };

  // Carregado só no primeiro clique: até lá o app não faz nenhuma requisição ao GitHub.
  function ensureUpdater() {
    if (autoUpdater) return autoUpdater;
    autoUpdater = loadAutoUpdater();
    autoUpdater.autoDownload = true; // baixa apenas depois de um "Verificar agora"
    autoUpdater.autoInstallOnAppQuit = false; // instala só por "Reiniciar e atualizar"
    autoUpdater.on('checking-for-update', () => emit({ status: 'checking', error: null }));
    autoUpdater.on('update-available', info => emit({ status: 'downloading', available: info.version, notes: plainNotes(info.releaseNotes), releaseDate: info.releaseDate || null, progress: 0 }));
    autoUpdater.on('update-not-available', () => emit({ status: 'up-to-date', available: null, progress: null, checkedAt: now().toISOString() }));
    autoUpdater.on('download-progress', p => emit({ status: 'downloading', progress: Math.round(p.percent || 0) }));
    autoUpdater.on('update-downloaded', info => emit({ status: 'downloaded', available: info.version, notes: plainNotes(info.releaseNotes) || state.notes, progress: 100, checkedAt: now().toISOString() }));
    autoUpdater.on('error', error => emit({ status: 'error', error: friendlyError(error), checkedAt: now().toISOString() }));
    return autoUpdater;
  }

  ipcMain.handle('donda:update-state', event => { validateSender(event); return { ...state }; });
  ipcMain.handle('donda:update-check', async event => {
    validateSender(event);
    if (state.status === 'disabled' || state.status === 'checking' || state.status === 'downloading') return { ...state };
    try { await ensureUpdater().checkForUpdates(); }
    catch (error) { emit({ status: 'error', error: friendlyError(error), checkedAt: now().toISOString() }); }
    return { ...state };
  });
  ipcMain.handle('donda:update-install', event => {
    validateSender(event);
    if (!autoUpdater || state.status !== 'downloaded') throw Error('Nenhuma atualização pronta para instalar.');
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
    return { accepted: true };
  });

  function start() {
    // Em desenvolvimento (npm start) não há o que atualizar; no app instalado, aguarda o clique.
    emit({ status: app.isPackaged ? 'idle' : 'disabled' });
  }
  return { start, state };
}
module.exports = { createUpdater, plainNotes, friendlyError };
