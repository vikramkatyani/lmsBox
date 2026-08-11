import React, { createContext, useContext, useEffect, useState } from 'react';
import tenants from './tenants.json';
import '../styles/tenants/bifa-theme.css';

const ThemeContext = createContext();

function getTenantKey() {
  const tenantKey = import.meta.env.VITE_APP_TENANT;
  if (tenantKey && tenants[tenantKey]) {
    return tenantKey;
  }

  const hostname = window.location.hostname;
  if (hostname.includes('bifa')) return 'bifa';
  if (hostname.includes('glc')) return 'glc';
  if (hostname.includes('acme')) return 'acme';
  if (hostname.includes('globex')) return 'globex';
  // Temporary default: BIFA brand guidelines theme
  return 'bifa';
}

function getTenantConfig() {
  const key = getTenantKey();
  return { key, ...tenants[key] };
}

function applyTenantToDocument(theme) {
  const root = document.documentElement;
  root.setAttribute('data-tenant', theme.key);
  root.style.setProperty('--tenant-primary', theme.primaryColor);

  if (theme.secondaryColor) {
    root.style.setProperty('--tenant-secondary', theme.secondaryColor);
  }
  if (theme.accentColor) {
    root.style.setProperty('--tenant-accent', theme.accentColor);
  }
  if (theme.accentStrongColor) {
    root.style.setProperty('--tenant-accent-strong', theme.accentStrongColor);
  }
}

function ensureTenantFont(theme) {
  if (theme.key !== 'bifa') return;

  const id = 'tenant-font-bifa';
  if (document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href =
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap';
  document.head.appendChild(link);
}

const initialTheme = getTenantConfig();
applyTenantToDocument(initialTheme);
ensureTenantFont(initialTheme);

export function ThemeProvider({ children }) {
  const [theme] = useState(initialTheme);

  useEffect(() => {
    applyTenantToDocument(theme);
    ensureTenantFont(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
