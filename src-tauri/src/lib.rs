use std::fs;
use std::path::PathBuf;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[cfg(windows)]
#[link(name = "shell32")]
unsafe extern "system" {
    fn ShellExecuteW(
        hwnd: *mut std::ffi::c_void,
        lp_operation: *const u16,
        lp_file: *const u16,
        lp_parameters: *const u16,
        lp_directory: *const u16,
        n_show_cmd: i32,
    ) -> isize;
}

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

// Windows 환경변수(%USERPROFILE% 등)는 열기 전에 한 번 확장한다.
fn expand_percent_vars(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut rest = input;

    while let Some(start) = rest.find('%') {
        out.push_str(&rest[..start]);
        let after_start = &rest[start + 1..];

        if let Some(end) = after_start.find('%') {
            let key = &after_start[..end];
            if key.is_empty() {
                out.push_str("%%");
            } else if let Ok(value) = std::env::var(key) {
                out.push_str(&value);
            } else {
                out.push('%');
                out.push_str(key);
                out.push('%');
            }
            rest = &after_start[end + 1..];
        } else {
            out.push_str(&rest[start..]);
            rest = "";
            break;
        }
    }

    out.push_str(rest);
    out
}

fn normalize_target(target: String) -> Result<String, String> {
    let trimmed = target.trim();
    if trimmed.is_empty() {
        return Err("target is empty".to_string());
    }

    Ok(expand_percent_vars(trimmed))
}

fn normalize_url(target: String) -> Result<String, String> {
    let trimmed = target.trim();
    if trimmed.is_empty() {
        return Err("target is empty".to_string());
    }

    let lower = trimmed.to_ascii_lowercase();
    if lower.starts_with("http://") || lower.starts_with("https://") || lower == "ms-screenclip:"
    {
        Ok(trimmed.to_string())
    } else if lower.contains(':') {
        Err("unsupported URL protocol".to_string())
    } else {
        Ok(format!("https://{}", trimmed))
    }
}

fn is_apps_folder_target(target: &str) -> bool {
    target.to_ascii_lowercase().starts_with("shell:appsfolder\\")
}

fn validate_apps_folder_target(target: &str) -> Result<(), String> {
    let app_id = target
        .split_once('\\')
        .map(|(_, app_id)| app_id)
        .unwrap_or("");

    if app_id.is_empty() {
        return Err("Windows app ID is empty".to_string());
    }

    if app_id
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-' | '!'))
    {
        Ok(())
    } else {
        Err("unsupported Windows app ID".to_string())
    }
}

#[cfg(windows)]
fn open_apps_folder_target(target: &str) -> Result<(), String> {
    validate_apps_folder_target(target)?;

    let mut c = std::process::Command::new("explorer.exe");
    c.arg(target);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(CREATE_NO_WINDOW);
    }
    c.spawn().map(|_| ()).map_err(|e| e.to_string())
}

#[cfg(not(windows))]
fn open_apps_folder_target(_target: &str) -> Result<(), String> {
    Err("Windows app IDs are only supported on Windows".to_string())
}

#[cfg(windows)]
fn open_target(target: &str) -> Result<(), String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    fn wide(value: &str) -> Vec<u16> {
        OsStr::new(value).encode_wide().chain(Some(0)).collect()
    }

    let operation = wide("open");
    let file = wide(target);
    let result = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            operation.as_ptr(),
            file.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            1,
        )
    };

    if result <= 32 {
        Err(format!("open failed: {}", result))
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
fn open_target(target: &str) -> Result<(), String> {
    std::process::Command::new("xdg-open")
        .arg(target)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn run_action(kind: String, target: String) -> Result<(), String> {
    match kind.as_str() {
        "app" | "file" | "folder" => {
            let target = normalize_target(target)?;
            if is_apps_folder_target(&target) {
                open_apps_folder_target(&target)
            } else {
                open_target(&target)
            }
        }
        "url" => open_target(&normalize_url(target)?),
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

// 단축키 표기 문자열을 Tauri Shortcut 형식으로 정규화
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
        .invoke_handler(tauri::generate_handler![
            load_data,
            save_data,
            run_action,
            send_keys,
            pick_path,
            export_save,
            import_open,
            resize_window,
            hide_window,
            quit_app,
            set_global_hotkey
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
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
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
