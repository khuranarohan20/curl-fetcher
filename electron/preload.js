const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  sendCurl: (curl) => ipcRenderer.send("curl", curl),
  onLog: (callback) => ipcRenderer.on("log", (_, message) => callback(message)),
});
