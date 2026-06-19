import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { initPromise } from './i18n';

// When a new PWA build deploys, the old JS may try to lazy-load chunks that no
// longer exist on the server (emptyOutDir clears old hashes). Vite fires this
// event when a dynamic import() fails; reloading picks up the new index.html.
globalThis.addEventListener('vite:preloadError', () => {
  globalThis.location.reload();
});

// Await i18n before mounting to avoid a Suspense null-render (FOUC) on first paint.
void initPromise.finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
