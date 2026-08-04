import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminHeader from '../components/AdminHeader';
import Pagination from '../components/Pagination';
import usePageTitle from '../hooks/usePageTitle';
import ConfirmDialog from '../components/ConfirmDialog';
import { isSuperAdmin } from '../config/adminFeatureFlags';
import {
  deleteQuestionBankQuestion,
  listQuestionBankQuestions,
  setQuestionBankQuestionArchived,
} from '../services/questionBankQuestions';
import { quizFeatureFlags } from '../config/quizFeatureFlags';
import { MagnifyingGlassIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function QuestionBankQuestionList() {
  usePageTitle('Question Bank - Questions');
  const navigate = useNavigate();
  const isGlobalBank = isSuperAdmin();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [tagsInput, setTagsInput] = useState('');
  const [tagsQuery, setTagsQuery] = useState('');

  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, id: null, title: '' });
  const [archiveDialog, setArchiveDialog] = useState({ isOpen: false, id: null, title: '' });

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await listQuestionBankQuestions({
        search: searchQuery,
        tags: tagsQuery,
        page,
        pageSize,
      });
      const total = data?.total ?? 0;
      const fetchedItems = Array.isArray(data?.items) ? data.items : [];
      const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
      if (page > pages && total > 0) {
        setPage(pages);
        return;
      }
      setItems(fetchedItems);
      setTotalCount(total);
    } catch (e) {
      console.error('Failed to load question bank questions', e);
      toast.error('Failed to load Question Bank questions');
      setItems([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, tagsQuery, page, pageSize]);

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
    setTagsQuery(tagsInput.trim());
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setPage(1);
  };

  const formatDateDDMMMYYYY = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mmm = d.toLocaleString('en-GB', { month: 'short' });
    const yyyy = String(d.getFullYear());
    return `${dd}-${mmm}-${yyyy}`;
  };

  const usageTooltip = (q) => {
    const quizCount = q.quizCount ?? 0;
    const presented = q.presentedCount ?? 0;
    const correct = q.correctCount ?? 0;
    const incorrect = q.incorrectCount ?? 0;
    const accuracy = presented > 0 ? Math.round((correct / presented) * 100) : 0;
    return `Assessments mapped: ${quizCount}\nPresented: ${presented}\nCorrect: ${correct}\nIncorrect: ${incorrect}\nAccuracy: ${accuracy}%`;
  };

  const clamp01 = (n) => Math.max(0, Math.min(1, n));

  const usageViz = (q) => {
    const quizCount = q.quizCount ?? 0;
    const presented = q.presentedCount ?? 0;
    const correct = q.correctCount ?? 0;
    const incorrect = q.incorrectCount ?? 0;
    const denom = Math.max(1, presented);
    const correctPct = clamp01(correct / denom);
    const incorrectPct = clamp01(incorrect / denom);
    const accuracy = presented > 0 ? Math.round((correct / presented) * 100) : 0;

    return (
      <div
        className="min-w-[180px] max-w-[220px]"
        title={usageTooltip(q)}
      >
        <div className="flex items-center justify-between gap-2 text-[11px] text-gray-600">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
              Assessments {quizCount}
            </span>
            <span className="text-gray-500">Presented {presented}</span>
          </div>
          <span className="text-gray-700 font-medium">{accuracy}%</span>
        </div>

        <div className="mt-2 h-2 w-full rounded-full bg-gray-200 overflow-hidden flex">
          <div className="h-full bg-emerald-500" style={{ width: `${correctPct * 100}%` }} />
          <div className="h-full bg-rose-500" style={{ width: `${incorrectPct * 100}%` }} />
        </div>

        <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-600">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-emerald-500" />
            {correct}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-rose-500" />
            {incorrect}
          </span>
        </div>
      </div>
    );
  };

  const openDelete = (q) => {
    setDeleteDialog({
      isOpen: true,
      id: q.id,
      title: (q.question || '').slice(0, 80),
    });
  };

  const confirmDelete = async () => {
    const { id } = deleteDialog;
    if (!id) return;
    try {
      await deleteQuestionBankQuestion(id);
      toast.success('Question deleted');
      setDeleteDialog({ isOpen: false, id: null, title: '' });
      fetchItems();
    } catch (e) {
      console.error('Failed to delete question', e);
      toast.error(e.response?.data?.message || 'Failed to delete question');
      setDeleteDialog({ isOpen: false, id: null, title: '' });
    }
  };

  const openArchive = (q) => {
    setArchiveDialog({
      isOpen: true,
      id: q.id,
      title: (q.question || '').slice(0, 80),
    });
  };

  const confirmArchive = async () => {
    const { id } = archiveDialog;
    if (!id) return;
    try {
      await setQuestionBankQuestionArchived(id, true);
      toast.success('Question archived');
      setArchiveDialog({ isOpen: false, id: null, title: '' });
      fetchItems();
    } catch (e) {
      console.error('Failed to archive question', e);
      toast.error(e.response?.data?.message || 'Failed to archive question');
      setArchiveDialog({ isOpen: false, id: null, title: '' });
    }
  };

  const toggleArchive = async (q) => {
    if (!q?.id) return;

    // Confirm before archiving; unarchive can proceed immediately.
    if (!q.isArchived) {
      openArchive(q);
      return;
    }

    try {
      await setQuestionBankQuestionArchived(q.id, false);
      toast.success('Question unarchived');
      fetchItems();
    } catch (e) {
      console.error('Failed to unarchive question', e);
      toast.error(e.response?.data?.message || 'Failed to unarchive question');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Question Bank</h1>
              <p className="mt-2 text-sm text-gray-600">
                {isGlobalBank
                  ? 'Manage global questions. Filter by tags and reuse later when composing assessments.'
                  : 'Manage your organisation question bank. Filter by tags and reuse questions when composing assessments.'}
              </p>
            </div>
            <button
              onClick={() => navigate('/admin/question-bank/questions/create')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium bg-boxlms-primary-btn text-boxlms-primary-btn-txt hover:brightness-90"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create Question
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <input
                  id="search"
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search question text, category, explanation..."
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 pl-10 pr-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>
            <div>
              <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
                Tags (comma separated)
              </label>
              <input
                id="tags"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="e.g. fall protection, ppe"
                className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="mt-3">
            <button
              onClick={handleSearch}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <MagnifyingGlassIcon className="h-5 w-5 mr-2" />
              Apply Filters
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-10">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <h3 className="mt-2 text-sm font-medium text-gray-900">No questions found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {isGlobalBank
                ? 'Create your first global question to start building your question bank.'
                : 'Create your first organisation question to start building your question bank.'}
            </p>
            <div className="mt-6">
              <button
                onClick={() => navigate('/admin/question-bank/questions/create')}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md bg-boxlms-primary-btn text-boxlms-primary-btn-txt hover:brightness-90"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Create Question
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Question
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tags
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usage / Stats
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Updated
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 line-clamp-2">{q.question}</div>
                      <div className="text-xs text-gray-400 mt-1">ID: {q.id}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {q.category ? `Category: ${q.category}` : 'Category: —'}
                        {quizFeatureFlags.enableCriticalSafetyQuestions && q.isCriticalSafety ? ' • Critical Safety' : ''}
                      </div>
                      {q.isArchived ? (
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                            Archived
                          </span>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(q.tags || []).length ? (
                          q.tags.map((t) => (
                            <span
                              key={t}
                              className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700"
                            >
                              {t}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {q.type === 'mc_multi' ? 'Multi' : 'Single'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {usageViz(q)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDateDDMMMYYYY(q.updatedAt || q.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-3">
                        {q.isArchived ? (
                          <span className="text-gray-400" title="Archived questions cannot be edited.">
                            Edit
                          </span>
                        ) : (
                          <button
                            onClick={() => navigate(`/admin/question-bank/questions/edit/${encodeURIComponent(q.id)}`)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit question"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          onClick={() => toggleArchive(q)}
                          className={q.isArchived ? 'text-emerald-700 hover:text-emerald-900' : 'text-gray-700 hover:text-gray-900'}
                          title={q.isArchived ? 'Unarchive question' : 'Archive question'}
                        >
                          {q.isArchived ? 'Unarchive' : 'Archive'}
                        </button>
                        <button
                          onClick={() => openDelete(q)}
                          className="text-red-600 hover:text-red-900 inline-flex items-center"
                          title="Delete question"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Pagination
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, id: null, title: '' })}
        onConfirm={confirmDelete}
        title="Delete Question"
        message={`Are you sure you want to delete "${deleteDialog.title}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />

      <ConfirmDialog
        isOpen={archiveDialog.isOpen}
        onClose={() => setArchiveDialog({ isOpen: false, id: null, title: '' })}
        onConfirm={confirmArchive}
        title="Archive Question"
        message={`Are you sure you want to archive "${archiveDialog.title}"? Archived questions cannot be edited and will not be available when composing assessments.`}
      />
    </div>
  );
}

