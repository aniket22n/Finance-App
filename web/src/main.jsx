import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './theme.css';
import './components/components.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from './components/Toast.jsx';

// Apply persisted theme before first paint to avoid a flash of the wrong palette.
document.documentElement.setAttribute(
  'data-theme',
  localStorage.getItem('theme.isDark') === 'true' ? 'dark' : 'light'
);
document.documentElement.setAttribute(
  'data-primary',
  localStorage.getItem('theme.primaryTheme') || 'coral'
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
