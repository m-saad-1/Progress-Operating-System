// Shared renderer global types.
// Keep desktopAPI as an alias of electronAPI for runtime-swappable desktop wrappers.

export {}

declare global {
	interface Window {
		desktopAPI: any
	}
}
