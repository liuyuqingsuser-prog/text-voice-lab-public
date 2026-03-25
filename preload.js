const { contextBridge, ipcRenderer, clipboard } = require("electron");

contextBridge.exposeInMainWorld("desktopBridge", {
  synthesizeSpeech(payload) {
    return ipcRenderer.invoke("synthesize-speech", payload);
  },
  saveTextFile(payload) {
    return ipcRenderer.invoke("save-text-file", payload);
  },
  saveAudioFile(payload) {
    return ipcRenderer.invoke("save-audio-file", payload);
  },
  getLegalDocument(key) {
    return ipcRenderer.invoke("get-legal-document", key);
  },
  copyText(content) {
    clipboard.writeText(String(content || ""));
    return true;
  },
});
