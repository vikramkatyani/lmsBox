import api from '../utils/api';

export async function listQuestionBankCategories({ search = '' } = {}) {
  const s = (search || '').trim();
  const url = s
    ? `/api/superadmin/question-bank/categories?search=${encodeURIComponent(s)}`
    : '/api/superadmin/question-bank/categories';
  const res = await api.get(url);
  return res.data;
}

export async function createQuestionBankCategory(payload) {
  const res = await api.post('/api/superadmin/question-bank/categories', payload);
  return res.data;
}

export async function updateQuestionBankCategory(id, payload) {
  const res = await api.put(`/api/superadmin/question-bank/categories/${encodeURIComponent(id)}`, payload);
  return res.data;
}

export async function deleteQuestionBankCategory(id) {
  const res = await api.delete(`/api/superadmin/question-bank/categories/${encodeURIComponent(id)}`);
  return res.data;
}

