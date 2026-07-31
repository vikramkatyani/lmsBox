import api from '../utils/api';

const interactiveLessonsService = {
  getBlockTypes: async () => {
    const response = await api.get('/api/admin/interactive-lessons/block-types');
    return response.data;
  },

  generateQuestionnaireQuestions: async (contentDescription, questionCount) => {
    const response = await api.post('/api/admin/interactive-lessons/generate-questionnaire-questions', {
      contentDescription,
      questionCount,
    });
    return response.data;
  },

  generateCarouselSlides: async (contentDescription, slideCount) => {
    const response = await api.post('/api/admin/interactive-lessons/generate-carousel-slides', {
      contentDescription,
      slideCount,
    });
    return response.data;
  },

  renderCarouselTemplate: async (formPayload, blockId) => {
    return interactiveLessonsService.renderBlockTemplate('carousel', formPayload, blockId);
  },

  renderBlockTemplate: async (blockType, formPayload, blockId) => {
    const response = await api.post(`/api/admin/interactive-lessons/templates/${blockType}/render`, {
      formPayloadJson: typeof formPayload === 'string' ? formPayload : JSON.stringify(formPayload),
      blockId: blockId || 0,
    });
    return response.data;
  },

  generateAccordionPanels: async (contentDescription, panelCount) => {
    const response = await api.post('/api/admin/interactive-lessons/generate-accordion-panels', {
      contentDescription,
      panelCount,
    });
    return response.data;
  },

  createLesson: async (courseId, data) => {
    const response = await api.post(`/api/admin/courses/${courseId}/interactive-lessons`, data);
    return response.data;
  },

  getLesson: async (lessonId) => {
    const response = await api.get(`/api/admin/interactive-lessons/${lessonId}`);
    return response.data;
  },

  updateLesson: async (lessonId, data) => {
    const response = await api.put(`/api/admin/interactive-lessons/${lessonId}`, data);
    return response.data;
  },

  createBlock: async (lessonId, data) => {
    const response = await api.post(`/api/admin/interactive-lessons/${lessonId}/blocks`, data);
    return response.data;
  },

  updateBlock: async (lessonId, blockId, data) => {
    const response = await api.put(`/api/admin/interactive-lessons/${lessonId}/blocks/${blockId}`, data);
    return response.data;
  },

  deleteBlock: async (lessonId, blockId) => {
    await api.delete(`/api/admin/interactive-lessons/${lessonId}/blocks/${blockId}`);
  },

  reorderBlocks: async (lessonId, blockIds) => {
    const response = await api.put(`/api/admin/interactive-lessons/${lessonId}/blocks/reorder`, { blockIds });
    return response.data;
  },

  generateBlock: async (lessonId, blockId) => {
    const response = await api.post(`/api/admin/interactive-lessons/${lessonId}/blocks/${blockId}/generate`);
    return response.data;
  },

  regenerateBlock: async (lessonId, blockId) => {
    const response = await api.post(`/api/admin/interactive-lessons/${lessonId}/blocks/${blockId}/regenerate`);
    return response.data;
  },

  updateBlockHtml: async (lessonId, blockId, html) => {
    const response = await api.put(`/api/admin/interactive-lessons/${lessonId}/blocks/${blockId}/html`, { html });
    return response.data;
  },

  approveBlock: async (lessonId, blockId) => {
    const response = await api.post(`/api/admin/interactive-lessons/${lessonId}/blocks/${blockId}/approve`);
    return response.data;
  },

  unapproveBlock: async (lessonId, blockId) => {
    const response = await api.post(`/api/admin/interactive-lessons/${lessonId}/blocks/${blockId}/unapprove`);
    return response.data;
  },

  uploadBlockMedia: async (lessonId, blockId, file, onUploadProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(
      `/api/admin/interactive-lessons/${lessonId}/blocks/${blockId}/media`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (onUploadProgress && event.total) {
            onUploadProgress(Math.round((event.loaded * 100) / event.total));
          }
        },
      }
    );
    return response.data;
  },

  getLearnerLesson: async (courseId, lessonId, preview = false) => {
    const response = await api.get(
      `/api/courses/${courseId}/lessons/${lessonId}/interactive`,
      { params: preview ? { preview: true } : {} }
    );
    return response.data;
  },

  openLessonPreview: (lessonId, courseId) => {
    const params = new URLSearchParams();
    if (courseId) {
      params.set('courseId', courseId);
    }
    const query = params.toString();
    window.open(`/admin/interactive/preview/${lessonId}${query ? `?${query}` : ''}`, '_blank');
  },

  updateBlockProgress: async (courseId, lessonId, blockId, data) => {
    const response = await api.post(
      `/api/courses/${courseId}/lessons/${lessonId}/interactive/blocks/${blockId}/progress`,
      data
    );
    return response.data;
  },
};

export default interactiveLessonsService;
