import api from '../utils/api';

export async function getMyProfile() {
  const res = await api.get('/api/profile/me');
  return res.data;
}

export async function updateMyProfile({ firstName, lastName }) {
  const res = await api.put('/api/profile', { firstName, lastName });
  return res.data;
}
