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

/// Write HTML to a temp file and open it in the default browser (for PDF printing)
#[tauri::command]
fn open_html_in_browser(html: String) -> Result<String, String> {
    let tmp_dir = std::env::temp_dir();
    let tmp_path = tmp_dir.join("md_editor_preview.html");
    fs::write(&tmp_path, &html).map_err(|e| format!("Failed to write temp file: {}", e))?;
    let path_str = tmp_path.to_string_lossy().to_string();
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &path_str])
            .spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("xdg-open")
            .arg(&path_str)
            .spawn()
            .map_err(|e| format!("Failed to open browser: {}", e))?;
    }
    Ok(path_str)
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
            open_html_in_browser,
            read_dir_tree,
            read_md_file,
            write_md_file,
            get_drives,
            get_parent_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
