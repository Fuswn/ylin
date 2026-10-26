// lib.rs - Tauri application builder and command handlers
// @author Fusw

mod file_ops;

use file_ops::{read_dir_one_level, FileNode};
use rfd::{AsyncFileDialog, AsyncMessageDialog, MessageButtons, MessageDialogResult, MessageLevel};
use std::fs;
use std::path::Path;
use std::sync::Mutex;

// ---- File dialog commands (async to avoid blocking) ----

#[tauri::command]
async fn dialog_open_file() -> Option<String> {
    let file = AsyncFileDialog::new()
        .set_title("打开 Markdown 文件")
        .add_filter("Markdown", &["md", "markdown"])
        .pick_file()
        .await?;
    Some(file.path().to_string_lossy().to_string())
}

#[tauri::command]
async fn dialog_open_folder() -> Option<String> {
    let folder = AsyncFileDialog::new()
        .set_title("打开文件夹")
        .pick_folder()
        .await?;
    Some(folder.path().to_string_lossy().to_string())
}

#[tauri::command]
async fn dialog_save_md(default_name: String) -> Option<String> {
    let mut dlg = AsyncFileDialog::new()
        .set_title("另存为")
        .add_filter("Markdown", &["md"]);
    if !default_name.is_empty() {
        dlg = dlg.set_file_name(&default_name);
    }
    let file = dlg.save_file().await?;
    Some(file.path().to_string_lossy().to_string())
}

#[tauri::command]
async fn dialog_save_html(default_name: String) -> Option<String> {
    let mut dlg = AsyncFileDialog::new()
        .set_title("导出 HTML")
        .add_filter("HTML", &["html"]);
    if !default_name.is_empty() {
        dlg = dlg.set_file_name(&default_name);
    }
    let file = dlg.save_file().await?;
    Some(file.path().to_string_lossy().to_string())
}

// ---- Message dialogs ----
// WKWebView (macOS) ignores window.alert() and makes window.confirm() always return false,
// so the frontend uses these native dialogs on every platform instead.

#[tauri::command]
async fn dialog_message(window: tauri::WebviewWindow, message: String) {
    AsyncMessageDialog::new()
        .set_parent(&window)
        .set_title("ylin")
        .set_description(&message)
        .set_buttons(MessageButtons::OkCustom("确定".to_string()))
        .show()
        .await;
}

#[tauri::command]
async fn dialog_confirm(window: tauri::WebviewWindow, message: String) -> bool {
    let ok = "确定".to_string();
    let result = AsyncMessageDialog::new()
        .set_parent(&window)
        .set_level(MessageLevel::Warning)
        .set_title("ylin")
        .set_description(&message)
        .set_buttons(MessageButtons::OkCancelCustom(ok.clone(), "取消".to_string()))
        .show()
        .await;
    // macOS reports custom buttons by label; Windows falls back to a plain OK/Cancel MessageBox
    result == MessageDialogResult::Ok || result == MessageDialogResult::Custom(ok)
}

// ---- File system commands ----

/// Save PDF dialog
#[tauri::command]
async fn dialog_save_pdf(default_name: String) -> Option<String> {
    let mut dlg = AsyncFileDialog::new()
        .set_title("导出 PDF")
        .add_filter("PDF", &["pdf"]);
    if !default_name.is_empty() {
        dlg = dlg.set_file_name(&default_name);
    }
    let file = dlg.save_file().await?;
    Some(file.path().to_string_lossy().to_string())
}

/// Find a Chromium-based browser for headless PDF generation
fn find_browser() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let paths = [
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        ];
        for p in &paths {
            if Path::new(p).exists() {
                return Some(p.to_string());
            }
        }
    }
    #[cfg(target_os = "macos")]
    {
        let paths = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ];
        for p in &paths {
            if Path::new(p).exists() {
                return Some(p.to_string());
            }
        }
    }
    #[cfg(target_os = "linux")]
    {
        let names = ["google-chrome", "chromium-browser", "chromium", "microsoft-edge"];
        for name in &names {
            if std::process::Command::new("which").arg(name).output()
                .map(|o| o.status.success()).unwrap_or(false) {
                return Some(name.to_string());
            }
        }
    }
    None
}

