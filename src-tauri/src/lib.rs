// lib.rs - Tauri application builder and command handlers
// @author Fusw

mod file_ops;

use file_ops::{read_dir_one_level, FileNode};
use rfd::AsyncFileDialog;
use std::fs;
use std::path::Path;

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
    #[cfg(not(target_os = "windows"))]
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

/// Return the file path passed via CLI args (e.g. when double-clicking a .md file)
#[tauri::command]
fn get_cli_file_path() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    // args[0] is the executable, args[1..] are passed arguments
    for arg in args.iter().skip(1) {
        // Skip flags
        if arg.starts_with('-') {
            continue;
        }
        let p = Path::new(arg);
        if p.exists() && p.is_file() {
            if let Some(ext) = p.extension() {
                let ext_lower = ext.to_string_lossy().to_lowercase();
                if ext_lower == "md" || ext_lower == "markdown" {
                    return Some(p.to_string_lossy().to_string());
                }
            }
        }
    }
    None
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            export_pdf,
            read_dir_tree,
            read_md_file,
            write_md_file,
            get_drives,
            get_parent_dir,
            get_cli_file_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
