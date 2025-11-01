import React, { createContext, useContext, useEffect, useState } from 'react';
import tenants from './tenants.json';

const ThemeContext = createContext();

function getTenantConfig() {
  const hostname = window.location.hostname;
  // Map hostname to tenant key
  if (hostname.includes('acme')) return tenants.acme;
  if (hostname.includes('globex')) return tenants.globex;
  return tenants.default;
}

export function ThemeProvider({ children }) {
  const [theme] = useState(getTenantConfig());

  useEffect(() => {
    // Set CSS variable for Tailwind
    document.documentElement.style.setProperty('--tenant-primary', theme.primaryColor);
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
