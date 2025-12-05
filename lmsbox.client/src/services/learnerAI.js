import api from '../utils/api';

export const learnerAIService = {
  async askQuestion(question, courseTitle, lessonTitle = null, additionalContext = null) {
    const response = await api.post('/api/aiassistant/learner-query', {
      question,
      courseTitle,
      lessonTitle,
      additionalContext
    });
    return response.data;
  }
};
