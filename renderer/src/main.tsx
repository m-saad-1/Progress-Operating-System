import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './theme.css';

// Initialize store and other setup
import { setupCommandManager } from '@/lib/undo';
import { setupSyncManager } from '@/lib/sync';

// Setup command manager
setupCommandManager();

// Setup sync manager
setupSyncManager();

// Add global error handler
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
