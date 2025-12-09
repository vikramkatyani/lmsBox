import api from '../utils/api';

export const storageService = {
  async getStorageUsage() {
    const response = await api.get('/api/admin/courses/storage-usage');
    return response.data;
  },

  async getStorageFiles() {
    const response = await api.get('/api/admin/courses/storage-files');
    return response.data;
  },
};
