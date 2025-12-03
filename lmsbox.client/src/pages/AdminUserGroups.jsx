import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';
import { listUserGroups, deleteUserGroup } from '../services/learningPathways';
import usePageTitle from '../hooks/usePageTitle';

export default function AdminUserGroups() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPreviousPage: false
  });

  usePageTitle('Learning Pathways');

  React.useEffect(() => {
    loadGroups();
  }, [page, pageSize]);

  const loadGroups = async (search = query) => {
    setLoading(true);
    try {
      const result = await listUserGroups({ search, page, pageSize });
      setGroups(result.items || []);
      setPagination(result.pagination || pagination);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load learning pathways');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (searchQuery) => {
    setQuery(searchQuery);
    setPage(1); // Reset to first page on search
    loadGroups(searchQuery);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setPage(1); // Reset to first page when changing page size
  };

  const onEdit = (id) => navigate(`/admin/learning-pathways/${id}/edit`);
  const onCreate = () => navigate('/admin/learning-pathways/new');

  const onDelete = async (id) => {
    if (!window.confirm('Delete this learning pathway? Users will lose access to mapped courses.')) return;
    try {
      await deleteUserGroup(id);
      setGroups((prev) => prev.filter((g) => g.id !== id));
      toast.success('Learning pathway deleted');
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete pathway');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Pathways</h1>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b flex flex-wrap gap-3 items-center justify-end">
            <button onClick={onCreate} className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 cursor-pointer">
              Create Pathway
            </button>
          </div>

          <div className="px-6 py-4 border-b">
            <div className="relative">
              <input
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search learning pathways"
                className="w-full border border-gray-300 rounded px-4 py-2"
              />
              <span className="absolute right-3 top-2.5 text-gray-400">🔍</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pathway Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Courses</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      {Array.from({ length: 5 }).map((_, colIdx) => (
                        <td key={colIdx} className="px-6 py-4">
                          <div className="h-4 bg-gray-200 rounded w-full"></div>
                        </td>
                      ))}
                    </tr>
                  ))
                ) : groups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No learning pathways found.</td>
                  </tr>
                ) : (
                  groups.map((g) => (
                    <tr key={g.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{g.name}</div>
                        <div className="text-xs text-gray-500">ID: {g.id}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{g.description || '—'}</td>
                      <td className="px-6 py-4 text-right text-gray-700">{g.courseCount || 0}</td>
                      <td className="px-6 py-4 text-right text-gray-700">{g.userCount || 0}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => onEdit(g.id)} className="px-3 py-1.5 text-sm bg-info text-[#1b365d] rounded hover:bg-[#d9e5f2]">Edit</button>
                          <button onClick={() => onDelete(g.id)} className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            pageSize={pagination.pageSize}
            totalCount={pagination.totalCount}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      </div>
    </div>
  );
}
