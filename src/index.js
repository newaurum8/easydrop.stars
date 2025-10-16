// src/index.js

// 1) Сначала ВСЕ импорты
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Buffer } from 'buffer';
import App from './App';
import { AppProvider } from './context/AppContext';
import './style.css';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

// 2) А уже потом остальная логика (полифиллы)
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
