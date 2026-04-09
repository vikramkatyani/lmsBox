import api from '../utils/api';

export const engagementAnalyticsService = {
  async getOverview(fromDate, toDate) {
    const params = {};
    if (fromDate) params.fromDate = fromDate.toISOString();
    if (toDate) params.toDate = toDate.toISOString();
    
    const response = await api.get('/api/EngagementAnalytics/overview', { params });
    return response.data;
  },

  async getDailyScores(fromDate, toDate) {
    const params = {};
    if (fromDate) params.fromDate = fromDate.toISOString();
    if (toDate) params.toDate = toDate.toISOString();
    
    const response = await api.get('/api/EngagementAnalytics/daily-scores', { params });
    return response.data;
  },

  async getTopUsers(days = 30, top = 10) {
    const response = await api.get('/api/EngagementAnalytics/top-users', {
      params: { days, top }
    });
    return response.data;
  },

  async getTopUsersTable({ fromDate, toDate, pageNumber = 1, pageSize = 25, sortBy = 'engagementScore', sortDirection = 'desc' } = {}) {
    const params = {
      pageNumber,
      pageSize,
      sortBy,
      sortDirection
    };

    if (fromDate) params.fromDate = fromDate.toISOString();
    if (toDate) params.toDate = toDate.toISOString();

    const response = await api.get('/api/EngagementAnalytics/top-users-table', { params });
    return response.data;
  },

  async getEventBreakdown(fromDate, toDate) {
    const params = {};
    if (fromDate) params.fromDate = fromDate.toISOString();
    if (toDate) params.toDate = toDate.toISOString();
    
    const response = await api.get('/api/EngagementAnalytics/event-breakdown', { params });
    return response.data;
  }
};
