// Learner Courses service: fetch courses assigned to the current user
// Backend endpoints:
// GET /api/learner/courses?search=...&progress=... -> { items: [{ id, title, banner, progress, enrolledDate, lastAccessedDate, isCompleted, certificateEligible }], total }
// GET /api/learner/courses/certificates -> { items: [...], total }

import api from '../utils/api';

export async function getMyCourses(search = '', progressFilter = 'all', signal = null) {
  try {
  const res = await api.get('/api/learner/courses', {
      params: {
        ...(search?.trim() ? { search: search.trim() } : {}),
        ...(progressFilter && progressFilter !== 'all' ? { progress: progressFilter } : {}),
      },
      signal, // Pass abort signal to axios
    });
    const data = res.data;
    return Array.isArray(data?.items) ? data.items : [];
  } catch (err) {
    // Check if the error is due to request cancellation
    if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
      // Request was cancelled, don't treat as error
      return [];
    }
    
    // If it's a 401 error, the API interceptor will handle logout
    if (err.response?.status === 401) {
      console.warn('Authentication required - user will be redirected to login');
      return [];
    }
    
    console.error('Failed to fetch courses from API:', err.message);
    throw err; // Re-throw the error to be handled by the calling component
  }
}

export async function getMyCertificates(signal = null) {
  try {
    const res = await api.get('/api/learner/courses/certificates', {
      signal, // Pass abort signal to axios
    });
    const data = res.data;
    return Array.isArray(data?.items) ? data.items : [];
  } catch (err) {
    // Check if the error is due to request cancellation
    if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
      // Request was cancelled, don't treat as error
      return [];
    }
    
    // If it's a 401 error, the API interceptor will handle logout
    if (err.response?.status === 401) {
      console.warn('Authentication required - user will be redirected to login');
      return [];
    }
    
    console.error('Failed to fetch certificates from API:', err.message);
    throw err; // Re-throw the error to be handled by the calling component
  }
}
