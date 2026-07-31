import api from '../utils/api';

// User & Engagement Reports
export async function getUserActivityReport(params = {}) {
  const {
    startDate,
    endDate,
    minDaysDormant = 30,
    pageNumber = 1,
    pageSize = 50,
    search,
    sortBy = 'engagement',
    sortDirection = 'desc'
  } = params;
  const queryParams = new URLSearchParams();
  
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  queryParams.append('minDaysDormant', minDaysDormant.toString());
  queryParams.append('pageNumber', pageNumber.toString());
  queryParams.append('pageSize', pageSize.toString());
  if (search) queryParams.append('search', search);
  if (sortBy) queryParams.append('sortBy', sortBy);
  if (sortDirection) queryParams.append('sortDirection', sortDirection);
  
  const res = await api.get(`/api/admin/reports/user-activity?${queryParams}`);
  return res.data;
}

export async function getUserActivityReportSummary(params = {}) {
  const { startDate, endDate, minDaysDormant = 30 } = params;
  const queryParams = new URLSearchParams();

  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  queryParams.append('minDaysDormant', minDaysDormant.toString());

  const res = await api.get(`/api/admin/reports/user-activity/summary?${queryParams}`);
  return res.data;
}

export async function getUserActivityReportUsers(params = {}) {
  const {
    startDate,
    endDate,
    minDaysDormant = 30,
    pageNumber = 1,
    pageSize = 50,
    search,
    sortBy = 'engagement',
    sortDirection = 'desc'
  } = params;
  const queryParams = new URLSearchParams();

  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  queryParams.append('minDaysDormant', minDaysDormant.toString());
  queryParams.append('pageNumber', pageNumber.toString());
  queryParams.append('pageSize', pageSize.toString());
  if (search) queryParams.append('search', search);
  if (sortBy) queryParams.append('sortBy', sortBy);
  if (sortDirection) queryParams.append('sortDirection', sortDirection);

  const res = await api.get(`/api/admin/reports/user-activity/users?${queryParams}`);
  return res.data;
}

export async function getUserProgressReport(params = {}) {
  const {
    startDate,
    endDate,
    pageNumber = 1,
    pageSize = 50,
    search,
    sortBy = 'name',
    sortDirection = 'asc'
  } = params;
  const queryParams = new URLSearchParams();
  
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  queryParams.append('pageNumber', pageNumber.toString());
  queryParams.append('pageSize', pageSize.toString());
  if (search) queryParams.append('search', search);
  if (sortBy) queryParams.append('sortBy', sortBy);
  if (sortDirection) queryParams.append('sortDirection', sortDirection);
  
  const res = await api.get(`/api/admin/reports/user-progress?${queryParams}`);
  return res.data;
}

// Course Analytics Reports
export async function getCourseEnrollmentReport(params = {}) {
  const {
    startDate,
    endDate,
    pageNumber = 1,
    pageSize = 50,
    search,
    category,
    sortBy = 'totalEnrollments',
    sortDirection = 'desc'
  } = params;
  const queryParams = new URLSearchParams();
  
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  queryParams.append('pageNumber', pageNumber.toString());
  queryParams.append('pageSize', pageSize.toString());
  if (search) queryParams.append('search', search);
  if (category) queryParams.append('category', category);
  if (sortBy) queryParams.append('sortBy', sortBy);
  if (sortDirection) queryParams.append('sortDirection', sortDirection);
  
  const res = await api.get(`/api/admin/reports/course-enrollment?${queryParams}`);
  return res.data;
}

export async function getCourseEnrollmentReportSummary(params = {}) {
  const { startDate, endDate } = params;
  const queryParams = new URLSearchParams();

  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);

  const res = await api.get(`/api/admin/reports/course-enrollment/summary?${queryParams}`);
  return res.data;
}

