import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated } from '../utils/auth';

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const auth = isAuthenticated();

  console.log('🛡️ ProtectedRoute check:', {
    path: location.pathname,
    isAuthenticated: auth,
    timestamp: new Date().toISOString()
  });

  if (!auth) {
    console.warn('⚠️ Not authenticated, redirecting to login from:', location.pathname);
    return <Navigate to="/login" replace />;
  }

  console.log('✅ Protected route access granted for:', location.pathname);
  return children;
}