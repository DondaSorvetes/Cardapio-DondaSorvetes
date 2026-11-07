const { contextBridge, ipcRenderer } = require('electron');

// Only narrow print IPC is exposed. No filesystem, shell or generic IPC access.
// Origem confiável vem do processo principal (policy.cjs → additionalArguments).
const trustedOrigin = (process.argv.find(arg => arg.startsWith('--donda-origin=')) || '').slice('--donda-origin='.length);
if (trustedOrigin && location.origin === trustedOrigin && (location.pathname === '/admin' || location.pathname.startsWith('/admin/'))) {
  contextBridge.exposeInMainWorld('dondaDesktop', {
    version: '1.2.2',
    getPrinters: () => ipcRenderer.invoke('donda:printers'),
    selectPrinter: name => ipcRenderer.invoke('donda:select-printer', name),
    openWindowsPrinters: () => ipcRenderer.invoke('donda:windows-printers'),
    print: () => ipcRenderer.invoke('donda:print'),
    updates: {
      getState: () => ipcRenderer.invoke('donda:update-state'),
      check: () => ipcRenderer.invoke('donda:update-check'),
      install: () => ipcRenderer.invoke('donda:update-install'),
      onStatus: callback => {
        const listener = (_event, state) => callback(state);
        ipcRenderer.on('donda:update-status', listener);
        return () => ipcRenderer.removeListener('donda:update-status', listener);
      },
    },
  });
  contextBridge.executeInMainWorld({ func: () => {
    try {
      if (localStorage.getItem('donda-auto-print-device') === null) {
        localStorage.setItem('donda-auto-print-device', '1');
        window.dispatchEvent(new Event('donda-auto-print-device-change'));
      }
    } catch { /* The panel shows device storage failures normally. */ }
    // Compatible with the already deployed panel: keeps the receipt mounted until spooler callback.
    window.print = () => {
      window.dondaDesktop.print().then(() => {
        window.dispatchEvent(new Event('afterprint'));
      }).catch(error => {
        window.dispatchEvent(new CustomEvent('donda:print-error', { detail: String(error.message || error) }));
        window.dispatchEvent(new Event('afterprint'));
      });
    };
  } });
}
