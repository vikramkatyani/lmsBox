import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import toast from 'react-hot-toast';
import { listUsers, deleteUser } from '../services/users';

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async (search = '') => {
    setLoading(true);
    try {
      const items = await listUsers(search);
      setUsers(items);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = users.slice();
    
    // Search
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((u) => 
        u.firstName?.toLowerCase().includes(q) || 
        u.lastName?.toLowerCase().includes(q) || 
        u.email?.toLowerCase().includes(q)
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter((u) => u.status?.toLowerCase() === statusFilter);
    }
    
    return list;
  }, [users, query, statusFilter]);

  const resetFilters = () => {
    setQuery('');
    setStatusFilter('all');
  };

  const onCreate = () => navigate('/admin/users/new');
  const onEdit = (id) => navigate(`/admin/users/${id}/edit`);
  
  const onDelete = async (id) => {
    if (!window.confirm('Delete this user? This action cannot be undone.')) return;
    try {
      await deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success('User deleted');
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete user');
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
            <button onClick={onCreate} className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 cursor-pointer">
              Add New User
            </button>
          </div>

          {/* Controls */}
          <div className="px-6 py-4 border-b">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[220px]">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search users by name or email"
                  className="w-full border border-gray-300 rounded px-4 py-2"
                />
                <span className="absolute right-3 top-2.5 text-gray-400">🔍</span>
              </div>

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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Groups</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined On</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">Loading...</td>
                  </tr>
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
                          {u.groupNames && u.groupNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {u.groupNames.map((name, idx) => (
                                <span key={idx} className="inline-block bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">No groups</span>
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
                          <button onClick={() => onEdit(u.id)} className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100">Edit</button>
                          <button onClick={() => onDelete(u.id)} className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
