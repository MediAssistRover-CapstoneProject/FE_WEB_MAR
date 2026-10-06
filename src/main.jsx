import { injectStyles } from './styles/injectStyles.js';
const inlineStyles = String.raw`:root { --mar-primary: #2f80ff; --mar-surface: #ffffff; --mar-text: #0f172a; --mar-muted: #475569; --mar-border: #cbd5e1; --mar-radius: 6px; }
* { box-sizing: border-box; }
html { min-width: 320px; }
body { margin: 0; }
button, input { font: inherit; }
`;
injectStyles('mediassist-style-main-jsx', inlineStyles);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<StrictMode><BrowserRouter><App /></BrowserRouter></StrictMode>);