export async function getCourseEnrollmentReportCourses(params = {}) {
  const {
    startDate,
    endDate,
    pageNumber = 1,
    pageSize = 50,
    search,
    category,
    sortBy = 'totalEnrollments',
    sortDirection = 'desc'
  } = params;
  const queryParams = new URLSearchParams();

  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  queryParams.append('pageNumber', pageNumber.toString());
  queryParams.append('pageSize', pageSize.toString());
  if (search) queryParams.append('search', search);
  if (category) queryParams.append('category', category);
  if (sortBy) queryParams.append('sortBy', sortBy);
  if (sortDirection) queryParams.append('sortDirection', sortDirection);

  const res = await api.get(`/api/admin/reports/course-enrollment/courses?${queryParams}`);
  return res.data;
}

export async function getCourseCompletionReport(params = {}) {
  const {
    startDate,
    endDate,
    pageNumber = 1,
    pageSize = 50,
    search,
    category,
    performance,
    sortBy = 'completionRate',
    sortDirection = 'desc'
  } = params;
  const queryParams = new URLSearchParams();
  
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  queryParams.append('pageNumber', pageNumber.toString());
  queryParams.append('pageSize', pageSize.toString());
  if (search) queryParams.append('search', search);
  if (category) queryParams.append('category', category);
  if (performance) queryParams.append('performance', performance);
  if (sortBy) queryParams.append('sortBy', sortBy);
  if (sortDirection) queryParams.append('sortDirection', sortDirection);
  
  const res = await api.get(`/api/admin/reports/course-completion?${queryParams}`);
  return res.data;
}

export async function getCourseCompletionReportSummary(params = {}) {
  const { startDate, endDate } = params;
  const queryParams = new URLSearchParams();

  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);

  const res = await api.get(`/api/admin/reports/course-completion/summary?${queryParams}`);
  return res.data;
}

export async function getCourseCompletionReportCourses(params = {}) {
  const {
    startDate,
    endDate,
    pageNumber = 1,
    pageSize = 50,
    search,
    category,
    performance,
    sortBy = 'completionRate',
    sortDirection = 'desc'
  } = params;
  const queryParams = new URLSearchParams();

  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  queryParams.append('pageNumber', pageNumber.toString());
  queryParams.append('pageSize', pageSize.toString());
  if (search) queryParams.append('search', search);
  if (category) queryParams.append('category', category);
  if (performance) queryParams.append('performance', performance);
  if (sortBy) queryParams.append('sortBy', sortBy);
  if (sortDirection) queryParams.append('sortDirection', sortDirection);

  const res = await api.get(`/api/admin/reports/course-completion/courses?${queryParams}`);
  return res.data;
}

export async function getLessonAnalyticsReport(params = {}) {
  const {
    courseId,
    lessonType,
    startDate,
    endDate,
    pageNumber = 1,
    pageSize = 50,
    search,
    engagement,
    sortBy = 'order',
    sortDirection = 'desc'
  } = params;
  const queryParams = new URLSearchParams();
  
  if (courseId) queryParams.append('courseId', courseId);
  if (lessonType) queryParams.append('lessonType', lessonType);
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  queryParams.append('pageNumber', pageNumber.toString());
  queryParams.append('pageSize', pageSize.toString());
  if (search) queryParams.append('search', search);
  if (engagement) queryParams.append('engagement', engagement);
  if (sortBy) queryParams.append('sortBy', sortBy);
  if (sortDirection) queryParams.append('sortDirection', sortDirection);
  
  const res = await api.get(`/api/admin/reports/lesson-analytics?${queryParams}`);
  return res.data;
}

export async function getLessonAnalyticsReportSummary(params = {}) {
  const { courseId, lessonType, startDate, endDate } = params;
  const queryParams = new URLSearchParams();

  if (courseId) queryParams.append('courseId', courseId);
  if (lessonType) queryParams.append('lessonType', lessonType);
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);

  const res = await api.get(`/api/admin/reports/lesson-analytics/summary?${queryParams}`);
  return res.data;
}

