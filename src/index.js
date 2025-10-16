// src/index.js

// 1) Полифиллы — первыми!
import { Buffer } from 'buffer';
window.Buffer = Buffer; // Используем window для Create React App без TypeScript. 
                         // globalThis - более универсальный вариант.

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './context/AppContext';
import './style.css';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

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
