import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/source-serif-4/400.css';
import '@fontsource/source-serif-4/600.css';
import './tokens.css';
import './styles.css';

if (import.meta.env.DEV && !window.api) {
  // Opened directly in a browser tab (not the Electron control window, which always has a real
  // window.api from preload) — install sample data so the UI can be previewed without packaging.
  const { installDevApiMock } = await import('./devApiMock');
  installDevApiMock();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
