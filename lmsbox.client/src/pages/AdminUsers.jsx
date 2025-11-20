import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';
import { listUsers, deleteUser } from '../services/users';
import { getUserId } from '../utils/auth';
import usePageTitle from '../hooks/usePageTitle';

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState('joinedDate');
  const [sortOrder, setSortOrder] = useState('desc');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    pageSize: 20,
    totalCount: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  usePageTitle('Manage Users');

  useEffect(() => {
    loadUsers();
  }, [page, pageSize, statusFilter, sortBy, sortOrder]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const result = await listUsers({
        page,
        pageSize,
        search: query,
        status: statusFilter === 'all' ? undefined : statusFilter,
        sortBy,
        sortOrder,
      });
      setUsers(result.items || []);
      setPagination(result.pagination || {
        currentPage: 1,
        totalPages: 1,
        pageSize: 20,
        totalCount: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    } catch (e) {
      console.error(e);
      
      // Display detailed error message
      let errorMessage = 'Failed to load users';
      
      if (e.response?.data?.message) {
        errorMessage = e.response.data.message;
      } else if (e.message) {
        errorMessage = e.message;
      }
      
      // Handle specific error cases
      if (e.response?.status === 403) {
        errorMessage = 'You do not have permission to view users.';
      } else if (e.response?.status === 500) {
        errorMessage = 'Server error occurred while loading users. Please try again.';
      } else if (!e.response) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    // Filter out SuperAdmin users from the list
    return users.filter(u => u.role !== 'SuperAdmin');
  }, [users]);

  const currentUserId = getUserId();

  const handleSearch = () => {
    setPage(1); // Reset to first page on search
    loadUsers();
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setPage(1); // Reset to first page when changing page size
  };

  const resetFilters = () => {
    setQuery('');
    setStatusFilter('all');
    setPage(1);
    setSortBy('joinedDate');
    setSortOrder('desc');
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      // Toggle order if clicking the same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column with default ascending order
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1); // Reset to first page when sorting
  };

  const SortIcon = ({ column }) => {
    if (sortBy !== column) {
      return <span className="ml-1 text-gray-400">⇅</span>;
    }
    return sortOrder === 'asc' ? (
      <span className="ml-1 text-blue-600">↑</span>
    ) : (
      <span className="ml-1 text-blue-600">↓</span>
    );
  };

  const onCreate = () => navigate('/admin/users/new');
  const onEdit = (id) => navigate(`/admin/users/${id}/edit`);
  
  const onDelete = async (id) => {
    if (!window.confirm('Delete this user? This action cannot be undone.')) return;
    try {
      const response = await deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      
      // Display success message with details
      const message = response?.message || 'User deleted successfully';
      toast.success(message);
    } catch (e) {
      console.error(e);
      
      // Display detailed error message
      let errorMessage = 'Failed to delete user';
      
      if (e.response?.data?.message) {
        errorMessage = e.response.data.message;
      } else if (e.message) {
        errorMessage = e.message;
      }
      
      // Handle specific error cases
      if (e.response?.status === 404) {
        errorMessage = 'User not found. It may have already been deleted.';
      } else if (e.response?.status === 403) {
        errorMessage = 'You do not have permission to delete this user.';
      } else if (e.response?.status === 409) {
        errorMessage = 'Cannot delete user. The user may have associated data that prevents deletion.';
      } else if (e.response?.status === 500) {
        errorMessage = 'Server error occurred while deleting user. Please try again.';
      } else if (!e.response) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      toast.error(errorMessage);
    }
  };

  // statusBadge helper is unused; remove to satisfy lint

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">User Management</h1>
        
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b flex flex-wrap gap-3 items-center justify-end">
            <div className="flex gap-2">
              <button onClick={onCreate} className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 cursor-pointer">
                Add New User
              </button>
              <button onClick={() => navigate('/admin/users/bulk-new')} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                Bulk Add Users
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className="px-6 py-4 border-b">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[220px]">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                  placeholder="Search users by name or email"
                  className="w-full border border-gray-300 rounded px-4 py-2"
                />
                <span className="absolute right-3 top-2.5 text-gray-400">🔍</span>
              </div>

              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Search
              </button>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded px-3 py-2">
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
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
                  <th 
                    onClick={() => handleSort('firstName')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div className="flex items-center">
                      Name
                      <SortIcon column="firstName" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('email')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div className="flex items-center">
                      Email
                      <SortIcon column="email" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('role')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div className="flex items-center">
                      User Role
                      <SortIcon column="role" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Learning Pathways</th>
                  <th 
                    onClick={() => handleSort('status')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div className="flex items-center">
                      Status
                      <SortIcon column="status" />
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('joinedDate')}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  >
                    <div className="flex items-center">
                      Joined On
                      <SortIcon column="joinedDate" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      {Array.from({ length: 7 }).map((_, colIdx) => (
                        <td key={colIdx} className="px-6 py-4">
                          <div className="h-4 bg-gray-200 rounded w-full"></div>
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">No users found.</td>
                  </tr>
                ) : (
                  filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{u.firstName} {u.lastName}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          u.role === 'Admin' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700">
                          {u.learningPathways && u.learningPathways.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {u.learningPathways.map((name, idx) => (
                                <span key={idx} className="inline-block bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">No pathways</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          u.status === 'Active' ? 'bg-green-100 text-green-800' :
                          u.status === 'Inactive' ? 'bg-gray-100 text-gray-800' :
                          u.status === 'Suspended' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {u.joinedDate ? new Date(u.joinedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => onEdit(u.id)} 
                            className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => onDelete(u.id)} 
                            disabled={u.id === currentUserId}
                            className={`px-3 py-1.5 text-sm rounded ${
                              u.id === currentUserId 
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                : 'bg-red-50 text-red-700 hover:bg-red-100'
                            }`}
                            title={u.id === currentUserId ? 'Cannot delete your own account' : 'Delete user'}
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
