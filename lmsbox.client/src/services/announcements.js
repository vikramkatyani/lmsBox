import api from '../utils/api';

export async function getAnnouncements(page = 1, pageSize = 50) {
  const res = await api.get('/api/learner/announcements', {
    params: { page, pageSize },
  });
  return res.data;
}

export async function getUnreadAnnouncementCount() {
  const res = await api.get('/api/learner/announcements/unread-count');
  return res.data?.unreadCount ?? 0;
}

export async function markAnnouncementAsRead(id) {
  const res = await api.post(`/api/learner/announcements/${id}/read`);
  return res.data;
}