export async function getLessonAnalyticsReportLessons(params = {}) {
  const {
    courseId,
    lessonType,
    startDate,
    endDate,
    pageNumber = 1,
    pageSize = 50,
    search,
    engagement,
    sortBy = 'order',
    sortDirection = 'desc'
  } = params;
  const queryParams = new URLSearchParams();

  if (courseId) queryParams.append('courseId', courseId);
  if (lessonType) queryParams.append('lessonType', lessonType);
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  queryParams.append('pageNumber', pageNumber.toString());
  queryParams.append('pageSize', pageSize.toString());
  if (search) queryParams.append('search', search);
  if (engagement) queryParams.append('engagement', engagement);
  if (sortBy) queryParams.append('sortBy', sortBy);
  if (sortDirection) queryParams.append('sortDirection', sortDirection);

  const res = await api.get(`/api/admin/reports/lesson-analytics/lessons?${queryParams}`);
  return res.data;
}

export async function getTimeTrackingReport(params = {}) {
  const {
    userId,
    courseId,
    startDate,
    endDate,
    table,
    pageNumber,
    pageSize,
    sortBy,
    sortDirection
  } = params;
  const queryParams = new URLSearchParams();
  
  if (userId) queryParams.append('userId', userId);
  if (courseId) queryParams.append('courseId', courseId);
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  if (table) queryParams.append('table', table);
  if (pageNumber) queryParams.append('pageNumber', pageNumber.toString());
  if (pageSize) queryParams.append('pageSize', pageSize.toString());
  if (sortBy) queryParams.append('sortBy', sortBy);
  if (sortDirection) queryParams.append('sortDirection', sortDirection);
  
  const res = await api.get(`/api/admin/reports/time-tracking?${queryParams}`);
  return res.data;
}

export async function getTimeTrackingReportSummary(params = {}) {
  const { userId, courseId, startDate, endDate } = params;
  const queryParams = new URLSearchParams();

  if (userId) queryParams.append('userId', userId);
  if (courseId) queryParams.append('courseId', courseId);
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);

  const res = await api.get(`/api/admin/reports/time-tracking/summary?${queryParams}`);
  return res.data;
}

export async function getTimeTrackingReportTable(params = {}) {
  const {
    table = 'users',
    userId,
    courseId,
    startDate,
    endDate,
    pageNumber = 1,
    pageSize = 50,
    sortBy,
    sortDirection
  } = params;
  const queryParams = new URLSearchParams();

  queryParams.append('table', table);
  if (userId) queryParams.append('userId', userId);
  if (courseId) queryParams.append('courseId', courseId);
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  queryParams.append('pageNumber', pageNumber.toString());
  queryParams.append('pageSize', pageSize.toString());
  if (sortBy) queryParams.append('sortBy', sortBy);
  if (sortDirection) queryParams.append('sortDirection', sortDirection);

  const res = await api.get(`/api/admin/reports/time-tracking/table?${queryParams}`);
  return res.data;
}

// Learning Pathway Reports
export async function getPathwayProgressReport(startDate, endDate, activeOnly) {
  return getPathwayProgressReportCombined({ startDate, endDate, activeOnly });
}

export async function getPathwayProgressReportCombined(params = {}) {
  const {
    startDate,
    endDate,
    activeOnly,
    pageNumber,
    pageSize,
    search,
    sortBy,
    sortDirection
  } = params;
  const queryParams = new URLSearchParams();
  
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  if (activeOnly !== undefined) queryParams.append('activeOnly', activeOnly);
  if (pageNumber) queryParams.append('pageNumber', pageNumber.toString());
  if (pageSize) queryParams.append('pageSize', pageSize.toString());
  if (search) queryParams.append('search', search);
  if (sortBy) queryParams.append('sortBy', sortBy);
  if (sortDirection) queryParams.append('sortDirection', sortDirection);
  
  const res = await api.get(`/api/admin/reports/pathway-progress?${queryParams}`);
  return res.data;
}

