import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // REMOVE './theme.css' if it is here. Only index.css should be imported.

import { setupCommandManager } from '@/lib/undo';
import { setupSyncManager } from '@/lib/sync';

// Setup managers
setupCommandManager();
setupSyncManager();

// Global error handling
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);