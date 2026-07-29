Your task is to analyze the entire Electron application and create a complete migration plan to Tauri.

Requirements:

- Analyze the entire project structure.
- Detect all Electron-specific code, dependencies, APIs, IPC communication, preload scripts, and native integrations.
- Identify every place where Electron APIs are used.
- Categorize them into:
  - Window management
  - IPC communication
  - File system
  - Dialogs
  - Notifications
  - External links
  - Auto updates
  - Menus
  - Tray
  - Storage
- Identify third-party packages that depend on Electron.
- Determine which code can remain unchanged (React, Tailwind, Zustand, components, business logic, etc.).
- Create a detailed migration checklist with priorities.
- DO NOT modify any code.
- DO NOT install anything.
- DO NOT remove Electron.
- Only analyze and produce a migration report.

The report should include:
1. Current architecture
2. Electron dependencies
3. Migration complexity
4. Potential risks
5. Recommended migration order