export async function getPathwayProgressReportSummary(params = {}) {
  const { startDate, endDate, activeOnly } = params;
  const queryParams = new URLSearchParams();

  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  if (activeOnly !== undefined) queryParams.append('activeOnly', activeOnly);

  const res = await api.get(`/api/admin/reports/pathway-progress/summary?${queryParams}`);
  return res.data;
}

export async function getPathwayProgressReportPathways(params = {}) {
  const {
    startDate,
    endDate,
    activeOnly,
    pageNumber = 1,
    pageSize = 50,
    search,
    sortBy = 'totalEnrollments',
    sortDirection = 'desc'
  } = params;
  const queryParams = new URLSearchParams();

  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  if (activeOnly !== undefined) queryParams.append('activeOnly', activeOnly);
  queryParams.append('pageNumber', pageNumber.toString());
  queryParams.append('pageSize', pageSize.toString());
  if (search) queryParams.append('search', search);
  queryParams.append('sortBy', sortBy);
  queryParams.append('sortDirection', sortDirection);

  const res = await api.get(`/api/admin/reports/pathway-progress/pathways?${queryParams}`);
  return res.data;
}

export async function getPathwayAssignmentsReport(pathwayId, activeOnly) {
  const queryParams = new URLSearchParams();
  
  if (pathwayId) queryParams.append('pathwayId', pathwayId);
  if (activeOnly !== undefined) queryParams.append('activeOnly', activeOnly);
  
  const res = await api.get(`/api/admin/reports/pathway-assignments?${queryParams}`);
  return res.data;
}

export async function getUserCourseProgressReportCombined(params = {}) {
  const {
    search,
    courseId,
    status,
    startDate,
    endDate,
    pageNumber = 1,
    pageSize = 100,
    sortBy = 'progressPercent',
    sortDirection = 'desc'
  } = params;

  const queryParams = new URLSearchParams();

  if (search) queryParams.append('search', search);
  if (courseId) queryParams.append('courseId', courseId);
  if (status) queryParams.append('status', status);
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  queryParams.append('pageNumber', pageNumber.toString());
  queryParams.append('pageSize', pageSize.toString());
  if (sortBy) queryParams.append('sortBy', sortBy);
  if (sortDirection) queryParams.append('sortDirection', sortDirection);

  const res = await api.get(`/api/admin/reports/user-course-progress?${queryParams}`);
  return res.data;
}

export async function getUserCourseProgressReportSummary(params = {}) {
  const { search, courseId, status, startDate, endDate } = params;
  const queryParams = new URLSearchParams();

  if (search) queryParams.append('search', search);
  if (courseId) queryParams.append('courseId', courseId);
  if (status) queryParams.append('status', status);
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);

  const res = await api.get(`/api/admin/reports/user-course-progress/summary?${queryParams}`);
  return res.data;
}

export async function getUserCourseProgressReportRecords(params = {}) {
  const {
    search,
    courseId,
    status,
    startDate,
    endDate,
    pageNumber = 1,
    pageSize = 25,
    sortBy = 'progressPercent',
    sortDirection = 'desc'
  } = params;

  const queryParams = new URLSearchParams();

  if (search) queryParams.append('search', search);
  if (courseId) queryParams.append('courseId', courseId);
  if (status) queryParams.append('status', status);
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  queryParams.append('pageNumber', pageNumber.toString());
  queryParams.append('pageSize', pageSize.toString());
  if (sortBy) queryParams.append('sortBy', sortBy);
  if (sortDirection) queryParams.append('sortDirection', sortDirection);

  const res = await api.get(`/api/admin/reports/user-course-progress/records?${queryParams}`);
  return res.data;
}

