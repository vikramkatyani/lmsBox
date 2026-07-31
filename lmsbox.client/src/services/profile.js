import api from '../utils/api';

export async function getMyProfile() {
  const res = await api.get('/api/profile/me');
  return res.data;
}

export async function updateMyProfile({ firstName, lastName }) {
  const res = await api.put('/api/profile', { firstName, lastName });
  return res.data;
}

export async function getFavoriteReports() {
  const res = await api.get('/api/profile/favorite-reports');
  return res.data;
}

export async function updateFavoriteReports(favoriteReportIds) {
  const res = await api.put('/api/profile/favorite-reports', { favoriteReportIds });
  return res.data;
}
