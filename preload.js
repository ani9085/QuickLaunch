const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  loadData: () => ipcRenderer.invoke("data:load"),
  saveData: (data) => ipcRenderer.invoke("data:save", data),
  run: (item) => ipcRenderer.invoke("action:run", item),
  pickPath: (mode) => ipcRenderer.invoke("dialog:pick", mode),
  exportSave: (jsonString) => ipcRenderer.invoke("export:save", jsonString),
  importOpen: () => ipcRenderer.invoke("import:open"),
  resizeWindow: (w, h) => ipcRenderer.invoke("window:resize", w, h),
  fetchUrl: (url) => ipcRenderer.invoke("net:fetch", url),
  checkUpdate: () => ipcRenderer.invoke("update:check"),
  onUpdateStatus: (cb) => ipcRenderer.on("update:status", (_e, data) => cb(data)),
  hideWindow: () => ipcRenderer.invoke("window:hide"),
  quitApp: () => ipcRenderer.invoke("window:quit"),
  registerHotkey: (accel) => ipcRenderer.invoke("hotkey:register", accel),
});
