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
  },

  // Update survey status (Publish/Unpublish)
  async updateSurveyStatus(surveyId, status) {
    const response = await api.put(`/api/admin/surveys/${surveyId}/status`, { status });
    return response.data;
  },

  // Duplicate a survey
  async duplicateSurvey(surveyId) {
    const response = await api.post(`/api/admin/surveys/${surveyId}/duplicate`);
    return response.data;
  }
};

// Learner survey service
export const learnerSurveyService = {
  // Get pre-course survey for a specific course
  async getPreCourseSurvey(courseId) {
    const response = await api.get(`/api/learner/courses/${courseId}/survey/pre`);
    return response.data;
  },

  // Get post-course survey for a specific course
  async getPostCourseSurvey(courseId) {
    const response = await api.get(`/api/learner/courses/${courseId}/survey/post`);
    return response.data;
  },

  // Submit pre-course survey responses
  async submitPreCourseSurvey(courseId, answers) {
    const response = await api.post(`/api/learner/courses/${courseId}/survey/pre/submit`, {
      answers
    });
    return response.data;
  },

  // Submit post-course survey responses
  async submitPostCourseSurvey(courseId, answers) {
    const response = await api.post(`/api/learner/courses/${courseId}/survey/post/submit`, {
      answers
    });
    return response.data;
  }
};
