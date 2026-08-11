// Store token with expiration
export const setAuthToken = (token, expires) => {
  if (token) {
    localStorage.setItem('token', token);
    // Use provided expiration (Unix timestamp in milliseconds) or default to 8 hours from now
    const expiration = expires ? expires : new Date().getTime() + (8 * 60 * 60 * 1000);
    localStorage.setItem('tokenExpiration', expiration.toString());
  }
};

// Get token if not expired
export const getAuthToken = () => {
  const token = localStorage.getItem('token');
  const expiration = localStorage.getItem('tokenExpiration');
  
  console.log('🔍 getAuthToken called:', {
    hasToken: !!token,
    tokenLength: token?.length,
    tokenPreview: token?.substring(0, 20) + '...',
    expiration: expiration,
    localStorage: {
      token: !!localStorage.getItem('token'),
      expiration: localStorage.getItem('tokenExpiration')
    }
  });
  
  if (!token || !expiration) {
    console.log('❌ No token or expiration found');
    return null;
  }

  // Check if token is expired
  const now = new Date().getTime();
  const expirationTime = parseInt(expiration);
  
  console.log('🕐 Time check:', {
    now,
    expirationTime,
    nowDate: new Date(now).toISOString(),
    expirationDate: new Date(expirationTime).toISOString(),
    diff: expirationTime - now,
    diffMinutes: Math.floor((expirationTime - now) / 1000 / 60)
  });
  
  if (now > expirationTime) {
    console.log('❌ Token expired', { now, expirationTime, diff: now - expirationTime });
    removeAuthToken();
    return null;
  }

  const timeLeft = Math.floor((expirationTime - now) / 1000 / 60); // minutes
  console.log('✅ Token valid, expires in:', timeLeft, 'minutes');
  return token;
};

// Remove token and clean up
export const removeAuthToken = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('tokenExpiration');
};

// Check if user is authenticated
export const isAuthenticated = () => {
  return !!getAuthToken();
};

// Save last visited page
export const saveLastVisitedPage = (path) => {
  if (path !== '/login' && path !== '/verify-login') {
    localStorage.setItem('lastVisitedPage', path);
  }
};

// Get last visited page
export const getLastVisitedPage = () => {
  return localStorage.getItem('lastVisitedPage') || '/courses/all';
};

// Decode JWT token to get user info
export const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (_e) {
    return null;
  }
};

// Get user role from token
export const getUserRole = () => {
  const token = getAuthToken();
  if (!token) return null;
  const decoded = decodeToken(token);

  // Check for Microsoft claims format role
  const msRole = decoded?.['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
  if (msRole) {
    return Array.isArray(msRole) ? msRole[0] : msRole;
  }

  // Fallback to standard role claim
  return decoded?.role || 'learner';
};

/** All roles from JWT (supports single claim or array). */
export const getUserRoles = () => {
  const token = getAuthToken();
  if (!token) return [];
  const decoded = decodeToken(token);
  if (!decoded) return [];

  const roleClaim =
    decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ??
    decoded.role ??
    decoded['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role'];

  if (Array.isArray(roleClaim)) return roleClaim.filter(Boolean);
  if (roleClaim) return [roleClaim];
  return [];
};

// Check if user is admin
export const isAdmin = () => {
  const roles = getUserRoles();
  return roles.some((role) =>
    ['admin', 'Admin', 'OrgAdmin', 'TenantAdmin', 'SuperAdmin'].includes(role)
  );
};

export const getTenantId = () => {
  const token = getAuthToken();
  if (!token) return null;
  const decoded = decodeToken(token);
  const raw = decoded?.tenant_id ?? decoded?.TenantId;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

export const isTenantAdmin = () => getUserRoles().includes('TenantAdmin');
export const isOrgAdmin = () => getUserRoles().includes('OrgAdmin');
export const isSuperAdminRole = () => getUserRoles().includes('SuperAdmin');

// Get user name from token
export const getUserName = () => {
  const token = getAuthToken();
  if (!token) return null;
  const decoded = decodeToken(token);
  return decoded?.name || decoded?.email || 'User';
};

// Get user ID from token
export const getUserId = () => {
  const token = getAuthToken();
  if (!token) return null;
  const decoded = decodeToken(token);
  // Check for Microsoft claims format
  const msUserId = decoded?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
  if (msUserId) {
    return msUserId;
  }
  // Fallback to standard claims
  return decoded?.sub || decoded?.nameid || decoded?.userId || null;
};

// Clear last visited page
export const clearLastVisitedPage = () => {
  localStorage.removeItem('lastVisitedPage');
};