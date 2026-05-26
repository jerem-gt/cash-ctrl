import './i18n';
import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';

// When a new PWA build deploys, the old JS may try to lazy-load chunks that no
// longer exist on the server (emptyOutDir clears old hashes). Vite fires this
// event when a dynamic import() fails; reloading picks up the new index.html.
globalThis.addEventListener('vite:preloadError', () => {
  globalThis.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
