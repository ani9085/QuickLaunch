// Tauri 환경에서만 window.api 를 정의 (Electron 빌드에는 영향 없음)
(function () {
  if (!window.__TAURI_INTERNALS__ || !window.__TAURI__) return;
  const { invoke } = window.__TAURI__.core;

  // "Ctrl+Shift+S" → SendKeys "^+s"
  function comboToSendKeys(combo) {
    if (!combo) return "";
    const parts = combo.split("+").map((p) => p.trim());
    let prefix = "";
    const special = {
      enter: "{ENTER}", tab: "{TAB}", esc: "{ESC}", escape: "{ESC}", space: " ",
      backspace: "{BACKSPACE}", delete: "{DELETE}", del: "{DELETE}", home: "{HOME}",
      end: "{END}", pageup: "{PGUP}", pagedown: "{PGDN}", up: "{UP}", down: "{DOWN}",
      left: "{LEFT}", right: "{RIGHT}", insert: "{INSERT}",
      f1: "{F1}", f2: "{F2}", f3: "{F3}", f4: "{F4}", f5: "{F5}", f6: "{F6}",
      f7: "{F7}", f8: "{F8}", f9: "{F9}", f10: "{F10}", f11: "{F11}", f12: "{F12}",
      printscreen: "{PRTSC}",
    };
    let key = "";
    for (const part of parts) {
      const low = part.toLowerCase();
      if (low === "ctrl" || low === "control") prefix += "^";
      else if (low === "alt") prefix += "%";
      else if (low === "shift") prefix += "+";
      else if (["win", "windows", "cmd"].includes(low)) {
        /* SendKeys는 Win 키 미지원 */
      } else if (special[low]) key += special[low];
      else key += part.replace(/[+^%~(){}]/g, "{$&}").toLowerCase();
    }
    return prefix + key;
  }

  window.api = {
    loadData: async () => {
      const s = await invoke("load_data");
      return s ? JSON.parse(s) : null;
    },
    saveData: (data) => invoke("save_data", { data: JSON.stringify(data, null, 2) }),
    run: async (item) => {
      try {
        if (item.type === "hotkey")
          await invoke("send_keys", { keys: comboToSendKeys(item.target) });
        else await invoke("run_action", { kind: item.type, target: item.target });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    },
    pickPath: (mode) => invoke("pick_path", { mode }),
    exportSave: (jsonString) => invoke("export_save", { json: jsonString }),
    importOpen: () => invoke("import_open"),
    hideWindow: () => invoke("hide_window"),
    quitApp: () => invoke("quit_app"),
    registerHotkey: (accel) =>
      invoke("set_global_hotkey", { accel })
        .then(() => ({ ok: true }))
        .catch((e) => ({ ok: false, error: String(e) })),
    resizeWindow: (w, h) => invoke("resize_window", { w, h }),
    fetchUrl: (url) => invoke("fetch_url", { url }),
    checkUpdate: () =>
      invoke("check_update")
        .then(() => ({ ok: true }))
        .catch((e) => ({ ok: false, error: String(e) })),
    onUpdateStatus: (cb) => {
      const { listen } = window.__TAURI__.event;
      listen("update://status", (e) => {
        const d = e.payload || {};
        try {
          cb(d);
        } catch (_) {}
        if (d.state === "downloaded") {
          if (confirm("업데이트가 준비되었습니다 (v" + (d.version || "") + "). 지금 재시작할까요?")) {
            invoke("restart_app");
          }
        }
      });
    },
  };
})();
