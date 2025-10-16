// index.tsx / main.tsx
// 1) Полифиллы — первыми!
import { Buffer } from 'buffer';
(globalThis as any).Buffer = Buffer;

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './context/AppContext';
import './style.css';
import { TonConnectUIProvider } from '@tonconnect/ui-react';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

const root = ReactDOM.createRoot(rootEl);

root.render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl="https://easydrop-stars-1.onrender.com/tonconnect-manifest.json">
      <AppProvider>
        <App />
      </AppProvider>
    </TonConnectUIProvider>
  </React.StrictMode>
);
