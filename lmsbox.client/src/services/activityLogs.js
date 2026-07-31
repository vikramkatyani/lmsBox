import { API_BASE } from '../utils/apiBase';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

const buildQuery = (params) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
};

const ACTIVITY_LOG_BASE = `${API_BASE}/api/admin/activity-logs`;

export const listActivityLogs = async ({
  search,
  dateFrom,
  dateTo,
  actionContains,
  performedBy,
  actorType,
  page = 1,
  pageSize = 25,
} = {}) => {
  const query = buildQuery({
    search,
    dateFrom,
    dateTo,
    actionContains,
    performedBy,
    actorType,
    page,
    pageSize,
  });

  const response = await fetch(`${ACTIVITY_LOG_BASE}${query}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to load activity logs');
  }

  return response.json();
};

export const getRecentActivityLogs = async (limit = 50) => {
  const query = buildQuery({ limit });
  const response = await fetch(`${ACTIVITY_LOG_BASE}/recent${query}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to load recent activity logs');
  }

  return response.json();
};

export const getActivityLogSummary = async ({ dateFrom, dateTo, actorType } = {}) => {
  const query = buildQuery({ dateFrom, dateTo, actorType });
  const response = await fetch(`${ACTIVITY_LOG_BASE}/summary${query}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to load activity log summary');
  }

  return response.json();
};

export const getActivityLogById = async (id) => {
  const response = await fetch(`${ACTIVITY_LOG_BASE}/${encodeURIComponent(id)}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to load activity log detail');
  }

  return response.json();
};

export const ACTIVITY_LOG_ACTION_PREFIXES = [
  { value: '', label: 'All activity types' },
  { value: 'Login', label: 'Login' },
  { value: 'CourseView', label: 'Course view' },
  { value: 'LessonComplete', label: 'Lesson complete' },
  { value: 'QuizAttempt', label: 'Assessment attempt' },
  { value: 'CourseCreated', label: 'Course created' },
  { value: 'LessonCreated', label: 'Lesson created' },
  { value: 'Question Bank', label: 'Question bank (audit)' },
  { value: 'Quiz', label: 'Assessment (audit)' },
  { value: 'Survey', label: 'Survey (audit)' },
];

export const ACTIVITY_LOG_ACTOR_TYPES = [
  { value: '', label: 'All users' },
  { value: 'admin', label: 'Admin' },
  { value: 'learner', label: 'Learner' },
];
