import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import toast from 'react-hot-toast';
import usePageTitle from '../hooks/usePageTitle';

// Mock admin course data (replace with API integration)
const SAMPLE_ADMIN_COURSES = [
  {
    id: 'c1',
    title: 'Cyber Security Essentials for UK Businesses (Level 1)',
    category: 'Security',
    status: 'Active', // Active | Draft | Archived
    updatedAt: '2025-10-15T10:30:00Z',
    learners: 328
  },
  {
    id: 'c2',
    title: 'Effective Workplace Communication: Speak, Listen, Lead',
    category: 'Soft Skills',
    status: 'Draft',
    updatedAt: '2025-10-05T09:00:00Z',
    learners: 42
  },
  {
    id: 'c3',
    title: 'Employee Engagement Through Transparent Communication',
    category: 'HR',
    status: 'Active',
    updatedAt: '2025-09-28T12:00:00Z',
    learners: 117
  },
  {
    id: 'c4',
    title: 'GDPR Compliance & Data Handling Best Practices',
    category: 'Compliance',
    status: 'Archived',
    updatedAt: '2025-08-10T16:45:00Z',
    learners: 980
  }
];

export default function AdminCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState(SAMPLE_ADMIN_COURSES);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('updated_desc');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');

  usePageTitle('Manage Courses');

  const categories = useMemo(() => {
    const set = new Set(courses.map(c => c.category));
    return ['all', ...Array.from(set)];
  }, [courses]);

  const filtered = useMemo(() => {
    let list = courses.slice();
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(c => c.title.toLowerCase().includes(q));
    }
    if (status !== 'all') list = list.filter(c => c.status.toLowerCase() === status);
    if (category !== 'all') list = list.filter(c => c.category === category);

    // sort
    if (sort === 'updated_desc') list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    if (sort === 'updated_asc') list.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
    if (sort === 'title_az') list.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'title_za') list.sort((a, b) => b.title.localeCompare(a.title));
    if (sort === 'learners_desc') list.sort((a, b) => b.learners - a.learners);
    if (sort === 'learners_asc') list.sort((a, b) => a.learners - b.learners);

    return list;
  }, [courses, query, status, category, sort]);

  const resetFilters = () => {
    setQuery('');
    setSort('updated_desc');
    setStatus('all');
    setCategory('all');
  };

  const onEdit = (id) => navigate(`/admin/courses/${id}/edit`);
  const onArchiveToggle = (id) => {
    setCourses(prev => prev.map(c => c.id === id ? { ...c, status: c.status === 'Archived' ? 'Active' : 'Archived' } : c));
    toast.success('Course status updated');
  };
  const onDelete = (id) => {
    if (!window.confirm('Delete this course? This action cannot be undone.')) return;
    setCourses(prev => prev.filter(c => c.id !== id));
    toast.success('Course deleted');
  };
  const onCreateNew = () => navigate('/admin/courses/new');

  const statusBadge = (s) => {
    const map = {
      Active: 'bg-green-100 text-green-800',
      Draft: 'bg-gray-100 text-gray-800',
      Archived: 'bg-yellow-100 text-yellow-800'
    };
    return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${map[s] || 'bg-gray-100 text-gray-800'}`}>{s}</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Course Management</h1>

        <div className="bg-white rounded-lg shadow">
          {/* Header and Create button */}
          <div className="px-6 py-4 border-b flex flex-wrap gap-3 items-center justify-end">
            <button onClick={onCreateNew} className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 cursor-pointer">
              Add New Course
            </button>
          </div>

          {/* Controls */}
          <div className="px-6 py-4 border-b">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[220px]">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search courses"
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
                  <option value="learners_desc">Learners: High to Low</option>
                  <option value="learners_asc">Learners: Low to High</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-3 py-2">
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Category</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className="border rounded px-3 py-2">
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat === 'all' ? 'All' : cat}</option>
                  ))}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Learners</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No courses found.</td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{c.title}</div>
                        <div className="text-xs text-gray-500">ID: {c.id}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-700">{c.category}</td>
                      <td className="px-6 py-4">{statusBadge(c.status)}</td>
                      <td className="px-6 py-4 text-gray-700">{new Date(c.updatedAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right text-gray-700">{c.learners.toLocaleString()}</td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => onEdit(c.id)} className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100">Edit</button>
                          <button onClick={() => onArchiveToggle(c.id)} className="px-3 py-1.5 text-sm bg-yellow-50 text-yellow-800 rounded hover:bg-yellow-100">{c.status === 'Archived' ? 'Unarchive' : 'Archive'}</button>
                          <button onClick={() => onDelete(c.id)} className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100">Delete</button>
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