export async function getUserCourseProgressReport(search, courseId, status, startDate, endDate) {
  return getUserCourseProgressReportCombined({ search, courseId, status, startDate, endDate });
}

export async function getUserLessonProgressReportSummary(params = {}) {
  const {
    search,
    courseId,
    lessonId,
    lessonType,
    status,
    startDate,
    endDate
  } = params;

  const queryParams = new URLSearchParams();

  if (search) queryParams.append('search', search);
  if (courseId) queryParams.append('courseId', courseId);
  if (lessonId) queryParams.append('lessonId', lessonId.toString());
  if (lessonType) queryParams.append('lessonType', lessonType);
  if (status) queryParams.append('status', status);
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);

  const res = await api.get(`/api/admin/reports/user-lesson-progress/summary?${queryParams}`);
  return res.data;
}

export async function getUserLessonProgressReportRecords(params = {}) {
  const {
    search,
    courseId,
    lessonId,
    lessonType,
    status,
    startDate,
    endDate,
    pageNumber = 1,
    pageSize = 25,
    sortBy = 'lastAccessedAt',
    sortDirection = 'desc'
  } = params;

  const queryParams = new URLSearchParams();

  if (search) queryParams.append('search', search);
  if (courseId) queryParams.append('courseId', courseId);
  if (lessonId) queryParams.append('lessonId', lessonId.toString());
  if (lessonType) queryParams.append('lessonType', lessonType);
  if (status) queryParams.append('status', status);
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  queryParams.append('pageNumber', pageNumber.toString());
  queryParams.append('pageSize', pageSize.toString());
  if (sortBy) queryParams.append('sortBy', sortBy);
  if (sortDirection) queryParams.append('sortDirection', sortDirection);

  const res = await api.get(`/api/admin/reports/user-lesson-progress/records?${queryParams}`);
  return res.data;
}

// Administrative Reports
export async function getContentUsageReport(params = {}) {
  const {
    category,
    startDate,
    endDate,
    search,
    engagement,
    pageNumber = 1,
    pageSize = 25,
    sortBy = 'usageScore',
    sortDirection = 'desc'
  } = params;

  const queryParams = new URLSearchParams();

  if (category) queryParams.append('category', category);
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  if (search) queryParams.append('search', search);
  if (engagement) queryParams.append('engagement', engagement);
  queryParams.append('pageNumber', pageNumber.toString());
  queryParams.append('pageSize', pageSize.toString());
  if (sortBy) queryParams.append('sortBy', sortBy);
  if (sortDirection) queryParams.append('sortDirection', sortDirection);

  const res = await api.get(`/api/admin/reports/content-usage?${queryParams}`);
  return res.data;
}

export async function getContentUsageReportSummary(params = {}) {
  const { category, startDate, endDate } = params;
  const queryParams = new URLSearchParams();

  if (category) queryParams.append('category', category);
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);

  const res = await api.get(`/api/admin/reports/content-usage/summary?${queryParams}`);
  return res.data;
}

export async function getContentUsageReportContent(params = {}) {
  const {
    category,
    startDate,
    endDate,
    search,
    engagement,
    pageNumber = 1,
    pageSize = 25,
    sortBy = 'usageScore',
    sortDirection = 'desc'
  } = params;

  const queryParams = new URLSearchParams();

  if (category) queryParams.append('category', category);
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  if (search) queryParams.append('search', search);
  if (engagement) queryParams.append('engagement', engagement);
  queryParams.append('pageNumber', pageNumber.toString());
  queryParams.append('pageSize', pageSize.toString());
  if (sortBy) queryParams.append('sortBy', sortBy);
  if (sortDirection) queryParams.append('sortDirection', sortDirection);

  const res = await api.get(`/api/admin/reports/content-usage/content?${queryParams}`);
  return res.data;
}

export async function generateCustomReport(reportConfig) {
  const res = await api.post('/api/admin/reports/custom-report', reportConfig);
  return res.data;
}

