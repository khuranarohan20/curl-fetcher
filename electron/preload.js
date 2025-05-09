// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  sendCurl: (curl) => ipcRenderer.send("submit-curl", curl),
  onLog: (callback) => ipcRenderer.on("log", (_, msg) => callback(msg)),
});
