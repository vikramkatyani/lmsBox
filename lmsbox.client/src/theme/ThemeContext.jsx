import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import tenants from './tenants.json';
import '../styles/tenants/bifa-theme.css';
import api from '../utils/api';
import { getTenantCodeFromPath } from '../utils/tenant';

const ThemeContext = createContext();

const DEFAULT_THEME = {
  key: 'default',
  name: tenants.default?.name || 'LMS Box',
  logo: tenants.default?.logo || '/assets/lmsbox-logo.png',
  primaryColor: tenants.default?.primaryColor || '#1b365d',
  secondaryColor: tenants.default?.secondaryColor,
  accentColor: tenants.default?.accentColor,
  accentStrongColor: tenants.default?.accentStrongColor,
  pageBackgroundColor: '#F5F5EF',
  buttonColor: '#2afeae',
  buttonTextColor: '#1b365d',
  fontFamily: tenants.default?.fontFamily,
  faviconUrl: tenants.default?.logo || '/assets/lmsbox-logo.png',
  loginHeroUrl: '',
  customCss: '',
  code: null,
  isDefault: true,
  hasCustomTheme: false,
  loginPath: '/login'
};

function staticThemeForKey(key) {
  const preset = tenants[key];
  if (!preset) {
    return { ...DEFAULT_THEME };
  }

  return {
    ...DEFAULT_THEME,
    key,
    name: preset.name,
    logo: preset.logo || DEFAULT_THEME.logo,
    primaryColor: preset.primaryColor || DEFAULT_THEME.primaryColor,
    secondaryColor: preset.secondaryColor,
    accentColor: preset.accentColor,
    accentStrongColor: preset.accentStrongColor,
    fontFamily: preset.fontFamily,
    faviconUrl: preset.logo || DEFAULT_THEME.faviconUrl,
    isDefault: key === 'default',
    hasCustomTheme: key !== 'default',
    code: key === 'default' ? null : key,
    loginPath: key === 'default' ? '/login' : `/t/${key}/login`
  };
}

function brandingToTheme(branding, fallbackKey = 'default') {
  if (!branding || branding.isDefault && !branding.code) {
    return staticThemeForKey(fallbackKey);
  }

  const key = branding.code || fallbackKey;
  const preset = tenants[key] || tenants.default;
  return {
    key,
    name: branding.brandName || branding.name || preset?.name || DEFAULT_THEME.name,
    logo: branding.logoUrl || preset?.logo || DEFAULT_THEME.logo,
    primaryColor: branding.primaryColor || preset?.primaryColor || DEFAULT_THEME.primaryColor,
    secondaryColor: branding.secondaryColor || preset?.secondaryColor,
    accentColor: branding.accentColor || preset?.accentColor,
    accentStrongColor: branding.accentStrongColor || preset?.accentStrongColor,
    pageBackgroundColor: branding.pageBackgroundColor || DEFAULT_THEME.pageBackgroundColor,
    buttonColor: branding.buttonColor || branding.accentColor || DEFAULT_THEME.buttonColor,
    buttonTextColor: branding.buttonTextColor || DEFAULT_THEME.buttonTextColor,
    fontFamily: branding.fontFamily || preset?.fontFamily,
    faviconUrl: branding.faviconUrl || branding.logoUrl || DEFAULT_THEME.faviconUrl,
    loginHeroUrl: branding.loginHeroUrl || '',
    customCss: branding.customCss || '',
    code: branding.code || null,
    isDefault: !!branding.isDefault,
    hasCustomTheme: !!branding.hasCustomTheme,
    loginPath: branding.loginPath || (branding.code ? `/t/${branding.code}/login` : '/login')
  };
}

function sanitizeCustomCss(css) {
  if (!css) return '';
  return css.replace(/<\/style/gi, '').replace(/<script/gi, '');
}

function applyFavicon(href) {
  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href || '/favicon.ico';
}

