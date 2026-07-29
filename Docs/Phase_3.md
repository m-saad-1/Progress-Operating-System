Now clean the project by removing Electron-only dependencies.

Requirements:

- Remove Electron packages.
- Remove Electron Builder / Forge configuration.
- Remove preload scripts.
- Remove main process files that are no longer needed.
- Remove unused npm packages.
- Clean package.json.
- Preserve all React code.
- Ensure Tauri builds successfully afterward.

Do not replace Electron APIs yet.
If functionality depends on Electron APIs, leave clear TODO comments instead of breaking the application.