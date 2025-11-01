import { useState, useEffect } from 'react';
import { getAuthToken } from '../utils/auth';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getAuthToken());

  useEffect(() => {
    // Check authentication status when component mounts
    const checkAuth = () => {
      const token = getAuthToken();
      setIsAuthenticated(!!token);
    };

    checkAuth();

    // Set up interval to check token expiration
    const interval = setInterval(checkAuth, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  return { isAuthenticated };
}