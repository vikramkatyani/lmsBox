import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import Pagination from '../components/Pagination';
import RowActionMenu from '../components/RowActionMenu';
import toast from 'react-hot-toast';
import { listUsers, deleteUser, generateAdminLoginLink } from '../services/users';
import { getUserId } from '../utils/auth';
import { canGenerateLoginLinkInUI, canManageUsersInUI } from '../config/adminFeatureFlags';
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

  const [loginLinkModal, setLoginLinkModal] = useState(null);

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

      let errorMessage = 'Failed to load users';

      if (e.response?.data?.message) {
        errorMessage = e.response.data.message;
      } else if (e.message) {
        errorMessage = e.message;
      }

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
    return users.filter((u) => u.role !== 'SuperAdmin');
  }, [users]);

  const currentUserId = getUserId();
  const canManageUsers = canManageUsersInUI();
  const canGenerateLoginLink = canGenerateLoginLinkInUI();
  const showUserActions = canManageUsers || canGenerateLoginLink;
  const tableColCount = 6 + (showUserActions ? 1 : 0);

  const handleSearch = () => {
    setPage(1);
    loadUsers();
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setPage(1);
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
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setPage(1);
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

  const onEdit = (id) => navigate(`/admin/users/${id}/edit`);

  const openLoginLinkModal = (user) => {
    setLoginLinkModal({
      userId: user.id,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      loading: true,
      url: null,
      expiryDays: null,
      error: null,
    });

    (async () => {
      try {
        const result = await generateAdminLoginLink(user.id);
        setLoginLinkModal((prev) => prev && prev.userId === user.id
          ? {
              ...prev,
              loading: false,
              url: result.url,
              expiryDays: result.expiryDays,
            }
          : prev);
      } catch (e) {
        const message = e.response?.data?.message || e.message || 'Failed to generate login link';
        setLoginLinkModal((prev) => prev && prev.userId === user.id
          ? { ...prev, loading: false, error: message }
          : prev);
      }
    })();
  };

  const closeLoginLinkModal = () => setLoginLinkModal(null);

  const copyLoginLink = async () => {
    if (!loginLinkModal?.url) return;
    try {
      await navigator.clipboard.writeText(loginLinkModal.url);
      toast.success('Login link copied to clipboard');
    } catch {
      toast.error('Failed to copy link to clipboard');
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm('Delete this user? This action cannot be undone.')) return;
    try {
      const response = await deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success(response?.message || 'User deleted successfully');
    } catch (e) {
      console.error(e);

      let errorMessage = 'Failed to delete user';

      if (e.response?.data?.message) {
        errorMessage = e.response.data.message;
      } else if (e.message) {
        errorMessage = e.message;
      }

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

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">User Management</h1>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b flex flex-wrap gap-3 items-center justify-end">
            {canManageUsers && (
              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/admin/users/bulk-new')}
                  className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 cursor-pointer"
                >
                  Add User
                </button>
              </div>
            )}
          </div>

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
                className="px-4 py-2 bg-[#2afeae] text-[#1b365d] rounded hover:bg-[#25e89e]"
              >
                Search
              </button>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border rounded px-3 py-2"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>

              <button onClick={resetFilters} className="text-sm text-gray-700 underline ml-auto">
                Reset
              </button>
            </div>
          </div>

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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Learning Pathways
                  </th>
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
                  {showUserActions && (
                    <th className="px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-14">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      {Array.from({ length: tableColCount }).map((_, colIdx) => (
                        <td key={colIdx} className="px-6 py-4">
                          <div className="h-4 bg-gray-200 rounded w-full"></div>
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={tableColCount} className="px-6 py-8 text-center text-gray-500">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {u.firstName} {u.lastName}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{u.email}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            u.role === 'Admin' ? 'bg-info text-[#1b365d]' : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700">
                          {u.learningPathways && u.learningPathways.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {u.learningPathways.map((name, idx) => (
                                <span
                                  key={idx}
                                  className="inline-block bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs"
                                >
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
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            u.status === 'Active'
                              ? 'bg-green-100 text-green-800'
                              : u.status === 'Inactive'
                                ? 'bg-gray-100 text-gray-800'
                                : u.status === 'Suspended'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {u.joinedDate
                          ? new Date(u.joinedDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : '-'}
                      </td>
                      {showUserActions && (
                        <td className="px-2 py-3 w-14 align-top">
                          <RowActionMenu
                            items={[
                              ...(canGenerateLoginLink
                                ? [{
                                    label: 'Login Link',
                                    variant: 'warning',
                                    title: 'Generate a 30-day reusable login link',
                                    onClick: () => openLoginLinkModal(u),
                                  }]
                                : []),
                              ...(canManageUsers
                                ? [
                                    {
                                      label: 'Edit',
                                      onClick: () => onEdit(u.id),
                                    },
                                    {
                                      label: 'Delete',
                                      danger: true,
                                      disabled: u.id === currentUserId,
                                      title:
                                        u.id === currentUserId
                                          ? 'Cannot delete your own account'
                                          : 'Delete user',
                                      onClick: () => onDelete(u.id),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </td>
                      )}
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

      {loginLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Generate Login Link</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {loginLinkModal.userName}
                </p>
              </div>
              <button
                onClick={closeLoginLinkModal}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {loginLinkModal.loading && (
              <div className="py-8 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
                <p className="text-sm text-gray-600 mt-4">Generating login link...</p>
              </div>
            )}

            {!loginLinkModal.loading && loginLinkModal.error && (
              <div className="py-4">
                <p className="text-sm text-red-600">{loginLinkModal.error}</p>
                <button
                  onClick={closeLoginLinkModal}
                  className="mt-4 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            )}

            {!loginLinkModal.loading && loginLinkModal.url && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  This link is valid for {loginLinkModal.expiryDays || 30} days and can be used multiple times.
                </p>
                <div className="bg-gray-50 border border-gray-200 rounded p-3 text-sm text-gray-800 break-all">
                  {loginLinkModal.url}
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={closeLoginLinkModal}
                    className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Close
                  </button>
                  <button
                    onClick={copyLoginLink}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Copy Link
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
