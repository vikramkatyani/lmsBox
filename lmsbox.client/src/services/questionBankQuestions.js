import api from '../utils/api';

export async function listQuestionBankQuestions({
  search = '',
  tags = '',
  page = 1,
  pageSize = 50,
} = {}) {
  const s = (search || '').trim();
  const t = (tags || '').trim();
  const params = [];
  if (s) params.push(`search=${encodeURIComponent(s)}`);
  if (t) params.push(`tags=${encodeURIComponent(t)}`);
  params.push(`page=${encodeURIComponent(page)}`);
  params.push(`pageSize=${encodeURIComponent(pageSize)}`);
  const url = `/api/superadmin/question-bank/questions?${params.join('&')}`;
  const res = await api.get(url);
  return res.data;
}

// For quiz composition (Admin/OrgAdmin) - read-only list of non-archived questions
export async function listQuestionBankQuestionsForQuiz({ search = '', tags = '', page = 1, pageSize = 50 } = {}) {
  const s = (search || '').trim();
  const t = (tags || '').trim();
  const params = [];
  if (s) params.push(`search=${encodeURIComponent(s)}`);
  if (t) params.push(`tags=${encodeURIComponent(t)}`);
  params.push(`page=${encodeURIComponent(page)}`);
  params.push(`pageSize=${encodeURIComponent(pageSize)}`);
  const url = `/api/admin/question-bank/questions?${params.join('&')}`;
  const res = await api.get(url);
  return res.data;
}

export async function getQuestionBankQuestionForQuiz(id) {
  const res = await api.get(`/api/admin/question-bank/questions/${encodeURIComponent(id)}`);
  return res.data;
}

export async function getQuestionBankQuestion(id) {
  const res = await api.get(`/api/superadmin/question-bank/questions/${encodeURIComponent(id)}`);
  return res.data;
}

export async function createQuestionBankQuestion(payload) {
  const res = await api.post('/api/superadmin/question-bank/questions', payload);
  return res.data;
}

export async function updateQuestionBankQuestion(id, payload) {
  const res = await api.put(`/api/superadmin/question-bank/questions/${encodeURIComponent(id)}`, payload);
  return res.data;
}

export async function deleteQuestionBankQuestion(id) {
  const res = await api.delete(`/api/superadmin/question-bank/questions/${encodeURIComponent(id)}`);
  return res.data;
}

export async function setQuestionBankQuestionArchived(id, isArchived) {
  const res = await api.patch(
    `/api/superadmin/question-bank/questions/${encodeURIComponent(id)}/archive`,
    { isArchived: !!isArchived }
  );
  return res.data;
}

