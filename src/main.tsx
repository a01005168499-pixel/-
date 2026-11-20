import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// Safe Service Worker management
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  try {
    if (import.meta.env.PROD) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          ?.register('/sw.js', { scope: '/' })
          .then((reg) => {
            console.log('عالم الصوت: تم تفعيل وضع العمل بدون إنترنت بنجاح (Service Worker Ready)', reg.scope);
          })
          .catch((err) => {
            console.warn('Service Worker registration note:', err);
          });
      });
    } else {
      // In development mode, ensure any existing service workers don't intercept dev server scripts
      navigator.serviceWorker
        ?.getRegistrations()
        .then((registrations) => {
          for (const registration of registrations) {
            registration.unregister().catch(() => {});
          }
        })
        .catch(() => {});
    }
  } catch (err) {
    console.warn('ServiceWorker initialization skipped:', err);
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

