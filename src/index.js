// src/index.js

import React from 'react';
import ReactDOM from 'react-dom/client';
import { Buffer } from 'buffer';
import App from './App';
import { AppProvider } from './context/AppContext';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

// --- Подключение новых стилей ---
import './styles/global.css';
import './styles/layout.css';
import './styles/home.css';
import './styles/case.css';
import './styles/upgrade.css';
import './styles/inventory.css';
import './styles/history.css';
import './styles/modals.css';
import './styles/admin.css';
import './styles/leaders.css';

// Старый файл можно удалить
// import './style.css';

window.Buffer = Buffer;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl="https://easydrop-stars-1.onrender.com/tonconnect-manifest.json">
      <AppProvider>
        <App />
      </AppProvider>
    </TonConnectUIProvider>
  </React.StrictMode>
);
