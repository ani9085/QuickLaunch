const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  globalShortcut,
  Tray,
  Menu,
  dialog,
  nativeImage,
  net,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn, exec } = require("child_process");

// 메뉴바 제거 (제목줄 아래 빈 줄 없앰)
Menu.setApplicationMenu(null);

const isDev = !app.isPackaged;
const DATA_FILE = path.join(app.getPath("userData"), "quicklaunch-data.json");

let mainWindow = null;
let tray = null;

/* ----------------------------- 데이터 저장/로드 ----------------------------- */
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("데이터 로드 실패:", e);
  }
  return null;
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
    return { ok: true };
  } catch (e) {
    console.error("데이터 저장 실패:", e);
    return { ok: false, error: e.message };
  }
}

/* -------------------------------- 자동 업데이트 -------------------------------- */
function setupAutoUpdate() {
  let autoUpdater;
  try {
    ({ autoUpdater } = require("electron-updater"));
  } catch (e) {
    console.error("electron-updater 로드 실패:", e.message);
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.on("update-available", (info) => {
    if (mainWindow) mainWindow.webContents.send("update:status", { state: "available", version: info.version });
  });
  autoUpdater.on("download-progress", (p) => {
    if (mainWindow) mainWindow.webContents.send("update:status", { state: "progress", percent: Math.round(p.percent) });
  });
  autoUpdater.on("update-downloaded", (info) => {
    if (mainWindow) mainWindow.webContents.send("update:status", { state: "downloaded", version: info.version });
    dialog
      .showMessageBox(mainWindow, {
        type: "info",
        buttons: ["지금 재시작", "나중에"],
        defaultId: 0,
        title: "업데이트 준비됨",
        message: `새 버전 ${info.version} 이(가) 다운로드되었습니다.`,
        detail: "지금 재시작하면 업데이트가 적용됩니다.",
      })
      .then((r) => {
        if (r.response === 0) {
          app.isQuitting = true;
          autoUpdater.quitAndInstall();
        }
      });
  });
  autoUpdater.on("error", (err) => console.error("자동 업데이트 오류:", err == null ? "unknown" : err.message));
  // 시작 후 잠시 뒤 확인 (네트워크/창 준비 여유)
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 4000);
}

