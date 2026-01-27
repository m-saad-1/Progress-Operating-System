import { app, protocol, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs-extra';
// import { mainWindow } from './index'; // Remove this line

export function setupProtocol(mainWindow: BrowserWindow) { // Added mainWindow argument
  // Register custom protocol for deep linking
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('progressos', process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient('progressos');
  }
  
  // Register file protocol for serving static files
  protocol.registerFileProtocol('app', (request, callback) => {
    const url = request.url.substring(6); // Remove 'app://'
    const filePath = path.join(app.getAppPath(), 'renderer', 'dist', url);
    callback({ path: filePath });
  });
}

export function handleDeepLink(mainWindow: BrowserWindow, url?: string) {
  if (!url) return;
  
  console.log('Deep link received:', url);
  
  // Parse the URL
  const parsedUrl = new URL(url);
  const action = parsedUrl.hostname;
  const params = new URLSearchParams(parsedUrl.search);
  
  // Handle different actions
  switch (action) {
    case 'goal':
      const goalId = params.get('id');
      if (goalId && mainWindow) {
        mainWindow.webContents.send('deep-link:goal', { goalId });
      }
      break;
      
    case 'task':
      const taskId = params.get('id');
      if (taskId && mainWindow) {
        mainWindow.webContents.send('deep-link:task', { taskId });
      }
      break;
      
    case 'note':
      const noteId = params.get('id');
      if (noteId && mainWindow) {
        mainWindow.webContents.send('deep-link:note', { noteId });
      }
      break;
      
    case 'sync':
      const code = params.get('code');
      if (code && mainWindow) {
        mainWindow.webContents.send('deep-link:sync', { code });
      }
      break;
      
    default:
      console.log('Unknown deep link action:', action);
  }
}

export function createDeepLink(action: string, params: Record<string, string>): string {
  const url = new URL(`progressos://${action}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
}

export function registerFileProtocols() {
  // Handle file:// protocol for local files
  protocol.registerFileProtocol('file', (request, callback) => {
    const pathname = request.url.replace('file:///', '');
    callback(pathname);
  });
}

// Create deep links for different entities
export const deepLinks = {
  goal: (id: string) => createDeepLink('goal', { id }),
  task: (id: string) => createDeepLink('task', { id }),
  note: (id: string) => createDeepLink('note', { id }),
  sync: (code: string) => createDeepLink('sync', { code }),
};