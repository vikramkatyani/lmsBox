const TENANT_CODE_KEY = 'lmsbox.tenantCode';

export function getTenantCodeFromPath(pathname = window.location.pathname) {
  const match = pathname.match(/^\/t\/([^/]+)/i);
  return match ? decodeURIComponent(match[1]).toLowerCase() : null;
}

export function getStoredTenantCode() {
  try {
    const value = localStorage.getItem(TENANT_CODE_KEY);
    return value ? value.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function setStoredTenantCode(code) {
  try {
    if (code && String(code).trim()) {
      localStorage.setItem(TENANT_CODE_KEY, String(code).trim().toLowerCase());
    } else {
      localStorage.removeItem(TENANT_CODE_KEY);
    }
  } catch {
    // Ignore storage failures (private mode).
  }
}

export function tenantLoginPath(code) {
  return `/t/${encodeURIComponent(code)}/login`;
}

export function tenantVerifyPath(code) {
  return `/t/${encodeURIComponent(code)}/verify-login`;
}

export function tenantEmailNotRegisteredPath(code) {
  return `/t/${encodeURIComponent(code)}/auth/email-not-registered`;
}
