import api from '../utils/api';
import { isSuperAdmin } from '../config/adminFeatureFlags';

const questionsBasePath = () =>
  isSuperAdmin()
    ? '/api/superadmin/question-bank/questions'
    : '/api/admin/question-bank/questions';

export async function listQuestionBankQuestions({
  search = '',
  tags = '',
  page = 1,
  pageSize = 50,
  includeArchived = false,
} = {}) {
  const s = (search || '').trim();
  const t = (tags || '').trim();
  const params = [];
  if (s) params.push(`search=${encodeURIComponent(s)}`);
  if (t) params.push(`tags=${encodeURIComponent(t)}`);
  params.push(`page=${encodeURIComponent(page)}`);
  params.push(`pageSize=${encodeURIComponent(pageSize)}`);
  if (includeArchived) params.push('includeArchived=true');
  const url = `${questionsBasePath()}?${params.join('&')}`;
  const res = await api.get(url);
  return res.data;
}

// For quiz composition - includes global platform questions for org admins.
export async function listQuestionBankQuestionsForQuiz({ search = '', tags = '', page = 1, pageSize = 50 } = {}) {
  const s = (search || '').trim();
  const t = (tags || '').trim();
  const params = [];
  if (s) params.push(`search=${encodeURIComponent(s)}`);
  if (t) params.push(`tags=${encodeURIComponent(t)}`);
  params.push(`page=${encodeURIComponent(page)}`);
  params.push(`pageSize=${encodeURIComponent(pageSize)}`);
  if (!isSuperAdmin()) params.push('includeGlobal=true');
  const url = `/api/admin/question-bank/questions?${params.join('&')}`;
  const res = await api.get(url);
  return res.data;
}

export async function getQuestionBankQuestionForQuiz(id) {
  const res = await api.get(`/api/admin/question-bank/questions/${encodeURIComponent(id)}`);
  return res.data;
}

export async function getQuestionBankQuestion(id) {
  const res = await api.get(`${questionsBasePath()}/${encodeURIComponent(id)}`);
  return res.data;
}

export async function createQuestionBankQuestion(payload) {
  const res = await api.post(questionsBasePath(), payload);
  return res.data;
}

export async function updateQuestionBankQuestion(id, payload) {
  const res = await api.put(`${questionsBasePath()}/${encodeURIComponent(id)}`, payload);
  return res.data;
}

export async function deleteQuestionBankQuestion(id) {
  const res = await api.delete(`${questionsBasePath()}/${encodeURIComponent(id)}`);
  return res.data;
}

export async function setQuestionBankQuestionArchived(id, isArchived) {
  const res = await api.patch(
    `${questionsBasePath()}/${encodeURIComponent(id)}/archive`,
    { isArchived: !!isArchived }
  );
  return res.data;
}
