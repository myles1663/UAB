/**
 * Preload script — exposes IPC channels to the renderer securely.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('uabInstaller', {
  checkRequirements: () => ipcRenderer.invoke('check-requirements'),
  installDaemon: () => ipcRenderer.invoke('install-daemon'),
  installExtension: () => ipcRenderer.invoke('install-extension'),
  detectSkillsDir: () => ipcRenderer.invoke('detect-skills-dir'),
  writeSkillFile: (locations) => ipcRenderer.invoke('write-skill-file', locations),
  configureMcp: () => ipcRenderer.invoke('configure-mcp'),
  verifyInstall: (skillFilePath) => ipcRenderer.invoke('verify-install', skillFilePath),
});
