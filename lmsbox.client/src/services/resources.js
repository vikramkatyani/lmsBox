import api from '../utils/api';

const resourcesService = {
  getResources: async (courseId) => {
    const response = await api.get(`/api/admin/courses/${courseId}/resources`);
    return response.data;
  },

  getResource: async (courseId, resourceId) => {
    const response = await api.get(`/api/admin/courses/${courseId}/resources/${resourceId}`);
    return response.data;
  },

  createResource: async (courseId, resourceData) => {
    const response = await api.post(`/api/admin/courses/${courseId}/resources`, resourceData);
    return response.data;
  },

  updateResource: async (courseId, resourceId, resourceData) => {
    const response = await api.put(`/api/admin/courses/${courseId}/resources/${resourceId}`, resourceData);
    return response.data;
  },

  deleteResource: async (courseId, resourceId) => {
    const response = await api.delete(`/api/admin/courses/${courseId}/resources/${resourceId}`);
    return response.data;
  },

  uploadVideo: async (courseId, videoFile, onUploadProgress) => {
    const formData = new FormData();
    formData.append('video', videoFile);

    const response = await api.post(
      `/api/admin/courses/${courseId}/resources/upload-video`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (onUploadProgress && progressEvent.total) {
            onUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
          }
        },
      }
    );
    return response.data;
  },

  uploadPdf: async (courseId, pdfFile, onUploadProgress) => {
    const formData = new FormData();
    formData.append('pdf', pdfFile);

    const response = await api.post(
      `/api/admin/courses/${courseId}/resources/upload-pdf`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (onUploadProgress && progressEvent.total) {
            onUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
          }
        },
      }
    );
    return response.data;
  },

  uploadHtmlContent: async (courseId, title, htmlContent) => {
    const response = await api.post(`/api/admin/courses/${courseId}/resources/html`, {
      title,
      htmlContent,
    });
    return response.data;
  },

  uploadThumbnail: async (courseId, thumbnailFile) => {
    const formData = new FormData();
    formData.append('thumbnail', thumbnailFile);

    const response = await api.post(
      `/api/admin/courses/${courseId}/resources/upload-thumbnail`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return response.data;
  },
};

export default resourcesService;
