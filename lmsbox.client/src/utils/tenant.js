export function getTenantCodeFromPath(pathname = window.location.pathname) {
  const match = pathname.match(/^\/t\/([^/]+)/i);
  return match ? decodeURIComponent(match[1]).toLowerCase() : null;
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
