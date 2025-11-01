// Store token with expiration
export const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('token', token);
    // Set expiration to 8 hours from now
    const expiration = new Date().getTime() + (8 * 60 * 60 * 1000);
    localStorage.setItem('tokenExpiration', expiration.toString());
  }
};

// Get token if not expired
export const getAuthToken = () => {
  const token = localStorage.getItem('token');
  const expiration = localStorage.getItem('tokenExpiration');
  
  if (!token || !expiration) {
    return null;
  }

  // Check if token is expired
  if (new Date().getTime() > parseInt(expiration)) {
    removeAuthToken();
    return null;
  }

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
    return msRole;
  }
  
  // Fallback to standard role claim
  return decoded?.role || 'learner';
};

// Check if user is admin
export const isAdmin = () => {
  const role = getUserRole();
  // Check for various admin role formats
  return role === 'admin' || role === 'Admin' || role === 'OrgAdmin' || role === 'SuperAdmin';
};

// Get user name from token
export const getUserName = () => {
  const token = getAuthToken();
  if (!token) return null;
  const decoded = decodeToken(token);
  return decoded?.name || decoded?.email || 'User';
};

// Clear last visited page
export const clearLastVisitedPage = () => {
  localStorage.removeItem('lastVisitedPage');
};