function applyTenantToDocument(theme) {
  const root = document.documentElement;
  root.setAttribute('data-tenant', theme.key || 'default');
  root.style.setProperty('--tenant-primary', theme.primaryColor || DEFAULT_THEME.primaryColor);
  root.style.setProperty('--color-login-page-bg', theme.pageBackgroundColor || DEFAULT_THEME.pageBackgroundColor);
  root.style.setProperty('--color-login-box-bg', theme.primaryColor || DEFAULT_THEME.primaryColor);
  root.style.setProperty('--color-login-btn-bg', theme.buttonColor || DEFAULT_THEME.buttonColor);
  root.style.setProperty('--color-login-btn-text', theme.buttonTextColor || DEFAULT_THEME.buttonTextColor);

  if (theme.secondaryColor) {
    root.style.setProperty('--tenant-secondary', theme.secondaryColor);
  } else {
    root.style.removeProperty('--tenant-secondary');
  }
  if (theme.accentColor) {
    root.style.setProperty('--tenant-accent', theme.accentColor);
  } else {
    root.style.removeProperty('--tenant-accent');
  }
  if (theme.accentStrongColor) {
    root.style.setProperty('--tenant-accent-strong', theme.accentStrongColor);
  } else {
    root.style.removeProperty('--tenant-accent-strong');
  }
  if (theme.fontFamily) {
    root.style.setProperty('--tenant-font', theme.fontFamily);
  } else {
    root.style.removeProperty('--tenant-font');
  }

  applyFavicon(theme.faviconUrl);

  const styleId = 'tenant-custom-css';
  let styleEl = document.getElementById(styleId);
  const css = sanitizeCustomCss(theme.customCss);
  if (css) {
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = css;
  } else if (styleEl) {
    styleEl.remove();
  }
}

function ensureTenantFont(theme) {
  const family = (theme.fontFamily || '').toLowerCase();
  const needsPoppins = theme.key === 'bifa' || family.includes('poppins');
  const needsInter = family.includes('inter');

  const addFont = (id, href) => {
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  };

  if (needsPoppins) {
    addFont(
      'tenant-font-poppins',
      'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap'
    );
  }
  if (needsInter) {
    addFont(
      'tenant-font-inter',
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
    );
  }
}

applyTenantToDocument(DEFAULT_THEME);

export function ThemeProvider({ children }) {
  const location = useLocation();
  const pathCode = getTenantCodeFromPath(location.pathname);
  const [theme, setTheme] = useState(() => (pathCode && tenants[pathCode] ? staticThemeForKey(pathCode) : DEFAULT_THEME));
  const [loading, setLoading] = useState(true);
  const [unknownTenant, setUnknownTenant] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setUnknownTenant(false);
      try {
        if (pathCode) {
          try {
            const response = await api.get(`/api/public/tenants/${encodeURIComponent(pathCode)}/branding`);
            if (!cancelled) {
              setTheme(brandingToTheme(response.data, pathCode));
            }
          } catch (error) {
            if (error.response?.status === 404) {
              if (!cancelled) {
                setUnknownTenant(true);
                setTheme(DEFAULT_THEME);
              }
            } else if (!cancelled) {
              setTheme(tenants[pathCode] ? staticThemeForKey(pathCode) : DEFAULT_THEME);
            }
          }
        } else {
          const response = await api.get('/api/public/branding');
          if (!cancelled) {
            setTheme(brandingToTheme(response.data));
          }
        }
      } catch {
        if (!cancelled) {
          setTheme(pathCode && tenants[pathCode] ? staticThemeForKey(pathCode) : DEFAULT_THEME);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [pathCode]);

  useEffect(() => {
    applyTenantToDocument(theme);
    ensureTenantFont(theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      ...theme,
      loading,
      unknownTenant,
      tenantCode: pathCode || theme.code || null
    }),
    [theme, loading, unknownTenant, pathCode]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
