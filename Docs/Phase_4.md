Replace all Electron APIs with their Tauri equivalents.

Migrate the following:

- IPC
- File System
- Dialogs
- Notifications
- Shell / External URLs
- Clipboard
- Window APIs
- Process APIs

Requirements:

- Use official Tauri plugins whenever possible.
- Remove Electron imports.
- Refactor code to use Tauri's invoke() and plugin APIs.
- Keep the frontend behavior identical.
- Do not change business logic.
- Do not redesign the UI.
- Ensure all functionality works exactly as before.