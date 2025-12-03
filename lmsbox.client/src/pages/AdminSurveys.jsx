import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';
import usePageTitle from '../hooks/usePageTitle';
import { adminSurveyService } from '../services/surveys';
import ConfirmDialog from '../components/ConfirmDialog';

export default function AdminSurveys() {
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('updated_desc');
  const [status, setStatus] = useState('all');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, survey: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  usePageTitle('Manage Surveys');

  // Load surveys on component mount and when filters change
  useEffect(() => {
    loadSurveys();
  }, []);

  const loadSurveys = async () => {
    try {
      setLoading(true);
      const data = await adminSurveyService.listSurveys();
      setSurveys(data);
    } catch (error) {
      console.error('Error loading surveys:', error);
      toast.error('Failed to load surveys');
      setSurveys([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSurvey = async (survey) => {
    try {
      await adminSurveyService.deleteSurvey(survey.id);
      toast.success('Survey deleted successfully');
      loadSurveys();
      setDeleteDialog({ open: false, survey: null });
    } catch (error) {
      console.error('Error deleting survey:', error);
      const message = error.response?.data?.message || error.response?.data || 'Failed to delete survey';
      toast.error(message);
    }
  };

  const handleDuplicateSurvey = async (survey) => {
    if (!window.confirm(`Are you sure you want to duplicate "${survey.title}"?\n\nA copy will be created as a draft survey with all questions.`)) {
      return;
    }

    try {
      const loadingToast = toast.loading('Duplicating survey...');
      await adminSurveyService.duplicateSurvey(survey.id);
      toast.dismiss(loadingToast);
      toast.success(`Survey "${survey.title}" duplicated successfully!`);
      loadSurveys();
    } catch (error) {
      console.error('Error duplicating survey:', error);
      const message = error.response?.data?.message || error.response?.data || 'Failed to duplicate survey';
      toast.error(message);
    }
  };

  const handlePublishToggle = async (surveyId) => {
    const survey = surveys.find(s => s.id === surveyId);
    if (!survey) return;
    
    const newStatus = survey.status === 'Draft' ? 'Published' : 'Draft';
    
    try {
      await adminSurveyService.updateSurveyStatus(surveyId, newStatus);
      toast.success(`Survey ${newStatus.toLowerCase()} successfully`);
      loadSurveys();
    } catch (error) {
      console.error('Error updating survey status:', error);
      const message = error.response?.data?.message || error.response?.data || 'Failed to update survey status';
      toast.error(message);
    }
  };

  // Client-side filtering
  const filtered = surveys.filter((s) => {
    const matchesQuery = !query || 
      s.title?.toLowerCase().includes(query.toLowerCase()) || 
      s.description?.toLowerCase().includes(query.toLowerCase());
    
    const matchesStatus = status === 'all' || s.status?.toLowerCase() === status.toLowerCase();
    
    return matchesQuery && matchesStatus;
  });

  // Client-side sorting
  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'updated_desc':
        return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      case 'updated_asc':
        return new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt);
      case 'title_az':
        return (a.title || '').localeCompare(b.title || '');
      case 'title_za':
        return (b.title || '').localeCompare(a.title || '');
      default:
        return 0;
    }
  });

  // Client-side pagination
  const totalCount = sorted.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedSurveys = sorted.slice(startIndex, endIndex);

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setPage(1);
  };

  const resetFilters = () => {
    setQuery('');
    setSort('updated_desc');
    setStatus('all');
    setPage(1);
  };

  const onEdit = (id) => {
    const survey = surveys.find(s => s.id === id);
    if (survey?.status === 'Published') {
      // Preview mode for published surveys
      navigate(`/admin/surveys/edit/${id}?preview=true`);
    } else {
      navigate(`/admin/surveys/edit/${id}`);
    }
  };
  
  const onCreateNew = () => navigate('/admin/surveys/create');

  const statusBadge = (s) => {
    const map = {
      Published: 'bg-green-100 text-green-800',
      Draft: 'bg-gray-100 text-gray-800'
    };
    return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${map[s] || 'bg-gray-100 text-gray-800'}`}>{s}</span>;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Survey Management</h1>

        <div className="bg-white rounded-lg shadow">
          {/* Header and Create button */}
          <div className="px-6 py-4 border-b flex flex-wrap gap-3 items-center justify-end">
            <button onClick={onCreateNew} className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 cursor-pointer">
              Add New Survey
            </button>
          </div>

          {/* Controls */}
          <div className="px-6 py-4 border-b">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[220px]">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search surveys"
                  className="w-full border border-gray-300 rounded px-4 py-2"
                />
                <span className="absolute right-3 top-2.5 text-gray-400">🔍</span>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Sort by</label>
                <select value={sort} onChange={(e) => setSort(e.target.value)} className="border rounded px-3 py-2">
                  <option value="updated_desc">Recently Updated</option>
                  <option value="updated_asc">Oldest Updated</option>
                  <option value="title_az">Title: A to Z</option>
                  <option value="title_za">Title: Z to A</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-3 py-2">
                  <option value="all">All</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                </select>
              </div>

              <button onClick={resetFilters} className="text-sm text-gray-700 underline ml-auto">Reset</button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Questions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      {Array.from({ length: 6 }).map((_, colIdx) => (
                        <td key={colIdx} className="px-6 py-4">
                          <div className="h-4 bg-gray-200 rounded w-full"></div>
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paginatedSurveys.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No surveys found.</td>
                  </tr>
                ) : (
                  paginatedSurveys.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{s.title}</div>
                        {s.description && <div className="text-xs text-gray-500 truncate max-w-xs">{s.description}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">{s.questionCount || 0}</span>
                      </td>
                      <td className="px-6 py-4">{statusBadge(s.status)}</td>
                      <td className="px-6 py-4 text-gray-700">{formatDate(s.updatedAt || s.createdAt)}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => onEdit(s.id)} 
                            className={`px-3 py-1.5 text-sm rounded ${
                              s.status === 'Published' 
                                ? 'bg-gray-50 text-gray-700 hover:bg-gray-100' 
                                : 'bg-info text-blue-700 hover:bg-blue-100'
                            }`}
                          >
                            {s.status === 'Published' ? 'Preview' : 'Edit'}
                          </button>
                          
                          <button 
                            onClick={() => handleDuplicateSurvey(s)} 
                            className="px-3 py-1.5 text-sm bg-info text-[#1b365d] rounded hover:bg-[#d9e5f2]"
                            title="Duplicate survey with all questions"
                          >
                            Duplicate
                          </button>
                          
                          {s.status === 'Draft' && (
                            <button 
                              onClick={() => handlePublishToggle(s.id)} 
                              className="px-3 py-1.5 text-sm bg-success text-green-700 rounded hover:bg-green-100"
                              disabled={!s.questionCount || s.questionCount === 0}
                              title={!s.questionCount || s.questionCount === 0 ? 'Add at least one question before publishing' : 'Publish survey'}
                            >
                              Publish
                            </button>
                          )}
                          
                          {s.status === 'Published' && (
                            <button 
                              onClick={() => handlePublishToggle(s.id)} 
                              className="px-3 py-1.5 text-sm bg-yellow-50 text-yellow-800 rounded hover:bg-yellow-100"
                            >
                              Unpublish
                            </button>
                          )}
                          
                          <button 
                            onClick={() => setDeleteDialog({ open: true, survey: s })} 
                            className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        title="Delete Survey"
        message={`Are you sure you want to delete "${deleteDialog.survey?.title}"? This action cannot be undone.`}
        onConfirm={() => handleDeleteSurvey(deleteDialog.survey)}
        onCancel={() => setDeleteDialog({ open: false, survey: null })}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
