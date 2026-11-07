const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createUpdater, plainNotes, friendlyError } = require('./updater.cjs');

function harness({ packaged = true } = {}) {
  const handlers = {}, sent = [];
  let loads = 0;
  const auto = Object.assign(new EventEmitter(), { checks: 0, installs: 0, checkForUpdates: async () => { auto.checks++; }, quitAndInstall() { auto.installs++; } });
  const win = { isDestroyed: () => false, webContents: { send: (channel, state) => sent.push([channel, state]) } };
  const trusted = { sender: 'main' };
  const updater = createUpdater({
    app: { isPackaged: packaged, getVersion: () => '1.2.2' },
    ipcMain: { handle: (channel, fn) => { handlers[channel] = fn; } },
    getWindow: () => win,
    validateSender: event => { if (event !== trusted) throw Error('Origem inválida'); },
    loadAutoUpdater: () => { loads++; return auto; },
    now: () => new Date('2026-11-03T12:00:00Z'),
  });
  return { updater, handlers, sent, auto, trusted, loads: () => loads };
}

test('nothing is checked, downloaded or loaded until the user clicks', async () => {
  const h = harness();
  h.updater.start();
  assert.equal(h.loads(), 0, 'electron-updater is not even loaded on start');
  assert.equal(h.auto.checks, 0);
  assert.equal((await h.handlers['donda:update-state'](h.trusted)).status, 'idle');
});

test('development builds stay disabled even when the button is clicked', async () => {
  const h = harness({ packaged: false });
  h.updater.start();
  assert.equal((await h.handlers['donda:update-check'](h.trusted)).status, 'disabled');
  assert.equal(h.loads(), 0);
});

test('a click checks once, downloads, and installs only on explicit request', async () => {
  const h = harness();
  h.updater.start();
  await h.handlers['donda:update-check'](h.trusted);
  assert.equal(h.auto.checks, 1);
  assert.equal(h.auto.autoDownload, true);
  assert.equal(h.auto.autoInstallOnAppQuit, false, 'never installs silently on quit');
  await assert.rejects(() => Promise.resolve().then(() => h.handlers['donda:update-install'](h.trusted)), /Nenhuma atualização/);
  h.auto.emit('update-available', { version: '1.3.0', releaseNotes: '<p>Novo <b>catálogo</b></p>' });
  h.auto.emit('download-progress', { percent: 42.4 });
  assert.deepEqual([h.updater.state.status, h.updater.state.progress, h.updater.state.notes], ['downloading', 42, 'Novo catálogo']);
  await h.handlers['donda:update-check'](h.trusted);
  assert.equal(h.auto.checks, 1, 'a second click while downloading does not start another check');
  h.auto.emit('update-downloaded', { version: '1.3.0' });
  assert.equal(h.updater.state.status, 'downloaded');
  assert.equal(h.sent.at(-1)[0], 'donda:update-status');
  assert.equal(h.auto.installs, 0);
  await h.handlers['donda:update-install'](h.trusted);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.auto.installs, 1);
});

test('errors become short messages, and IPC rejects untrusted senders', async () => {
  const h = harness();
  h.updater.start();
  await h.handlers['donda:update-check'](h.trusted);
  h.auto.emit('error', Error('Cannot find latest.yml in the latest release artifacts (https://github.com/x/releases/download/v1.2.1/latest.yml): HttpError: 404 "method: GET"\n headers…'));
  assert.equal(h.updater.state.status, 'error');
  assert.match(h.updater.state.error, /ainda não está completa/);
  assert.ok(h.updater.state.error.length < 120);
  assert.throws(() => h.handlers['donda:update-state']({ sender: 'other' }), /Origem inválida/);
});

test('friendly errors and plain release notes', () => {
  assert.match(friendlyError(Error('getaddrinfo ENOTFOUND github.com')), /Sem conexão/);
  assert.match(friendlyError(Error('sha512 checksum mismatch')), /corrompido/);
  assert.equal(friendlyError(Error('Algo inesperado\nstack')), 'Algo inesperado');
  assert.equal(plainNotes('<h2>1.3.0</h2><ul><li>Atualizações &amp; correções</li></ul>'), '1.3.0\nAtualizações & correções');
  assert.equal(plainNotes([{ note: 'A' }, { note: 'B' }]), 'A\nB');
});
