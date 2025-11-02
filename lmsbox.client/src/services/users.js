import api from '../utils/api';

// Users service: manage users, group assignments
// Backend endpoints:
// GET /api/admin/users?search=... -> { items: [{ id, firstName, lastName, email, groupCount, status }] }
// GET /api/admin/users/:id -> { id, firstName, lastName, email, groupIds: [], role, status }
// POST /api/admin/users -> { id }
// PUT /api/admin/users/:id -> success
// DELETE /api/admin/users/:id -> success

export async function listUsers(search = '') {
  const q = (search || '').trim();
  const url = `/api/admin/users${q ? `?search=${encodeURIComponent(q)}` : ''}`;
  try {
    const response = await api.get(url);
    const data = response.data;
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    return items;
  } catch (error) {
    console.error('Failed to fetch users:', error);
    
    // Preserve the original error response for better error handling
    if (error.response) {
      // Server responded with error status
      const errorData = error.response.data;
      const message = errorData?.message || 'Failed to fetch users';
      const enhancedError = new Error(message);
      enhancedError.response = error.response;
      throw enhancedError;
    } else if (error.request) {
      // Network error
      throw new Error('Network error. Please check your connection and try again.');
    } else {
      // Something else happened
      throw new Error(error.message || 'Failed to fetch users');
    }
  }
}

export async function getUser(userId) {
  try {
    const response = await api.get(`/api/admin/users/${encodeURIComponent(userId)}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    
    // Preserve the original error response for better error handling
    if (error.response) {
      // Server responded with error status
      const errorData = error.response.data;
      const message = errorData?.message || 'Failed to fetch user';
      const enhancedError = new Error(message);
      enhancedError.response = error.response;
      throw enhancedError;
    } else if (error.request) {
      // Network error
      throw new Error('Network error. Please check your connection and try again.');
    } else {
      // Something else happened
      throw new Error(error.message || 'Failed to fetch user');
    }
  }
}

export async function saveUser(user, isEdit = false) {
  try {
    if (isEdit) {
      const response = await api.put(`/api/admin/users/${user.id}`, {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      });
      return response.data;
    } else {
      const response = await api.post('/api/admin/users', {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role || 'Learner'
      });
      return response.data;
    }
  } catch (error) {
    console.error('Failed to save user:', error);
    
    // Don't modify the error, just throw it as-is so the component can handle it
    throw error;
  }
}

export async function deleteUser(userId) {
  try {
    const response = await api.delete(`/api/admin/users/${encodeURIComponent(userId)}`);
    return response.data;
  } catch (error) {
    console.error('Failed to delete user:', error);
    
    // Preserve the original error response for better error handling
    if (error.response) {
      // Server responded with error status
      const errorData = error.response.data;
      const message = errorData?.message || 'Failed to delete user';
      const enhancedError = new Error(message);
      enhancedError.response = error.response;
      throw enhancedError;
    } else if (error.request) {
      // Network error
      throw new Error('Network error. Please check your connection and try again.');
    } else {
      // Something else happened
      throw new Error(error.message || 'Failed to delete user');
    }
  }
}
