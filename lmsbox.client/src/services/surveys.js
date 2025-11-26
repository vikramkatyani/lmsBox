import api from '../utils/api';

// Admin survey management service
export const adminSurveyService = {
  // Get all surveys
  async listSurveys() {
    const response = await api.get('/api/admin/surveys');
    return response.data;
  },

  // Get a specific survey with questions
  async getSurvey(surveyId) {
    const response = await api.get(`/api/admin/surveys/${surveyId}`);
    return response.data;
  },

  // Create a new survey
  async createSurvey(surveyData) {
    const response = await api.post('/api/admin/surveys', surveyData);
    return response.data;
  },

  // Update a survey
  async updateSurvey(surveyId, surveyData) {
    const response = await api.put(`/api/admin/surveys/${surveyId}`, surveyData);
    return response.data;
  },

  // Delete a survey
  async deleteSurvey(surveyId) {
    const response = await api.delete(`/api/admin/surveys/${surveyId}`);
    return response.data;
  },

  // Add question to survey
  async addQuestion(surveyId, questionData) {
    const response = await api.post(`/api/admin/surveys/${surveyId}/questions`, questionData);
    return response.data;
  },

  // Update question
  async updateQuestion(surveyId, questionId, questionData) {
    const response = await api.put(`/api/admin/surveys/${surveyId}/questions/${questionId}`, questionData);
    return response.data;
  },

  // Delete question
  async deleteQuestion(surveyId, questionId) {
    const response = await api.delete(`/api/admin/surveys/${surveyId}/questions/${questionId}`);
    return response.data;
  }
};
