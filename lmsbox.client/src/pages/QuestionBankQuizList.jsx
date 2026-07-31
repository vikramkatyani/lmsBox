import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import SuperAdminLayout from '../components/SuperAdminLayout';
import usePageTitle from '../hooks/usePageTitle';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  deleteQuestionBankQuiz,
  listQuestionBankQuizzes,
} from '../services/quizzes';
import { MagnifyingGlassIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function QuestionBankQuizList() {
  usePageTitle('Question Bank - Super Admin');
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, quizId: null, title: '' });

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await listQuestionBankQuizzes(searchQuery);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load question bank quizzes', e);
      toast.error('Failed to load Question Bank assessments');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
  };

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const da = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const db = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return db - da;
    });
  }, [items]);

  const openDelete = (quiz) => {
    setDeleteDialog({
      isOpen: true,
      quizId: quiz.id,
      title: quiz.title,
    });
  };

  const confirmDelete = async () => {
    const { quizId } = deleteDialog;
    if (!quizId) return;
    try {
      await deleteQuestionBankQuiz(quizId);
      toast.success('Question Bank assessment deleted');
      setDeleteDialog({ isOpen: false, quizId: null, title: '' });
      fetchItems();
    } catch (e) {
      console.error('Failed to delete question bank quiz', e);
      toast.error(e.response?.data?.message || 'Failed to delete assessment');
      setDeleteDialog({ isOpen: false, quizId: null, title: '' });
    }
  };

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Question Bank</h1>
              <p className="mt-2 text-sm text-gray-600">
                Create reusable assessments and import them into courses.
              </p>
            </div>
            <button
              onClick={() => navigate('/admin/question-bank/quizzes/create')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium bg-boxlms-primary-btn text-boxlms-primary-btn-txt hover:brightness-90"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Create Assessment
            </button>
          </div>

          <div className="mt-6">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              Search assessments
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  id="search"
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by title or description..."
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 pl-10 pr-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
              </div>
              <button
                onClick={handleSearch}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
              >
                <MagnifyingGlassIcon className="h-5 w-5 mr-2" />
                Search
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-10">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <h3 className="mt-2 text-sm font-medium text-gray-900">No assessments found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Create your first Question Bank assessment to reuse across courses.
            </p>
            <div className="mt-6">
              <button
                onClick={() => navigate('/admin/question-bank/quizzes/create')}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md bg-boxlms-primary-btn text-boxlms-primary-btn-txt hover:brightness-90"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Create Assessment
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assessment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Questions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Passing
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
                {sortedItems.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{q.title}</div>
                      {q.description && (
                        <div className="text-sm text-gray-500 line-clamp-1">{q.description}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-1">{q.id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {q.questionCount ?? 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {q.passingScore ?? 70}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(q.updatedAt || q.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-3">
                        <button
                          onClick={() => navigate(`/admin/question-bank/quizzes/edit/${encodeURIComponent(q.id)}`)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit assessment"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openDelete(q)}
                          className="text-red-600 hover:text-red-900 inline-flex items-center"
                          title="Delete assessment"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, quizId: null, title: '' })}
        onConfirm={confirmDelete}
        title="Delete Question Bank Assessment"
        message={`Are you sure you want to delete "${deleteDialog.title}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />
    </SuperAdminLayout>
  );
}

