const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  loadData: () => ipcRenderer.invoke("data:load"),
  saveData: (data) => ipcRenderer.invoke("data:save", data),
  run: (item) => ipcRenderer.invoke("action:run", item),
  pickPath: (mode) => ipcRenderer.invoke("dialog:pick", mode),
  exportSave: (jsonString) => ipcRenderer.invoke("export:save", jsonString),
  importOpen: () => ipcRenderer.invoke("import:open"),
  hideWindow: () => ipcRenderer.invoke("window:hide"),
  quitApp: () => ipcRenderer.invoke("window:quit"),
  registerHotkey: (accel) => ipcRenderer.invoke("hotkey:register", accel),
});
