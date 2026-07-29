mod migrations;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

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
