import api from '../utils/api';

const API_URL = '/api/aiassistant';

export const aiAssistant = {
  generateCourseOutline: async (topic, level = null, duration = null) => {
    const response = await api.post(`${API_URL}/generate-course-outline`, {
      topic,
      level,
      duration,
    });
    return response.data;
  },

  generateLessonContent: async (lessonTitle, context = null) => {
    const response = await api.post(`${API_URL}/generate-lesson-content`, {
      lessonTitle,
      context,
    });
    return response.data;
  },

  generateQuizQuestions: async (topic, questionCount = 5, difficulty = null) => {
    const response = await api.post(`${API_URL}/generate-quiz-questions`, {
      topic,
      questionCount,
      difficulty,
    });
    return response.data;
  },

  improveContent: async (content, improvementType = 'general') => {
    const response = await api.post(`${API_URL}/improve-content`, {
      content,
      improvementType,
    });
    return response.data;
  },

  chat: async (message, context = null) => {
    const response = await api.post(`${API_URL}/chat`, {
      message,
      context,
    });
    return response.data;
  },
};
