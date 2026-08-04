import api from '../utils/api';
import { isSuperAdmin } from '../config/adminFeatureFlags';

const categoriesBasePath = () =>
  isSuperAdmin()
    ? '/api/superadmin/question-bank/categories'
    : '/api/admin/question-bank/categories';

export async function listQuestionBankCategories({ search = '' } = {}) {
  const s = (search || '').trim();
  const url = s
    ? `${categoriesBasePath()}?search=${encodeURIComponent(s)}`
    : categoriesBasePath();
  const res = await api.get(url);
  return res.data;
}

export async function createQuestionBankCategory(payload) {
  const res = await api.post(categoriesBasePath(), payload);
  return res.data;
}

export async function updateQuestionBankCategory(id, payload) {
  const res = await api.put(`${categoriesBasePath()}/${encodeURIComponent(id)}`, payload);
  return res.data;
}

export async function deleteQuestionBankCategory(id) {
  const res = await api.delete(`${categoriesBasePath()}/${encodeURIComponent(id)}`);
  return res.data;
}
