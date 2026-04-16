import api from '../utils/api';

export async function listAutomationTasks(params = {}) {
  const {
    page = 1,
    pageSize = 20,
    search = '',
    type = '',
    status = ''
  } = params;

  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });

  if (search?.trim()) query.append('search', search.trim());
  if (type) query.append('type', type);
  if (status) query.append('status', status);

  const response = await api.get(`/api/admin/automation/tasks?${query.toString()}`);
  return response.data;
}

export async function getAutomationTask(id) {
  const response = await api.get(`/api/admin/automation/tasks/${id}`);
  return response.data;
}

export async function createAutomationTask(payload) {
  const response = await api.post('/api/admin/automation/tasks', payload);
  return response.data;
}

export async function updateAutomationTask(id, payload) {
  const response = await api.put(`/api/admin/automation/tasks/${id}`, payload);
  return response.data;
}

export async function publishAutomationTask(id) {
  const response = await api.post(`/api/admin/automation/tasks/${id}/publish`);
  return response.data;
}

export async function pauseAutomationTask(id) {
  const response = await api.post(`/api/admin/automation/tasks/${id}/pause`);
  return response.data;
}

export async function resumeAutomationTask(id) {
  const response = await api.post(`/api/admin/automation/tasks/${id}/resume`);
  return response.data;
}

export async function archiveAutomationTask(id) {
  const response = await api.post(`/api/admin/automation/tasks/${id}/archive`);
  return response.data;
}

export async function listAutomationLearningPathways(search = '') {
  const query = new URLSearchParams();
  if (search?.trim()) query.append('search', search.trim());
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await api.get(`/api/admin/automation/lookups/learning-pathways${suffix}`);
  return Array.isArray(response.data) ? response.data : [];
}

export async function previewAutomationAudience(payload) {
  const response = await api.post('/api/admin/automation/audience-preview', payload);
  return response.data;
}

export async function listAutomationCourses(search = '') {
  const query = new URLSearchParams({
    page: '1',
    pageSize: '200',
    status: 'all'
  });

  if (search?.trim()) query.append('search', search.trim());

  const response = await api.get(`/api/admin/courses?${query.toString()}`);
  const data = response.data;
  return Array.isArray(data?.items) ? data.items : [];
}
