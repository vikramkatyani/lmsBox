const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

// Authentication
export const superAdminLogin = async (email, password) => {
  const response = await fetch(`${API_BASE}/api/SuperAdmin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }
  
  return response.json();
};

// Organisations
export const getOrganisations = async () => {
  const response = await fetch(`${API_BASE}/api/SuperAdmin/organisations`, {
    headers: getAuthHeaders()
  });
  
  if (!response.ok) throw new Error('Failed to fetch organisations');
  return response.json();
};

export const getOrganisation = async (id) => {
  const response = await fetch(`${API_BASE}/api/SuperAdmin/organisations/${id}`, {
    headers: getAuthHeaders()
  });
  
  if (!response.ok) throw new Error('Failed to fetch organisation');
  return response.json();
};

export const createOrganisation = async (orgData) => {
  const response = await fetch(`${API_BASE}/api/SuperAdmin/organisations`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(orgData)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create organisation');
  }
  
  return response.json();
};

export const updateOrganisation = async (id, orgData) => {
  const response = await fetch(`${API_BASE}/api/SuperAdmin/organisations/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ ...orgData, id })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update organisation');
  }
  
  return response.json();
};

export const createOrgAdmin = async (orgId, adminData) => {
  const response = await fetch(`${API_BASE}/api/SuperAdmin/organisations/${orgId}/admin`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ ...adminData, organisationId: orgId })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create admin');
  }
  
  return response.json();
};

// Upload tokens for organisation assets (banner, favicon)
export const getOrgUploadToken = async (orgId, fileType) => {
  const response = await fetch(`${API_BASE}/api/SuperAdmin/organisations/${orgId}/upload-token?fileType=${fileType}`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  
  if (!response.ok) throw new Error('Failed to get upload token');
  return response.json();
};

// Global Library
export const getGlobalLibrary = async (contentType = null) => {
  const url = contentType 
    ? `${API_BASE}/api/SuperAdmin/global-library?contentType=${contentType}`
    : `${API_BASE}/api/SuperAdmin/global-library`;
    
  const response = await fetch(url, {
    headers: getAuthHeaders()
  });
  
  if (!response.ok) throw new Error('Failed to fetch global library');
  return response.json();
};

export const getGlobalLibraryUploadToken = async (contentType, fileName) => {
  const response = await fetch(`${API_BASE}/api/SuperAdmin/global-library/upload-token?contentType=${contentType}&fileName=${encodeURIComponent(fileName)}`, {
    method: 'POST',
    headers: getAuthHeaders()
  });
  
  if (!response.ok) throw new Error('Failed to get upload token');
  return response.json();
};

export const createGlobalLibraryContent = async (contentData) => {
  const response = await fetch(`${API_BASE}/api/SuperAdmin/global-library`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(contentData)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create content');
  }
  
  return response.json();
};

export const deleteGlobalLibraryContent = async (id) => {
  const response = await fetch(`${API_BASE}/api/SuperAdmin/global-library/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  
  if (!response.ok) throw new Error('Failed to delete content');
  return response.json();
};

// Upload file to Azure using SAS token
export const uploadFileToAzure = async (uploadUrl, file, onProgress) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percentComplete = (e.loaded / e.total) * 100;
        onProgress(percentComplete);
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });
    
    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });
    
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
    xhr.send(file);
  });
};

// Upload video directly to server (server handles Azure upload)
export const uploadVideo = async (file, title, description, tags, onProgress) => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', title);
    formData.append('description', description || '');
    formData.append('tags', tags || '');

    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percentComplete = (e.loaded / e.total) * 100;
        onProgress(percentComplete);
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (e) {
          reject(new Error('Invalid response from server'));
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.message || `Upload failed with status ${xhr.status}`));
        } catch (e) {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });
    
    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });
    
    const token = localStorage.getItem('token');
    xhr.open('POST', `${API_BASE}/api/SuperAdmin/global-library/upload-video`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
};

// Upload PDF directly to server (server handles Azure upload)
export const uploadPdf = async (file, title, description, tags, onProgress) => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('title', title);
    formData.append('description', description || '');
    formData.append('tags', tags || '');

    const xhr = new XMLHttpRequest();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        const percentComplete = (e.loaded / e.total) * 100;
        onProgress(percentComplete);
      }
    });
    
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (e) {
          reject(new Error('Invalid response from server'));
        }
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.message || `Upload failed with status ${xhr.status}`));
        } catch (e) {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });
    
    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });
    
    const token = localStorage.getItem('token');
    xhr.open('POST', `${API_BASE}/api/SuperAdmin/global-library/upload-pdf`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
};
