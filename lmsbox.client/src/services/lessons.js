import api from '../utils/api';

const lessonsService = {
  // Get all lessons for a course
  getLessons: async (courseId) => {
    const response = await api.get(`/api/admin/courses/${courseId}/lessons`);
    return response.data;
  },

  // Get a single lesson
  getLesson: async (courseId, lessonId) => {
    const response = await api.get(`/api/admin/courses/${courseId}/lessons/${lessonId}`);
    return response.data;
  },

  // Create a new lesson
  createLesson: async (courseId, lessonData) => {
    const response = await api.post(`/api/admin/courses/${courseId}/lessons`, lessonData);
    return response.data;
  },

  // Update an existing lesson
  updateLesson: async (courseId, lessonId, lessonData) => {
    const response = await api.put(`/api/admin/courses/${courseId}/lessons/${lessonId}`, lessonData);
    return response.data;
  },

  // Update caption only (allowed on published courses)
  updateCaption: async (courseId, lessonId, captionUrl) => {
    const response = await api.put(
      `/api/admin/courses/${courseId}/lessons/${lessonId}/caption`,
      { captionUrl: captionUrl || null }
    );
    return response.data;
  },

  // Delete a lesson
  deleteLesson: async (courseId, lessonId) => {
    const response = await api.delete(`/api/admin/courses/${courseId}/lessons/${lessonId}`);
    return response.data;
  },

  // Upload video file
  uploadVideo: async (courseId, videoFile, onUploadProgress) => {
    const formData = new FormData();
    formData.append('video', videoFile);

    const response = await api.post(
      `/api/admin/courses/${courseId}/lessons/upload-video`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onUploadProgress) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onUploadProgress(percentCompleted);
          }
        },
      }
    );
    return response.data;
  },

  uploadCaption: async (courseId, captionFile, onUploadProgress) => {
    const formData = new FormData();
    formData.append('caption', captionFile);

    const response = await api.post(
      `/api/admin/courses/${courseId}/lessons/upload-caption`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onUploadProgress) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onUploadProgress(percentCompleted);
          }
        },
      }
    );
    return response.data;
  },

  // List videos from organization's library
  listLibraryVideos: async (courseId) => {
    const response = await api.get(`/api/admin/courses/${courseId}/lessons/library/videos`);
    return response.data;
  },

  // List videos from shared LMS library (accessible to all organizations)
  listSharedLibraryVideos: async (courseId) => {
    const response = await api.get(`/api/admin/courses/${courseId}/lessons/shared-library/videos`);
    return response.data;
  },

  // Upload PDF file
  uploadPdf: async (courseId, pdfFile, onUploadProgress) => {
    const formData = new FormData();
    formData.append('pdf', pdfFile);

    const response = await api.post(
      `/api/admin/courses/${courseId}/lessons/upload-pdf`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onUploadProgress) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onUploadProgress(percentCompleted);
          }
        },
      }
    );
    return response.data;
  },

  // List PDFs from shared LMS library (accessible to all organizations)
  listSharedLibraryPdfs: async (courseId) => {
    const response = await api.get(`/api/admin/courses/${courseId}/lessons/shared-library/pdfs`);
    return response.data;
  },

  // Upload SCORM package
  uploadScorm: async (courseId, file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(
      `/api/admin/courses/${courseId}/lessons/upload-scorm`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(percentCompleted);
          }
        },
      }
    );
    return response.data;
  },

  // Upload HTML content
  uploadHtmlContent: async (courseId, title, htmlContent) => {
    const response = await api.post(
      `/api/admin/courses/${courseId}/lessons/html`,
      {
        title,
        htmlContent,
      }
    );
    return response.data;
  },

  // Reorder lessons
  reorderLessons: async (courseId, lessonOrders) => {
    const response = await api.put(`/api/admin/courses/${courseId}/lessons/reorder`, {
      lessonOrders,
    });
    return response.data;
  },

  // Global Library - Get all lessons from Byte Learning Library
  getGlobalLibraryLessons: async (contentType = null, category = null, courseId = null) => {
    const params = {};
    if (contentType && contentType !== 'all') params.contentType = contentType;
    if (category && category !== 'all') params.category = category;
    if (courseId) params.courseId = courseId;
    
    const response = await api.get('/api/admin/global-library/lessons', { params });
    return response.data;
  },

  // Global Library - Get all categories
  getGlobalLibraryCategories: async () => {
    const response = await api.get('/api/admin/global-library/categories');
    return response.data;
  },

  // Global Library - Add lessons to course from library
  addLessonsFromLibrary: async (courseId, libraryContentIds) => {
    const response = await api.post(`/api/admin/courses/${courseId}/lessons/from-library`, {
      libraryContentIds,
    });
    return response.data;
  },
};

export default lessonsService;
