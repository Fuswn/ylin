// file_ops.rs - File system operations and directory traversal
// @author Fusw

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

/// Read ONE level of a directory: only immediate children
/// Returns directories + .md files, sorted (dirs first, then alphabetical)
pub fn read_dir_one_level(dir: &Path) -> Vec<FileNode> {
    let mut nodes: Vec<FileNode> = Vec::new();

    let mut entries: Vec<_> = match fs::read_dir(dir) {
        Ok(rd) => rd.filter_map(|e| e.ok()).collect(),
        Err(_) => return nodes,
    };

    entries.sort_by(|a, b| {
        let a_is_dir = a.path().is_dir();
        let b_is_dir = b.path().is_dir();
        if a_is_dir != b_is_dir {
            return if a_is_dir {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            };
        }
        a.file_name()
            .to_string_lossy()
            .to_lowercase()
            .cmp(&b.file_name().to_string_lossy().to_lowercase())
    });

    for entry in entries {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/dirs
        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            nodes.push(FileNode {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: true,
            });
        } else if let Some(ext) = path.extension() {
            if ext.eq_ignore_ascii_case("md") || ext.eq_ignore_ascii_case("markdown") {
                nodes.push(FileNode {
                    name,
                    path: path.to_string_lossy().to_string(),
                    is_dir: false,
                });
            }
        }
    }

    nodes
}
