import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SuperAdminLayout from '../components/SuperAdminLayout';
import usePageTitle from '../hooks/usePageTitle';
import { getGlobalLibrary, deleteGlobalLibraryContent } from '../services/superAdminApi';
import { 
  PlusIcon, 
  TrashIcon,
  DocumentIcon,
  VideoCameraIcon,
  CubeIcon,
  FunnelIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import ConfirmDialog from '../components/ConfirmDialog';
import SearchableDropdown from '../components/SearchableDropdown';
import Pagination from '../components/Pagination';

export default function SuperAdminLibrary() {
  usePageTitle('Global Library - Super Admin');
  const navigate = useNavigate();
  const [content, setContent] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pdf, video, scorm
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, contentId: null, contentTitle: '' });

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchContent();
  }, [filter, searchQuery, selectedCategory, page]);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const filterType = filter === 'all' ? null : filter;
      const categoryFilter = selectedCategory || null;
      const response = await getGlobalLibrary(filterType, searchQuery || null, categoryFilter, page, pageSize);
      setContent(response.items || []);
      setTotalCount(response.totalCount || 0);
      setTotalPages(response.totalPages || 0);
    } catch (error) {
      console.error('Error fetching content:', error);
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setSearchQuery(searchInput);
    setPage(1); // Reset to first page on new search
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setPage(1); // Reset to first page on category change
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setPage(1); // Reset to first page on filter change
  };

  const fetchCategories = async () => {
    try {
      const data = await fetch('/api/SuperAdmin/global-library/categories', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (data.ok) {
        const cats = await data.json();
        setCategories(cats);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleDeleteClick = (item) => {
    setDeleteDialog({
      isOpen: true,
      contentId: item.id,
      contentTitle: item.title
    });
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteGlobalLibraryContent(deleteDialog.contentId);
      toast.success('Content deleted successfully');
      fetchContent();
    } catch (error) {
      console.error('Error deleting content:', error);
      toast.error('Failed to delete content');
    } finally {
      setDeleteDialog({ isOpen: false, contentId: null, contentTitle: '' });
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <SuperAdminLayout>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      </SuperAdminLayout>
    );
  }

  return (
    <SuperAdminLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Global Library</h1>
              <p className="mt-2 text-sm text-gray-600">
                Manage global content accessible to all organisations
              </p>
            </div>
            <button
              onClick={() => navigate('/superadmin/library/create')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium bg-boxlms-primary-btn text-boxlms-primary-btn-txt hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Add Content
            </button>
          </div>

          {/* Search and Category Filters */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Search Input */}
            <div className="sm:col-span-2">
              <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
                Search Content
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    id="search"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Search by title, description, code, or tags..."
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 pl-10 pr-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
                <button
                  onClick={handleSearch}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <MagnifyingGlassIcon className="h-5 w-5 mr-2" />
                  Search
                </button>
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <SearchableDropdown
                options={categories}
                value={selectedCategory}
                onChange={handleCategoryChange}
                placeholder="Select or type category..."
                label="Filter by Category"
                id="category"
              />
            </div>
          </div>

          {/* Filter tabs */}
          <div className="mt-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { key: 'all', label: 'All Content', count: totalCount },
                { key: 'pdf', label: 'PDF Documents', icon: DocumentIcon },
                { key: 'video', label: 'Videos', icon: VideoCameraIcon },
                { key: 'scorm', label: 'SCORM Packages', icon: CubeIcon }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => handleFilterChange(tab.key)}
                  className={`${
                    filter === tab.key
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm inline-flex items-center`}
                >
                  {tab.icon && <tab.icon className="h-5 w-5 mr-2" />}
                  {tab.label}
                  {filter === 'all' && tab.key === 'all' && (
                    <span className={`ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium ${
                      filter === tab.key ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-900'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content List */}
        {content.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No content</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by adding content to the global library.
            </p>
            <div className="mt-6">
              <button
                onClick={() => navigate('/superadmin/library/create')}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md bg-boxlms-primary-btn text-boxlms-primary-btn-txt hover:brightness-90"
              >
                <PlusIcon className="h-5 w-5 mr-2" />
                Add Content
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Content
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uploaded
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uploaded By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {content.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {item.contentType === 'pdf' ? (
                          <DocumentIcon className="h-8 w-8 text-red-500 shrink-0" />
                        ) : item.contentType === 'video' ? (
                          <VideoCameraIcon className="h-8 w-8 text-blue-500 shrink-0" />
                        ) : (
                          <CubeIcon className="h-8 w-8 text-purple-500 shrink-0" />
                        )}
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{item.title}</div>
                          {item.description && (
                            <div className="text-sm text-gray-500 line-clamp-1">{item.description}</div>
                          )}
                          {item.fileName && (
                            <div className="text-xs text-gray-400 mt-1">{item.fileName}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        item.contentType === 'pdf' 
                          ? 'bg-red-100 text-red-800' 
                          : item.contentType === 'video'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {item.contentType.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.category ? (
                        <span className="inline-flex px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">
                          {item.category}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatFileSize(item.fileSizeBytes)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(item.uploadedOn).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.uploadedBy}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-3">
                        <button
                          onClick={() => navigate(`/superadmin/library/edit/${item.id}`)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit content"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(item)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete content"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </div>
        )}

        {/* Results summary */}
        {content.length > 0 && (
          <div className="mt-4 text-sm text-gray-600 text-center">
            Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount} results
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, contentId: null, contentTitle: '' })}
        onConfirm={handleDeleteConfirm}
        title="Delete Content"
        message={`Are you sure you want to delete "${deleteDialog.contentTitle}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />
    </SuperAdminLayout>
  );
}