// Export utilities
export function exportToCSV(data, filename) {
  if (!data || data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => {
      const value = row[header];
      return typeof value === 'string' && value.includes(',') 
        ? `"${value}"` 
        : value;
    }).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

export function exportToJSON(data, filename) {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
}

export async function getLessonProgressEditDetails(progressId) {
  const res = await api.get(`/api/admin/learner-progress/lessons/${progressId}`);
  return res.data;
}

export async function getLessonProgressEditDetailsByAssignment(userId, courseId, lessonId) {
  const res = await api.get(
    `/api/admin/learner-progress/users/${encodeURIComponent(userId)}/courses/${encodeURIComponent(courseId)}/lessons/${lessonId}`
  );
  return res.data;
}

export async function updateUserLessonProgress(progressId, { status, completedAt, quiz }) {
  const payload = { status };
  if (completedAt) {
    payload.completedAt = completedAt;
  }
  if (quiz) {
    payload.quiz = quiz;
  }

  const res = await api.put(`/api/admin/learner-progress/lessons/${progressId}`, payload);
  return res.data;
}

export async function upsertUserLessonProgressByAssignment(userId, courseId, lessonId, { status, completedAt, quiz }) {
  const payload = { status };
  if (completedAt) {
    payload.completedAt = completedAt;
  }
  if (quiz) {
    payload.quiz = quiz;
  }

  const res = await api.put(
    `/api/admin/learner-progress/users/${encodeURIComponent(userId)}/courses/${encodeURIComponent(courseId)}/lessons/${lessonId}`,
    payload
  );
  return res.data;
}

// Quiz Attempts Report
function buildQuizAttemptsQueryParams(params = {}) {
  const {
    courseId,
    quizId,
    startDate,
    endDate,
    search,
    passStatus,
    recordScope,
    includeScopeCounts,
    latestOnly,
    pageNumber,
    pageSize,
    sortBy,
    sortDirection
  } = params;
  const queryParams = new URLSearchParams();

  if (courseId) queryParams.append('courseId', courseId);
  if (quizId) queryParams.append('quizId', quizId);
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  if (search) queryParams.append('search', search);
  if (passStatus) queryParams.append('passStatus', passStatus);
  if (recordScope) queryParams.append('recordScope', recordScope);
  if (includeScopeCounts) queryParams.append('includeScopeCounts', 'true');
  if (latestOnly) queryParams.append('latestOnly', 'true');
  if (pageNumber != null) queryParams.append('pageNumber', pageNumber.toString());
  if (pageSize != null) queryParams.append('pageSize', pageSize.toString());
  if (sortBy) queryParams.append('sortBy', sortBy);
  if (sortDirection) queryParams.append('sortDirection', sortDirection);

  return queryParams;
}

export async function getQuizAttemptsReportAnalytics() {
  const res = await api.get('/api/admin/reports/quiz-attempts/analytics');
  return res.data;
}

export async function getQuizQuestionStats(quizId) {
  const res = await api.get(`/api/admin/reports/quiz-attempts/quizzes/${quizId}/question-stats`);
  return res.data;
}

export async function getAssessmentDifficultyOverview(params = {}) {
  const {
    search,
    pageNumber,
    pageSize,
    sortBy,
    sortDirection
  } = params;
  const queryParams = new URLSearchParams();
  if (search) queryParams.append('search', search);
  if (pageNumber != null) queryParams.append('pageNumber', pageNumber.toString());
  if (pageSize != null) queryParams.append('pageSize', pageSize.toString());
  if (sortBy) queryParams.append('sortBy', sortBy);
  if (sortDirection) queryParams.append('sortDirection', sortDirection);
  const res = await api.get(`/api/admin/reports/quiz-attempts/assessment-difficulty/overview?${queryParams}`);
  return res.data;
}

export async function getQuizAttemptRecordScopes() {
  try {
    const res = await api.get('/api/admin/reports/quiz-attempts/record-scopes');
    return res.data;
  } catch (err) {
    if (err.response?.status !== 404) throw err;
    const fallback = await api.get(
      '/api/admin/reports/quiz-attempts?includeScopeCounts=true&pageNumber=1&pageSize=1&recordScope=all'
    );
    return fallback.data?.scopeCounts ?? fallback.data;
  }
}

export async function getQuizAttemptsReportSummary() {
  return getQuizAttemptsReportAnalytics();
}

export async function getQuizAttemptsReport(params = {}) {
  const queryParams = buildQuizAttemptsQueryParams({
    pageNumber: 1,
    pageSize: 50,
    sortBy: 'completedAt',
    sortDirection: 'desc',
    ...params
  });
  const res = await api.get(`/api/admin/reports/quiz-attempts?${queryParams}`);
  return res.data;
}

export async function getQuizAttemptDetail(attemptId) {
  const res = await api.get(`/api/admin/reports/quiz-attempts/${attemptId}`);
  return res.data;
}

export async function getQuizAttemptHistory(userId, quizId) {
  const params = new URLSearchParams({ userId, quizId });
  const res = await api.get(`/api/admin/reports/quiz-attempts/history?${params}`);
  return res.data;
}

function buildSurveyReportQueryParams(params = {}) {
  const {
    courseId,
    surveyType,
    startDate,
    endDate,
    search,
    pageNumber,
    pageSize,
    sortBy,
    sortDirection
  } = params;
  const queryParams = new URLSearchParams();

  if (courseId) queryParams.append('courseId', courseId);
  if (surveyType) queryParams.append('surveyType', surveyType);
  if (startDate) queryParams.append('startDate', startDate);
  if (endDate) queryParams.append('endDate', endDate);
  if (search) queryParams.append('search', search);
  if (pageNumber != null) queryParams.append('pageNumber', pageNumber.toString());
  if (pageSize != null) queryParams.append('pageSize', pageSize.toString());
  if (sortBy) queryParams.append('sortBy', sortBy);
  if (sortDirection) queryParams.append('sortDirection', sortDirection);

  return queryParams;
}

export async function getSurveyReportOverview(params = {}) {
  const {
    search,
    pageNumber = 1,
    pageSize = 25,
    sortBy = 'courseTitle',
    sortDirection = 'asc'
  } = params;
  const queryParams = new URLSearchParams();
  if (search) queryParams.append('search', search);
  queryParams.append('pageNumber', pageNumber.toString());
  queryParams.append('pageSize', pageSize.toString());
  if (sortBy) queryParams.append('sortBy', sortBy);
  if (sortDirection) queryParams.append('sortDirection', sortDirection);
  const res = await api.get(`/api/admin/reports/surveys/overview?${queryParams}`);
  return res.data;
}

export async function getSurveyReportSummary(surveyId, params = {}) {
  const queryParams = buildSurveyReportQueryParams(params);
  const suffix = queryParams.toString() ? `?${queryParams}` : '';
  const res = await api.get(`/api/admin/reports/surveys/${surveyId}/summary${suffix}`);
  return res.data;
}

export async function getSurveyReportAnalytics(surveyId, params = {}) {
  const queryParams = buildSurveyReportQueryParams(params);
  const suffix = queryParams.toString() ? `?${queryParams}` : '';
  const res = await api.get(`/api/admin/reports/surveys/${surveyId}/analytics${suffix}`);
  return res.data;
}

export async function getSurveyReportResponses(surveyId, params = {}) {
  const queryParams = buildSurveyReportQueryParams({
    pageNumber: 1,
    pageSize: 25,
    ...params
  });
  const suffix = queryParams.toString() ? `?${queryParams}` : '';
  const res = await api.get(`/api/admin/reports/surveys/${surveyId}/responses${suffix}`);
  return res.data;
}
