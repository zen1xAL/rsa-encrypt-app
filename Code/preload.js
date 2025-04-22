// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
 
  calculateEncrypt: (args) => ipcRenderer.invoke('rsa:calculate-encrypt', args),

  decrypt: (args) => ipcRenderer.invoke('rsa:decrypt', args),

  saveEncryptedFile: (data, defaultName) => ipcRenderer.invoke('dialog:saveEncryptedFile', data, defaultName),

  saveDecryptedFile: (base64Data, defaultName) => ipcRenderer.invoke('dialog:saveDecryptedFile', base64Data, defaultName)
});