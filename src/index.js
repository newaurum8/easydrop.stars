import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './context/AppContext';
import './style.css';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

// --- ИСПРАВЛЕНИЕ ОШИБКИ ---
// Полифилл, который создает объект Buffer в браузере,
// необходимый для работы крипто-библиотек TON.
import { Buffer } from 'buffer';
window.Buffer = Buffer;
// --------------------------

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* Оборачиваем все приложение в провайдер TON Connect */}
    <TonConnectUIProvider manifestUrl="https://easydrop-stars-1.onrender.com/tonconnect-manifest.json">
      <AppProvider>
        <App />
      </AppProvider>
    </TonConnectUIProvider>
  </React.StrictMode>
);
