import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // REMOVE './theme.css' if it is here. Only index.css should be imported.

import { setupCommandManager } from '@/lib/undo';
import { setupSyncManager } from '@/lib/sync';

console.log('[RENDERER] main.tsx - Starting renderer initialization');

// Setup managers
try {
  setupCommandManager();
  setupSyncManager();
  console.log('[RENDERER] main.tsx - Managers initialized');
} catch (error) {
  console.error('[RENDERER] main.tsx - Failed to initialize managers:', error);
}

// Global error handling
window.addEventListener('error', (event) => {
  console.error('[RENDERER] Global error:', event.error, event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[RENDERER] Unhandled promise rejection:', event.reason);
});

// Ensure root element exists
const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('[RENDERER] ERROR: root element not found in HTML');
  document.body.innerHTML = '<div style="color: red; padding: 20px;">Critical Error: Root element not found</div>';
  throw new Error('Root element not found');
}

console.log('[RENDERER] main.tsx - Root element found, mounting React');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

console.log('[RENDERER] main.tsx - React app mounted');