/// Export HTML to PDF using headless Chromium (Edge/Chrome)
#[tauri::command]
fn export_pdf(html: String, output_path: String) -> Result<(), String> {
    let browser = find_browser()
        .ok_or("未找到 Edge 或 Chrome 浏览器，无法导出 PDF")?;

    // Write HTML to temp file
    let tmp_dir = std::env::temp_dir();
    let tmp_html = tmp_dir.join("ylin_export_temp.html");
    fs::write(&tmp_html, html.as_bytes())
        .map_err(|e| format!("写入临时文件失败: {}", e))?;

    let input_url = format!("file:///{}", tmp_html.to_string_lossy().replace('\\', "/"));

    // Run headless browser to generate PDF
    let result = std::process::Command::new(&browser)
        .arg("--headless")
        .arg("--disable-gpu")
        .arg("--no-pdf-header-footer")
        .arg(format!("--print-to-pdf={}", output_path))
        .arg(&input_url)
        .output()
        .map_err(|e| format!("启动浏览器失败: {}", e))?;

    // Clean up temp file
    let _ = fs::remove_file(&tmp_html);

    // Check if PDF was actually created
    if Path::new(&output_path).exists() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&result.stderr);
        Err(format!("PDF 生成失败: {}", stderr))
    }
}

#[tauri::command]
fn read_dir_tree(path: String) -> Result<Vec<FileNode>, String> {
    let root = Path::new(&path);
    if !root.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !root.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }
    Ok(read_dir_one_level(root))
}

#[tauri::command]
fn read_md_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn write_md_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, &content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
fn get_drives() -> Vec<String> {
    let mut drives = Vec::new();
    #[cfg(target_os = "windows")]
    {
        for letter in b'A'..=b'Z' {
            let drive = format!("{}:\\", letter as char);
            if Path::new(&drive).exists() {
                drives.push(drive);
            }
        }
    }
    #[cfg(target_os = "macos")]
    {
        // Home folder, startup disk, then other mounted volumes
        if let Some(home) = std::env::var_os("HOME") {
            drives.push(home.to_string_lossy().to_string());
        }
        drives.push("/".to_string());
        if let Ok(entries) = fs::read_dir("/Volumes") {
            let mut volumes: Vec<String> = entries
                .filter_map(|e| e.ok())
                // Skip the "Macintosh HD" symlink to "/". Uses the entry type from /Volumes so
                // removable volumes aren't touched (that would trigger a privacy prompt).
                .filter(|e| e.file_type().is_ok_and(|t| t.is_dir()))
                .filter(|e| !e.file_name().to_string_lossy().starts_with('.'))
                .map(|e| e.path().to_string_lossy().to_string())
                .collect();
            volumes.sort();
            drives.extend(volumes);
        }
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        drives.push("/".to_string());
    }
    drives
}

#[tauri::command]
fn get_parent_dir(path: String) -> Option<String> {
    Path::new(&path)
        .parent()
        .map(|p| p.to_string_lossy().to_string())
}

// ---- Files opened by the OS (double-click / "Open With") ----

/// File the OS asked us to open that the frontend hasn't loaded yet
struct PendingFile(Mutex<Option<String>>);

fn is_markdown_file(path: &Path) -> bool {
    path.is_file()
        && path.extension().is_some_and(|ext| {
            ext.eq_ignore_ascii_case("md") || ext.eq_ignore_ascii_case("markdown")
        })
}

/// Return the file path passed via CLI args (e.g. when double-clicking a .md file on Windows)
fn get_cli_file_path() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    // args[0] is the executable, args[1..] are passed arguments
    for arg in args.iter().skip(1) {
        // Skip flags
        if arg.starts_with('-') {
            continue;
        }
        if is_markdown_file(Path::new(arg)) {
            return Some(arg.clone());
        }
    }
    None
}

/// macOS hands files opened from Finder to the app as Apple Events instead of CLI args.
/// They can arrive before the frontend has loaded or while it is running, so queue the
/// file and notify the frontend, which picks it up via `take_pending_file`.
#[cfg(target_os = "macos")]
fn open_from_finder(app: &tauri::AppHandle, urls: Vec<tauri::Url>) {
    use tauri::{Emitter, Manager};

    let path = urls
        .iter()
        .filter_map(|url| url.to_file_path().ok())
        .find(|path| is_markdown_file(path));
    if let Some(path) = path {
        *app.state::<PendingFile>().0.lock().unwrap() = Some(path.to_string_lossy().to_string());
        let _ = app.emit("open-file", ());
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }
}

/// Hand the pending file (if any) to the frontend, exactly once
#[tauri::command]
fn take_pending_file(state: tauri::State<PendingFile>) -> Option<String> {
    state.0.lock().unwrap().take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(PendingFile(Mutex::new(get_cli_file_path())))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            dialog_open_file,
            dialog_open_folder,
            dialog_save_md,
            dialog_save_html,
            dialog_save_pdf,
            dialog_message,
            dialog_confirm,
            export_pdf,
            read_dir_tree,
            read_md_file,
            write_md_file,
            get_drives,
            get_parent_dir,
            take_pending_file,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(
            #[allow(unused_variables)]
            |app_handle, event| {
                #[cfg(target_os = "macos")]
                if let tauri::RunEvent::Opened { urls } = event {
                    open_from_finder(app_handle, urls);
                }
            },
        );
}
