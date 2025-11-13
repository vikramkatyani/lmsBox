import api from '../utils/api';

// Users service: manage users, group assignments
// Backend endpoints:
// GET /api/admin/users?page=1&pageSize=20&search=...&status=...&sortBy=...&sortOrder=... -> { items: [...], pagination: {...} }
// GET /api/admin/users/:id -> { id, firstName, lastName, email, groupIds: [], role, status }
// POST /api/admin/users -> { id }
// PUT /api/admin/users/:id -> success
// DELETE /api/admin/users/:id -> success

export async function listUsers(params = {}) {
  const { page = 1, pageSize = 20, search = '', status, sortBy, sortOrder } = params;
  
  const queryParams = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  });
  
  if (search?.trim()) {
    queryParams.append('search', search.trim());
  }
  
  if (status) {
    queryParams.append('status', status);
  }
  
  if (sortBy) {
    queryParams.append('sortBy', sortBy);
  }
  
  if (sortOrder) {
    queryParams.append('sortOrder', sortOrder);
  }
  
  const url = `/api/admin/users?${queryParams.toString()}`;
  
  try {
    const response = await api.get(url);
    const data = response.data;
    
    // Return both items and pagination metadata
    return {
      items: Array.isArray(data?.items) ? data.items : [],
      pagination: data?.pagination || {
        currentPage: page,
        totalPages: 1,
        pageSize: pageSize,
        totalCount: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
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
    const payload = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role || (isEdit ? undefined : 'Learner'),
      groupIds: user.groupIds // Send learning pathway assignments
    };
    
    console.log(`📤 ${isEdit ? 'Updating' : 'Creating'} user:`, payload);
    
    if (isEdit) {
      const response = await api.put(`/api/admin/users/${user.id}`, payload);
      console.log('✅ User updated successfully:', response.data);
      return response.data;
    } else {
      const response = await api.post('/api/admin/users', payload);
      console.log('✅ User created successfully:', response.data);
      return response.data;
    }
  } catch (error) {
    console.error('❌ Failed to save user:', error);
    console.error('❌ Error response:', error.response?.data);
    console.error('❌ Error status:', error.response?.status);
    
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

export async function bulkCreateUsers({ emailsText, emails, groupIds }) {
  const payload = {
    EmailsText: emailsText,
    Emails: emails,
    GroupIds: groupIds
  };
  const res = await api.post('/api/admin/users/bulk', payload);
  return res.data;
}