// 렌더러에서 수동 업데이트 확인 요청
ipcMain.handle("update:check", () => {
  if (!app.isPackaged) return { ok: false, error: "개발 모드에서는 확인 불가" };
  try {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

/* -------------------------------- 윈도우 생성 -------------------------------- */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 560,
    height: 520,
    minWidth: 300,
    minHeight: 280,
    useContentSize: true,
    backgroundColor: "#15171c",
    autoHideMenuBar: true,
    title: "QuickLaunch",
    icon: path.join(__dirname, "src", "assets", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));

  mainWindow.on("close", (e) => {
    // 트레이로 최소화 (앱 종료 대신 숨김)
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

/* -------------------------------- 트레이 생성 -------------------------------- */
function createTray() {
  const iconPath = path.join(__dirname, "src", "assets", "tray.png");
  let trayIcon;
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath);
  } else {
    // 폴백: 빈 16x16 아이콘
    trayIcon = nativeImage.createEmpty();
  }
  tray = new Tray(trayIcon);
  tray.setToolTip("QuickLaunch");
  const menu = Menu.buildFromTemplate([
    { label: "열기", click: () => showWindow() },
    { type: "separator" },
    {
      label: "종료",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => showWindow());
}

function showWindow() {
  if (!mainWindow) createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function toggleWindow() {
  if (mainWindow && mainWindow.isVisible() && mainWindow.isFocused()) {
    mainWindow.hide();
  } else {
    showWindow();
  }
}

/* ------------------------- 키보드 단축키 SendKeys 변환 ------------------------- */
// "Ctrl+Shift+S" -> SendKeys "^+s" 형식으로 변환
function comboToSendKeys(combo) {
  if (!combo) return "";
  const parts = combo.split("+").map((p) => p.trim());
  let prefix = "";
  const special = {
    enter: "{ENTER}",
    tab: "{TAB}",
    esc: "{ESC}",
    escape: "{ESC}",
    space: " ",
    backspace: "{BACKSPACE}",
    delete: "{DELETE}",
    del: "{DELETE}",
    home: "{HOME}",
    end: "{END}",
    pageup: "{PGUP}",
    pagedown: "{PGDN}",
    up: "{UP}",
    down: "{DOWN}",
    left: "{LEFT}",
    right: "{RIGHT}",
    insert: "{INSERT}",
    f1: "{F1}", f2: "{F2}", f3: "{F3}", f4: "{F4}",
    f5: "{F5}", f6: "{F6}", f7: "{F7}", f8: "{F8}",
    f9: "{F9}", f10: "{F10}", f11: "{F11}", f12: "{F12}",
    printscreen: "{PRTSC}",
  };
  let key = "";
  for (const part of parts) {
    const low = part.toLowerCase();
    if (low === "ctrl" || low === "control") prefix += "^";
    else if (low === "alt") prefix += "%";
    else if (low === "shift") prefix += "+";
    else if (low === "win" || low === "windows" || low === "cmd") {
      // SendKeys는 Win 키 미지원 -> 무시(또는 별도 처리)
    } else if (special[low]) {
      key += special[low];
    } else {
      // 일반 문자: SendKeys 특수문자 이스케이프
      key += part.replace(/[+^%~(){}]/g, "{$&}").toLowerCase();
    }
  }
  return prefix + key;
}

/* --------------------------------- IPC 핸들러 --------------------------------- */
ipcMain.handle("data:load", () => loadData());
ipcMain.handle("data:save", (_e, data) => saveData(data));

ipcMain.handle("action:run", async (_e, item) => {
  try {
    switch (item.type) {
      case "app":
      case "file":
      case "folder": {
        const result = await shell.openPath(item.target);
        if (result) return { ok: false, error: result };
        return { ok: true };
      }
      case "url": {
        let url = item.target;
        if (!/^https?:\/\//i.test(url) && !/^[a-z]+:/i.test(url)) {
          url = "https://" + url;
        }
        await shell.openExternal(url);
        return { ok: true };
      }
      case "command": {
        // 임의 셸 명령 실행
        exec(item.target, { windowsHide: true }, (err) => {
          if (err) console.error("command 실행 오류:", err);
        });
        return { ok: true };
      }
      case "hotkey": {
        // PowerShell SendKeys로 키 입력 전송 (Windows)
        const keys = comboToSendKeys(item.target);
        if (!keys) return { ok: false, error: "빈 단축키" };
        const ps = `Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 250; [System.Windows.Forms.SendKeys]::SendWait('${keys.replace(
          /'/g,
          "''"
        )}')`;
        spawn("powershell.exe", ["-NoProfile", "-Command", ps], {
          windowsHide: true,
        });
        return { ok: true };
      }
      default:
        return { ok: false, error: "알 수 없는 타입: " + item.type };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// 파일/폴더/앱 경로 선택 다이얼로그
ipcMain.handle("dialog:pick", async (_e, mode) => {
  const props =
    mode === "folder" ? ["openDirectory"] : ["openFile"];
  const result = await dialog.showOpenDialog(mainWindow, { properties: props });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

// export: 저장 다이얼로그 후 파일 쓰기
ipcMain.handle("export:save", async (_e, jsonString) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "바로가기 내보내기",
    defaultPath: "quicklaunch-profile.json",
    filters: [{ name: "QuickLaunch Profile", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  try {
    fs.writeFileSync(result.filePath, jsonString, "utf-8");
    return { ok: true, path: result.filePath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// import: 열기 다이얼로그 후 파일 읽기
ipcMain.handle("import:open", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "바로가기 가져오기",
    properties: ["openFile"],
    filters: [{ name: "QuickLaunch Profile", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePaths.length)
    return { ok: false, canceled: true };
  try {
    const content = fs.readFileSync(result.filePaths[0], "utf-8");
    return { ok: true, data: content };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// 콘텐츠(웹뷰) 영역 크기로 창 리사이즈 — 레이아웃/모드 변경 시 호출
ipcMain.handle("window:resize", (_e, w, h) => {
  if (!mainWindow) return;
  const width = Math.max(300, Math.round(w));
  const height = Math.max(280, Math.round(h));
  mainWindow.setContentSize(width, height, false);
  return { ok: true };
});

// 원격 JSON 가져오기 (라이브러리/공지) — Electron net은 시스템 프록시를 따르므로 사내망에서 유리
ipcMain.handle("net:fetch", (_e, url) => {
  return new Promise((resolve) => {
    try {
      const req = net.request({ url, redirect: "follow" });
      let body = "";
      req.on("response", (res) => {
        res.on("data", (c) => (body += c.toString()));
        res.on("end", () =>
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            body,
          })
        );
      });
      req.on("error", (err) => resolve({ ok: false, error: err.message }));
      req.setHeader("Cache-Control", "no-cache");
      req.end();
    } catch (e) {
      resolve({ ok: false, error: e.message });
    }
  });
});

ipcMain.handle("window:hide", () => mainWindow && mainWindow.hide());
ipcMain.handle("window:quit", () => {
  app.isQuitting = true;
  app.quit();
});

// 전역 단축키 등록 (표시/숨김 토글)
ipcMain.handle("hotkey:register", (_e, accelerator) => {
  globalShortcut.unregisterAll();
  if (!accelerator) return { ok: true };
  try {
    const ok = globalShortcut.register(accelerator, () => toggleWindow());
    return { ok };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

/* --------------------------------- 앱 라이프사이클 --------------------------------- */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => showWindow());

  app.whenReady().then(() => {
    createWindow();
    createTray();

    // 기본 전역 단축키
    const saved = loadData();
    const accel =
      (saved && saved.settings && saved.settings.globalHotkey) ||
      "CommandOrControl+Shift+Space";
    try {
      globalShortcut.register(accel, () => toggleWindow());
    } catch (e) {
      console.error("전역 단축키 등록 실패:", e);
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    // 자동 업데이트 (GitHub Releases). 패키지 빌드에서만 동작.
    if (app.isPackaged) setupAutoUpdate();
  });

  app.on("window-all-closed", () => {
    // 트레이 상주이므로 종료하지 않음 (명시적 종료만)
  });

  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
  });
}
