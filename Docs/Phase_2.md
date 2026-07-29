Initialize Tauri without breaking the existing Electron application.

Requirements:

- Install and configure Tauri.
- Create the src-tauri directory.
- Configure Tauri to run the existing React/Vite frontend.
- Do not remove Electron.
- Do not modify application logic.
- Ensure both Electron and Tauri can coexist temporarily.
- Configure development scripts for both runtimes.
- Verify the application launches successfully inside Tauri.

Do not migrate any Electron APIs yet.

The goal is simply to run the current frontend inside Tauri.