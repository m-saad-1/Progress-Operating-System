const fs = require('fs');

// Fix App.tsx
let appContent = fs.readFileSync('src/App.tsx', 'utf-8');
appContent = appContent.replace(/const runtimeApi = \(window as any\)\.desktopAPI \|\| \(window as any\)\.electronAPI;/g, 'const runtimeApi = (window as any).__TAURI_INTERNALS__;');
appContent = appContent.replace(/!runtimeApi\.invoke/g, 'false /* tauri has invoke */');
appContent = appContent.replace(/runtimeApi\.invoke/g, 'invoke');
if (!appContent.includes('@tauri-apps/api/core')) {
    appContent = "import { invoke } from '@tauri-apps/api/core';\n" + appContent;
}
fs.writeFileSync('src/App.tsx', appContent);

// Fix store/index.ts
let storeContent = fs.readFileSync('src/store/index.ts', 'utf-8');
storeContent = storeContent.replace(/const api = window\.electronAPI as Partial<SettingsSnapshotApi> \| undefined/g, 'const api = { invoke } as any;');
if (!storeContent.includes('@tauri-apps/api/core')) {
    storeContent = "import { invoke } from '@tauri-apps/api/core';\n" + storeContent;
}
fs.writeFileSync('src/store/index.ts', storeContent);

// Fix use-app-runtime.ts
let runtimeContent = fs.readFileSync('src/hooks/use-app-runtime.ts', 'utf-8');
runtimeContent = runtimeContent.replace(/if \(window\.electronAPI\?\.getIconPath\) \{[\s\S]*?\}/g, 'try { iconPath = await invoke("get_icon_path") as string; } catch (e) {}');
runtimeContent = runtimeContent.replace(/if \(window\.electronAPI\?\.showNotification\) \{[\s\S]*?\} else \{/g, `
      if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
        sendNotification({ title, body: message });
      } else {
`);
runtimeContent = runtimeContent.replace(/if \(window\.electronAPI\?\.invoke\) \{/g, 'if (true) {');
runtimeContent = runtimeContent.replace(/window\.electronAPI\.invoke/g, 'invoke');
if (!runtimeContent.includes('@tauri-apps/api/core')) {
    runtimeContent = "import { invoke } from '@tauri-apps/api/core';\nimport { sendNotification } from '@tauri-apps/plugin-notification';\n" + runtimeContent;
}
fs.writeFileSync('src/hooks/use-app-runtime.ts', runtimeContent);
