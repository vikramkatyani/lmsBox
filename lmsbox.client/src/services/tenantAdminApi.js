const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

export const getMyTenant = async () => {
  const response = await fetch(`${API_BASE}/api/tenant/me`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to load tenant');
  }
  return response.json();
};

export const getTenantOrganisations = async () => {
  const response = await fetch(`${API_BASE}/api/tenant/organisations`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Failed to fetch organisations');
  return response.json();
};

export const createTenantOrganisation = async (orgData) => {
  const response = await fetch(`${API_BASE}/api/tenant/organisations`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(orgData)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to create organisation');
  }
  return response.json();
};

export const updateTenantOrganisation = async (id, orgData) => {
  const response = await fetch(`${API_BASE}/api/tenant/organisations/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ ...orgData, id: Number(id) })
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to update organisation');
  }
  return response.json();
};

export const createOrgAdminForTenant = async (orgId, adminData) => {
  const response = await fetch(`${API_BASE}/api/tenant/organisations/${orgId}/admin`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ ...adminData, organisationId: Number(orgId) })
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to create organisation admin');
  }
  return response.json();
};

export const getTenantBranding = async () => {
  const response = await fetch(`${API_BASE}/api/tenant/branding`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to load tenant branding');
  }
  return response.json();
};

export const updateTenantBranding = async (branding) => {
  const response = await fetch(`${API_BASE}/api/tenant/branding`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(branding)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to update tenant branding');
  }
  return response.json();
};
