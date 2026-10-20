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

registerSW({ immediate: true });

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
