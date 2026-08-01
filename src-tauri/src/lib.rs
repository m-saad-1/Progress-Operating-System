mod migrations;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[tauri::command]
async fn create_backup(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data.join("progress.db");
    let backups_dir = app_data.join("backups");
    
    std::fs::create_dir_all(&backups_dir).map_err(|e| e.to_string())?;
    
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let backup_name = format!("progress_backup_{}.db", timestamp);
    let backup_path = backups_dir.join(&backup_name);
    
    std::fs::copy(&db_path, &backup_path).map_err(|e| e.to_string())?;
    
    let metadata = std::fs::metadata(&backup_path).map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({
        "success": true,
        "backupId": backup_name,
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "size": metadata.len()
    }))
}

#[tauri::command]
async fn list_backups(app: tauri::AppHandle) -> Result<Vec<serde_json::Value>, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let backups_dir = app_data.join("backups");
    
    if !backups_dir.exists() {
        return Ok(vec![]);
    }
    
    let mut backups = vec![];
    let entries = std::fs::read_dir(backups_dir).map_err(|e| e.to_string())?;
    
    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() && path.extension().unwrap_or_default() == "db" {
                let name = entry.file_name().to_string_lossy().to_string();
                let metadata = std::fs::metadata(&path).map_err(|e| e.to_string())?;
                
                // Use file modification time for a consistent, valid ISO timestamp
                let modified = metadata.modified().unwrap_or(std::time::SystemTime::UNIX_EPOCH);
                let datetime: chrono::DateTime<chrono::Utc> = modified.into();
                let timestamp_str = datetime.to_rfc3339();
                
                backups.push(serde_json::json!({
                    "id": name,
                    "timestamp": timestamp_str,
                    "size": metadata.len(),
                    "path": path.to_string_lossy()
                }));
            }
        }
    }
    
    // Sort descending by timestamp
    backups.sort_by(|a, b| {
        let ts_a = a["timestamp"].as_str().unwrap_or("");
        let ts_b = b["timestamp"].as_str().unwrap_or("");
        ts_b.cmp(ts_a)
    });
    
    Ok(backups)
}

#[tauri::command]
async fn restore_backup(app: tauri::AppHandle, backup_id: String) -> Result<serde_json::Value, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_data.join("progress.db");
    let backup_path = app_data.join("backups").join(&backup_id);
    
    if !backup_path.exists() {
        return Err("Backup file not found".to_string());
    }
    
    // Create a backup of the current state just in case
    let current_timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let pre_restore_backup = app_data.join("backups").join(format!("progress_backup_prerestore_{}.db", current_timestamp));
    if db_path.exists() {
        std::fs::copy(&db_path, &pre_restore_backup).ok();
    }
    
    std::fs::copy(&backup_path, &db_path).map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn delete_backup(app: tauri::AppHandle, backup_id: String) -> Result<serde_json::Value, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let backup_path = app_data.join("backups").join(&backup_id);
    
    if backup_path.exists() {
        std::fs::remove_file(backup_path).map_err(|e| e.to_string())?;
    }
    
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn verify_backup(app: tauri::AppHandle, backup_id: String) -> Result<serde_json::Value, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let backup_path = app_data.join("backups").join(&backup_id);
    
    // Very basic verification (exists and > 0 bytes)
    let valid = backup_path.exists() && std::fs::metadata(&backup_path).map(|m| m.len() > 0).unwrap_or(false);
    
    Ok(serde_json::json!({ "valid": valid }))
}

#[tauri::command]
async fn import_backup_from_path(app: tauri::AppHandle, file_path: String) -> Result<serde_json::Value, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let backups_dir = app_data.join("backups");
    std::fs::create_dir_all(&backups_dir).map_err(|e| e.to_string())?;
    
    let path = std::path::Path::new(&file_path);
    if !path.exists() {
        return Err("Selected file does not exist".to_string());
    }
    
    // Rename to standard format to guarantee parsing in list_backups works
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let backup_name = format!("progress_backup_imported_{}.db", timestamp);
    let dest_path = backups_dir.join(&backup_name);
    
    std::fs::copy(path, &dest_path).map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({ "success": true, "backupId": backup_name }))
}

#[tauri::command]
async fn export_backup_to_path(app: tauri::AppHandle, backup_id: String, save_path: String) -> Result<serde_json::Value, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let source_path = app_data.join("backups").join(&backup_id);
    
    if !source_path.exists() {
        return Err("Backup file not found".to_string());
    }
    
    std::fs::copy(&source_path, std::path::Path::new(&save_path)).map_err(|e| e.to_string())?;
    
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
async fn get_backup_stats(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let backups_dir = app_data.join("backups");
    
    let mut total_size = 0;
    let mut total_count = 0;
    
    if backups_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(backups_dir) {
            for entry in entries.flatten() {
                if let Ok(meta) = entry.metadata() {
                    total_size += meta.len();
                    total_count += 1;
                }
            }
        }
    }
    
    Ok(serde_json::json!({
        "totalSize": total_size,
        "count": total_count,
        "lastBackup": null // could be calculated
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_window_state::Builder::default().build())
    .plugin(tauri_plugin_global_shortcut::Builder::default().build())
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations("sqlite:progress.db", migrations::get_migrations())
        .build(),
    )
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
        create_backup,
        list_backups,
        restore_backup,
        delete_backup,
        verify_backup,
        get_backup_stats,
        import_backup_from_path,
        export_backup_to_path
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      
      // Setup Native Menu (Standard defaults)
      if let Ok(menu) = Menu::default(app.handle()) {
          let _ = app.set_menu(menu);
      }

      // Setup System Tray
      let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
      let show_i = MenuItem::with_id(app, "show", "Show Progress OS", true, None::<&str>)?;
      let tray_menu = Menu::with_items(app, &[&show_i, &quit_i])?;

      let _tray = TrayIconBuilder::new()
          .menu(&tray_menu)
          .show_menu_on_left_click(false)
          .icon(app.default_window_icon().unwrap().clone())
          .on_menu_event(|app, event| match event.id.as_ref() {
              "quit" => {
                  std::process::exit(0);
              }
              "show" => {
                  if let Some(window) = app.get_webview_window("main") {
                      let _ = window.show();
                      let _ = window.set_focus();
                  }
              }
              _ => {}
          })
          .on_tray_icon_event(|tray, event| match event {
              TrayIconEvent::Click {
                  button: MouseButton::Left,
                  button_state: MouseButtonState::Up,
                  ..
              } => {
                  if let Some(window) = tray.app_handle().get_webview_window("main") {
                      let is_visible = window.is_visible().unwrap_or(false);
                      if is_visible {
                          let _ = window.hide();
                      } else {
                          let _ = window.show();
                          let _ = window.set_focus();
                      }
                  }
              }
              _ => {}
          })
          .build(app)?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
