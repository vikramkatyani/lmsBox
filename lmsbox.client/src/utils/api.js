import axios from 'axios';
import rateLimit from 'axios-rate-limit';
import { getAuthToken } from './auth';

// Create an axios instance with conditional rate limiting
const baseApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE,
});

// Only apply rate limiting in production
const api = import.meta.env.DEV 
  ? baseApi 
  : rateLimit(baseApi, {
      maxRequests: 20, // Reasonable limit for production
      perMilliseconds: 60000, // Per 1 minute
    });

// Attach Authorization header if token exists
api.interceptors.request.use((config) => {
  const token = getAuthToken?.();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Check for rate limiting errors
    if (error.response?.status === 429 || error.message?.includes('rate limit')) {
      console.warn('🚫 Rate limit exceeded:', error.message);
    }
    
    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401) {
      console.error('🔐 Unauthorized access - 401 response received');
      console.error('Request URL:', error.config?.url);
      console.error('Response data:', error.response?.data);
      
      // Import auth utilities dynamically to avoid circular imports
      import('./auth').then(({ removeAuthToken }) => {
        // Clear the token
        removeAuthToken();
        
        // Clear all stored data
        localStorage.clear();
        sessionStorage.clear();
        
        // Redirect to login page
        window.location.href = '/login';
      });
    }
    
    return Promise.reject(error);
  }
);

export default api;