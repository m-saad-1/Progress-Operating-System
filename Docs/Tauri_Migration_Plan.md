# Tauri Migration Plan

## 1. Current Architecture
The current application is an Electron-based desktop application utilizing a robust main-process backend and a React/Vite-based frontend (Renderer).
- **Main Process (Node.js/Electron)**: Handles IPC communication, local database management (`better-sqlite3`), filesystem operations, system dialogs, auto-updates (`electron-updater`), window management, sync logic, and feedback functionality (`nodemailer`).
- **Renderer Process (React/TypeScript)**: Built with React 18, Tailwind CSS, Zustand for state management, and Radix UI primitives. It communicates with the main process strictly through a secure `preload.ts` script exposing an `electronAPI` (and aliased as `desktopAPI`).
- **Bridge/Preload**: Exposes granular methods (e.g., `executeQuery`, `showSaveDialog`, `submitFeedback`) instead of raw IPC access, providing a solid foundation for migration since the UI code is largely decoupled from Electron APIs.

## 2. Electron Dependencies
### Direct Dependencies
- `electron` (v28.2.0)
- `electron-builder`
- `electron-updater`
- `electron-squirrel-startup`

### Build / Tooling Dependencies
- `@electron-forge/*` (cli, maker-deb, maker-rpm, maker-squirrel, maker-zip, plugin-auto-unpack-natives, plugin-fuses, plugin-webpack, publisher-github)
- `@electron/rebuild`

### Third-Party Native / Node Dependencies (Requiring Rust Equivalents)
- `better-sqlite3`: Native SQLite binding for Node.js. Must be replaced with Tauri's SQL plugin or custom Rust `rusqlite` logic.
- `nodemailer`: Used in the main process for feedback/emails. Must be replaced with a Rust mailer crate (e.g., `lettre`) or handled via an external API.

## 3. API Usage Categorization (Migration Targets)
The following Electron-specific code/APIs have been identified primarily in `main/src/*` and exposed via `main/src/preload.ts`:

- **Window Management**: `BrowserWindow` (minimize, maximize, close, create windows). -> *Tauri `window` API / `AppHandle`*
- **IPC Communication**: `ipcMain`, `ipcRenderer`, `contextBridge`. -> *Tauri Commands (`#[tauri::command]`) and Event system (`emit`, `listen`).*
- **File System**: App paths (`app.getPath`), export/import handling. -> *Tauri `fs` and `path` APIs.*
- **Dialogs**: `dialog.showOpenDialog`, `dialog.showSaveDialog`. -> *Tauri `dialog` API.*
- **Notifications**: Electron `Notification`. -> *Tauri `notification` API.*
- **External Links**: `shell.openExternal`. -> *Tauri `shell` plugin.*
- **Auto Updates**: `electron-updater`. -> *Tauri Updater plugin.*
- **Menus**: `Menu`. -> *Tauri `menu` API.*
- **Tray**: `Tray`. -> *Tauri `tray` API.*
- **Storage/DB**: `better-sqlite3` operations (query, insert, update, transactions). -> *Tauri SQL plugin / Rust `rusqlite`.*

## 4. Code That Can Remain Unchanged
The frontend is already abstracted effectively through `window.electronAPI`/`window.desktopAPI`.
- **UI Framework**: React, Radix UI components, Recharts, Lucide icons.
- **Styling**: Tailwind CSS, PostCSS.
- **State Management**: Zustand, React Query.
- **Business Logic**: Renderer-side hooks, utility functions, components, routing (React Router).

## 5. Migration Complexity & Potential Risks
### Complexity: **High**
The migration requires completely rewriting the Node.js main process in Rust, which contains significant business logic for database and file management.
### Risks:
- **Database Compatibility**: Moving from `better-sqlite3` to `rusqlite` or the Tauri SQL plugin may introduce subtle differences in how queries are executed or how transactions are handled.
- **Sync/Backup Logic**: Custom logic written in Node.js for syncing (`sync/index.ts`) and backups (`main/src/backup/index.ts`) will need to be ported accurately to Rust, requiring careful type mappings.
- **Nodemailer Replacement**: Replacing `nodemailer` with a Rust crate might require SMTP configuration tweaks or SSL/TLS adjustments.
- **Native Module Hassle**: While removing `better-sqlite3` eliminates Node native compilation issues, adding Rust crates will require testing across all target OS platforms (Windows, macOS, Linux) to ensure seamless cross-compilation.

## 6. Recommended Migration Order
1. **Setup Tauri scaffolding**: Initialize Tauri in the existing repository alongside Electron, configuring Vite/Webpack to serve the React app to Tauri.
2. **Abstract Preload Script**: Update `desktopAPI` in the frontend to detect the environment and route calls either to Electron's `ipcRenderer` or Tauri's `invoke`. This allows dual-booting both versions during the migration.
3. **Migrate Core System & Window APIs**: Port window controls (minimize, close), path resolution, and external links to Rust commands.
4. **Migrate Database Layer**: Port the `better-sqlite3` logic to Rust (using `rusqlite`). This is the most critical phase.
5. **Migrate Dialogs & File System**: Port backup, import/export, and file selection dialogs.
6. **Migrate Sync & Feedback**: Port the Node.js `sync` service and `nodemailer` functionality to Rust crates.
7. **Migrate Menus, Tray & Updater**: Implement native OS features and the Tauri updater plugin.
8. **Testing & Parity Check**: Ensure both Electron and Tauri builds function identically and all React Query hooks successfully communicate with Rust.
9. **Deprecate & Remove Electron**: Remove `electron`, `@electron-forge`, `better-sqlite3`, and `main/` Node scripts.
