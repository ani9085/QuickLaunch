use std::fs;
use std::path::PathBuf;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};
use tauri_plugin_updater::UpdaterExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn data_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let dir = app.path().app_config_dir().ok()?;
    let _ = fs::create_dir_all(&dir);
    Some(dir.join("quicklaunch-data.json"))
}

#[tauri::command]
fn load_data(app: tauri::AppHandle) -> Option<String> {
    let p = data_path(&app)?;
    fs::read_to_string(p).ok()
}

#[tauri::command]
fn save_data(app: tauri::AppHandle, data: String) -> Result<(), String> {
    let p = data_path(&app).ok_or("config dir 없음")?;
    fs::write(p, data).map_err(|e| e.to_string())
}

// cmd /C 로 명령 실행 (콘솔 창 숨김)
fn run_cmd(args: &[&str]) -> Result<(), String> {
    let mut c = std::process::Command::new("cmd");
    c.arg("/C");
    for a in args {
        c.arg(a);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(CREATE_NO_WINDOW);
    }
    c.spawn().map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
fn run_action(kind: String, target: String) -> Result<(), String> {
    match kind.as_str() {
        "app" | "file" | "folder" => run_cmd(&["start", "", &target]),
        "url" => {
            let url = if target.starts_with("http://")
                || target.starts_with("https://")
                || target.contains(':')
            {
                target
            } else {
                format!("https://{}", target)
            };
            run_cmd(&["start", "", &url])
        }
        "command" => run_cmd(&[&target]),
        other => Err(format!("알 수 없는 타입: {}", other)),
    }
}

// PowerShell SendKeys 로 키 전송 (keys 는 이미 SendKeys 형식)
#[tauri::command]
fn send_keys(keys: String) -> Result<(), String> {
    let escaped = keys.replace('\'', "''");
    let ps = format!(
        "Add-Type -AssemblyName System.Windows.Forms; Start-Sleep -Milliseconds 250; [System.Windows.Forms.SendKeys]::SendWait('{}')",
        escaped
    );
    let mut c = std::process::Command::new("powershell.exe");
    c.args(["-NoProfile", "-Command", &ps]);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(CREATE_NO_WINDOW);
    }
    c.spawn().map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
fn pick_path(mode: String) -> Option<String> {
    let dlg = rfd::FileDialog::new();
    let res = if mode == "folder" {
        dlg.pick_folder()
    } else {
        dlg.pick_file()
    };
    res.map(|p| p.to_string_lossy().to_string())
}

#[derive(serde::Serialize)]
struct ExportRes {
    ok: bool,
    path: Option<String>,
    canceled: bool,
    error: Option<String>,
}

#[tauri::command]
fn export_save(json: String) -> ExportRes {
    let file = rfd::FileDialog::new()
        .set_file_name("quicklaunch-profile.json")
        .add_filter("QuickLaunch Profile", &["json"])
        .save_file();
    match file {
        None => ExportRes { ok: false, path: None, canceled: true, error: None },
        Some(p) => match fs::write(&p, json) {
            Ok(_) => ExportRes {
                ok: true,
                path: Some(p.to_string_lossy().to_string()),
                canceled: false,
                error: None,
            },
            Err(e) => ExportRes { ok: false, path: None, canceled: false, error: Some(e.to_string()) },
        },
    }
}

#[derive(serde::Serialize)]
struct ImportRes {
    ok: bool,
    data: Option<String>,
    canceled: bool,
    error: Option<String>,
}

#[tauri::command]
fn import_open() -> ImportRes {
    let file = rfd::FileDialog::new()
        .add_filter("QuickLaunch Profile", &["json"])
        .pick_file();
    match file {
        None => ImportRes { ok: false, data: None, canceled: true, error: None },
        Some(p) => match fs::read_to_string(&p) {
            Ok(s) => ImportRes { ok: true, data: Some(s), canceled: false, error: None },
            Err(e) => ImportRes { ok: false, data: None, canceled: false, error: Some(e.to_string()) },
        },
    }
}

#[derive(serde::Serialize)]
struct FetchRes {
    ok: bool,
    status: u16,
    body: String,
    error: Option<String>,
}

#[tauri::command]
fn fetch_url(url: String) -> FetchRes {
    match ureq::get(&url).call() {
        Ok(resp) => {
            let status = resp.status();
            let body = resp.into_string().unwrap_or_default();
            FetchRes { ok: status >= 200 && status < 300, status, body, error: None }
        }
        Err(ureq::Error::Status(code, resp)) => FetchRes {
            ok: false,
            status: code,
            body: resp.into_string().unwrap_or_default(),
            error: Some(format!("HTTP {}", code)),
        },
        Err(e) => FetchRes { ok: false, status: 0, body: String::new(), error: Some(e.to_string()) },
    }
}

// 콘텐츠(웹뷰) 영역 크기로 창 리사이즈 — 프레임 두께를 보정해 inner=요청크기 가 되도록
#[tauri::command]
fn resize_window(window: tauri::WebviewWindow, w: f64, h: f64) {
    let scale = window.scale_factor().unwrap_or(1.0);
    let inner = window.inner_size().ok();
    let outer = window.outer_size().ok();
    let (dx, dy) = match (inner, outer) {
        (Some(i), Some(o)) => (o.width as f64 - i.width as f64, o.height as f64 - i.height as f64),
        _ => (0.0, 0.0),
    };
    let tw = (w * scale + dx).max(300.0).round() as u32;
    let th = (h * scale + dy).max(280.0).round() as u32;
    let _ = window.set_size(tauri::PhysicalSize::new(tw, th));
}

#[tauri::command]
fn hide_window(window: tauri::WebviewWindow) {
    let _ = window.hide();
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

// Electron accelerator → Tauri Shortcut 문자열
fn normalize_accel(accel: &str) -> String {
    accel
        .replace("CommandOrControl", "Control")
        .replace("CmdOrCtrl", "Control")
        .replace("Command", "Control")
        .replace("Cmd", "Control")
        .replace("Ctrl", "Control")
}

fn toggle_main(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let visible = win.is_visible().unwrap_or(false);
        let focused = win.is_focused().unwrap_or(false);
        if visible && focused {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

#[tauri::command]
fn set_global_hotkey(app: tauri::AppHandle, accel: String) -> Result<(), String> {
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();
    if accel.is_empty() {
        return Ok(());
    }
    let norm = normalize_accel(&accel);
    let sc: Shortcut = norm.parse().map_err(|_| format!("단축키 파싱 실패: {}", accel))?;
    gs.register(sc).map_err(|e| e.to_string())
}

// 업데이트 확인 → 있으면 다운로드+설치(프런트에 상태 emit). 재시작은 사용자 확인 후.
async fn run_update(app: tauri::AppHandle) {
    let updater = match app.updater() {
        Ok(u) => u,
        Err(e) => {
            let _ = app.emit("update://status", serde_json::json!({"state":"error","error": e.to_string()}));
            return;
        }
    };
    match updater.check().await {
        Ok(Some(update)) => {
            let version = update.version.clone();
            let _ = app.emit("update://status", serde_json::json!({"state":"available","version": version}));
            let downloaded = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
            let app2 = app.clone();
            let dl = downloaded.clone();
            let res = update
                .download_and_install(
                    move |chunk, total| {
                        let cur = dl.fetch_add(chunk as u64, std::sync::atomic::Ordering::Relaxed) + chunk as u64;
                        if let Some(t) = total {
                            let pct = ((cur as f64 / t as f64) * 100.0) as u64;
                            let _ = app2.emit("update://status", serde_json::json!({"state":"progress","percent": pct}));
                        }
                    },
                    || {},
                )
                .await;
            match res {
                Ok(_) => {
                    let _ = app.emit("update://status", serde_json::json!({"state":"downloaded","version": update.version}));
                }
                Err(e) => {
                    let _ = app.emit("update://status", serde_json::json!({"state":"error","error": e.to_string()}));
                }
            }
        }
        Ok(None) => {
            let _ = app.emit("update://status", serde_json::json!({"state":"none"}));
        }
        Err(e) => {
            let _ = app.emit("update://status", serde_json::json!({"state":"error","error": e.to_string()}));
        }
    }
}

#[tauri::command]
fn check_update(app: tauri::AppHandle) {
    tauri::async_runtime::spawn(run_update(app));
}

#[tauri::command]
fn restart_app(app: tauri::AppHandle) {
    app.restart();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        toggle_main(app);
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            load_data,
            save_data,
            run_action,
            send_keys,
            pick_path,
            export_save,
            import_open,
            fetch_url,
            resize_window,
            hide_window,
            quit_app,
            set_global_hotkey,
            check_update,
            restart_app
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // 트레이 메뉴
            let open_i = MenuItem::with_id(app, "open", "열기", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "종료", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_i, &quit_i])?;
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("QuickLaunch")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                })
                .build(app)?;

            // 시작 시 전역 단축키 등록 (저장값 또는 기본값)
            let accel = data_path(&handle)
                .and_then(|p| fs::read_to_string(p).ok())
                .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
                .and_then(|v| {
                    v.get("settings")
                        .and_then(|s| s.get("globalHotkey"))
                        .and_then(|h| h.as_str())
                        .map(|s| s.to_string())
                })
                .unwrap_or_else(|| "CommandOrControl+Shift+Space".to_string());
            let _ = set_global_hotkey(handle.clone(), accel);

            // 시작 시 자동 업데이트 확인
            let up_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                run_update(up_handle).await;
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            // 닫기 → 트레이로 숨김
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
