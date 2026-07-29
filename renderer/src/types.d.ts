// Renderer global type declarations for Tauri 2.0
// window.electronAPI has been removed — all IPC goes through @tauri-apps/api/core invoke()

export {}

declare global {
  interface Window {
    // Tauri injects __TAURI_INTERNALS__ at runtime. Checking for this is the
    // canonical way to detect a Tauri environment in renderer code.
    __TAURI_INTERNALS__?: unknown
  }
}
