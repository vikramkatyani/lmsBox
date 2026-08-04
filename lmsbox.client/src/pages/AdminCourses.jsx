import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';
import usePageTitle from '../hooks/usePageTitle';
import { adminCourseService, courseHelpers } from '../services/adminCourses';
import ConfirmDialog from '../components/ConfirmDialog';

export default function AdminCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('updated_desc');
  const [status, setStatus] = useState('all');
  const [category, setCategory] = useState('all');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, course: null });
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuPosition, setMenuPosition] = useState(null);
  const menuRef = useRef(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 20,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPreviousPage: false
  });

  usePageTitle('Manage Courses');

  // Load courses on component mount and when filters change
  useEffect(() => {
    loadCourses();
  }, [query, sort, status, category, page, pageSize]);

  useEffect(() => {
    if (!openMenuId) return undefined;

    const closeMenu = () => {
      setOpenMenuId(null);
      setMenuPosition(null);
    };

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        closeMenu();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [openMenuId]);

  useEffect(() => {
    setOpenMenuId(null);
    setMenuPosition(null);
  }, [query, sort, status, category, page, pageSize]);

  const toggleCourseMenu = (courseId, event) => {
    if (openMenuId === courseId) {
      setOpenMenuId(null);
      setMenuPosition(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const estimatedMenuHeight = 240;
    const openUpward = window.innerHeight - rect.bottom < estimatedMenuHeight;

    setMenuPosition(
      openUpward
        ? { bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right }
        : { top: rect.bottom + 4, right: window.innerWidth - rect.right }
    );
    setOpenMenuId(courseId);
  };

  const closeCourseMenu = () => {
    setOpenMenuId(null);
    setMenuPosition(null);
  };

  const loadCourses = async () => {
    try {
      setLoading(true);
      const response = await adminCourseService.listCourses({
        page,
        pageSize,
        search: query.trim() || undefined,
        status: status !== 'all' ? status : undefined,
        category: category !== 'all' ? category : undefined,
        sortBy: sort.split('_')[0],
        sortOrder: sort.split('_')[1] || 'desc'
      });
      
      const formattedCourses = response.courses.map(courseHelpers.formatCourseForDisplay);
      setCourses(formattedCourses);
      setPagination(response.pagination || pagination);
    } catch (error) {
      console.error('Error loading courses:', error);
      toast.error('Failed to load courses');
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setPage(1);
  };

  const categories = useMemo(() => {
    const categoryOptions = courseHelpers.getCategoryOptions();
    return ['all', ...categoryOptions.map(opt => opt.value)];
  }, []);

  const handleDeleteCourse = async (course) => {
    try {
      await adminCourseService.deleteCourse(course.id);
      toast.success('Course deleted successfully');
      loadCourses(); // Reload the list
      setDeleteDialog({ open: false, course: null });
    } catch (error) {
      console.error('Error deleting course:', error);
      const { message, details } = error.response?.data || {};
      toast.error([message || 'Failed to delete course', details].filter(Boolean).join(': '));
    }
  };

  const handleDuplicateCourse = async (course) => {
    if (!window.confirm(`Are you sure you want to duplicate "${course.title}"?\n\nA copy will be created as a draft course with all lessons and quizzes.`)) {
      return;
    }

    const loadingToast = toast.loading('Duplicating course...');
    try {
      const copy = await adminCourseService.duplicateCourse(course.id);
      toast.dismiss(loadingToast);
      toast.success(copy?.title
        ? `Created "${copy.title}" as a draft.`
        : `Course "${course.title}" duplicated successfully!`);
      loadCourses(); // Reload the list to show the new course
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('Error duplicating course:', error);
      const message = error.response?.data?.message || 'Failed to duplicate course';
      toast.error(message);
    }
  };

  const filtered = courses; // Filtering is now done on the server side

  const resetFilters = () => {
    setQuery('');
    setSort('updated_desc');
    setStatus('all');
    setCategory('all');
  };

  const onEdit = (id) => navigate(`/admin/courses/${id}/edit`);

  const onPreview = (id) => adminCourseService.openCoursePreview(id);
  
  const handlePublishToggle = async (courseId) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    
    const newStatus = course.status === 'Draft' ? 'Published' : 'Draft';
    
    try {
      await adminCourseService.updateCourseStatus(courseId, newStatus);
      toast.success(`Course ${newStatus.toLowerCase()} successfully`);
      loadCourses(); // Reload the list
    } catch (error) {
      console.error('Error updating course status:', error);
      console.error('Error response:', error.response);
      
      // Handle validation errors from backend
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const errorList = error.response.data.errors.join('\n');
        toast.error(`${error.response.data.message}\n${errorList}`, { duration: 6000 });
      } else {
        const message = error.response?.data?.message || 'Failed to update course status';
        toast.error(message);
      }
    }
  };

  const onArchiveToggle = async (courseId) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;
    
    const newStatus = course.status === 'Archived' ? 'Published' : 'Archived';
    try {
      await adminCourseService.updateCourseStatus(courseId, newStatus);
      toast.success(`Course ${newStatus === 'Archived' ? 'archived' : 'unarchived'} successfully`);
      loadCourses(); // Reload the list
    } catch (error) {
      console.error('Error updating course status:', error);
      toast.error('Failed to update course status');
    }
  };

  const onDelete = (course) => {
    setDeleteDialog({ open: true, course });
  };
  
  const onCreateNew = () => navigate('/admin/courses/new');

  const statusBadge = (s) => {
    const map = {
      Published: 'bg-green-100 text-green-800',
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
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-3 py-2">
                  <option value="all">All</option>
                  <option value="published">Published</option>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lessons</th>
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
                ) : filtered.length === 0 ? (
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
                      <td className="px-6 py-4 text-gray-700">{c.category || 'Uncategorized'}</td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => navigate(`/admin/courses/${c.id}/edit?tab=lessons`)}
                          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                          title="View lessons"
                        >
                          {c.lessonCount || 0}
                        </button>
                      </td>
                      <td className="px-6 py-4">{statusBadge(c.statusDisplay)}</td>
                      <td className="px-6 py-4 text-gray-700">{c.updatedAt}</td>
                      <td className="px-6 py-4">
                        <div className="relative flex justify-end" ref={openMenuId === c.id ? menuRef : null}>
                          <button
                            type="button"
                            onClick={(event) => toggleCourseMenu(c.id, event)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                            aria-label={`Actions for ${c.title}`}
                            aria-haspopup="menu"
                            aria-expanded={openMenuId === c.id}
                            title="Actions"
                          >
                            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                              <path d="M10 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
                            </svg>
                          </button>

                          {openMenuId === c.id && menuPosition && (
                            <div
                              role="menu"
                              className="fixed z-50 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
                              style={{
                                top: menuPosition.top,
                                bottom: menuPosition.bottom,
                                right: menuPosition.right,
                              }}
                            >
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  closeCourseMenu();
                                  onPreview(c.id);
                                }}
                                className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                              >
                                Preview
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  closeCourseMenu();
                                  onEdit(c.id);
                                }}
                                className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  closeCourseMenu();
                                  handleDuplicateCourse(c);
                                }}
                                className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                              >
                                Duplicate
                              </button>
                              {c.status === 'Draft' && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    closeCourseMenu();
                                    handlePublishToggle(c.id);
                                  }}
                                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  Publish
                                </button>
                              )}
                              {c.status !== 'Archived' ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    closeCourseMenu();
                                    onArchiveToggle(c.id);
                                  }}
                                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  Archive
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    closeCourseMenu();
                                    onArchiveToggle(c.id);
                                  }}
                                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                >
                                  Unarchive
                                </button>
                              )}
                              <div className="my-1 border-t border-gray-100" />
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  closeCourseMenu();
                                  onDelete(c);
                                }}
                                className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          )}
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

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        title="Delete Course"
        message={`Are you sure you want to delete "${deleteDialog.course?.title}"? This action cannot be undone.`}
        onConfirm={() => handleDeleteCourse(deleteDialog.course)}
        onCancel={() => setDeleteDialog({ open: false, course: null })}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
