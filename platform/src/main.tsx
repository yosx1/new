import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { I18nProvider } from './i18n/I18n';
import { AuthProvider } from './auth/Auth';
import { FeedbackProvider } from './components/ui';
import { InstallPrompt } from './components/InstallPrompt';
import App from './App';
import './styles.css';

// New versions install in the background and reload the page (registerType: autoUpdate). An app that stays
// open — or is installed on a phone — also checks every 30 minutes and whenever it comes back to the screen.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => { if (navigator.onLine) reg.update().catch(() => {}); };
    setInterval(check, 30 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <FeedbackProvider>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
        <InstallPrompt />
      </FeedbackProvider>
    </I18nProvider>
  </React.StrictMode>,
);
