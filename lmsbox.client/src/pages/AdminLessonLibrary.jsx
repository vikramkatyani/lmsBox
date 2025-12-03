/**
 * Admin Lesson Library Page
 * 
 * This page allows OrgAdmins to browse and add lessons from the Byte Learning global library
 * to their courses. The global library is managed by SuperAdmins and contains reusable 
 * lesson content that can be added to any course.
 * 
 * Features:
 * - Browse lessons with grid layout
 * - Search by title, description, or tags
 * - Filter by content type (Video, PDF, SCORM, HTML, Quiz)
 * - Multi-select lessons
 * - Add selected lessons to course
 * 
 * API Integration Required:
 * - GET /api/admin/library/lessons - Fetch all available library lessons
 * - POST /api/admin/courses/{courseId}/lessons/from-library - Add lessons from library to course
 * 
 * Navigation:
 * - Accessed from: Admin Course Editor > Add Lesson dropdown > "Browse Byte Learning Library"
 * - Route: /admin/courses/:courseId/library
 * - Returns to: Course editor after adding lessons
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import toast from 'react-hot-toast';
import usePageTitle from '../hooks/usePageTitle';
import lessonsService from '../services/lessons';
import { adminCourseService } from '../services/adminCourses';
import { FunnelIcon } from '@heroicons/react/24/outline';

export default function AdminLessonLibrary() {
  usePageTitle('Lesson Library - Byte Learning');
  
  const navigate = useNavigate();
  const { courseId } = useParams();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || `/admin/courses/${courseId}/edit`;
  
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContentType, setSelectedContentType] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedLessons, setSelectedLessons] = useState(new Set());
  const [adding, setAdding] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  // Available categories from global library (will be fetched from API)
  const [availableCategories, setAvailableCategories] = useState([]);

  // Fetch course details on mount
  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const courseData = await adminCourseService.getCourse(courseId);
        setCourse(courseData);
      } catch (error) {
        console.error('Error fetching course:', error);
        toast.error('Failed to load course details');
      }
    };
    fetchCourse();
  }, [courseId]);

  // Load library lessons and categories on mount
  useEffect(() => {
    loadLibraryData();
  }, [selectedContentType, selectedCategory]);

  const loadLibraryData = async () => {
    setLoading(true);
    try {
      // Fetch categories
      const categoriesData = await lessonsService.getGlobalLibraryCategories();
      setAvailableCategories(Array.isArray(categoriesData) ? categoriesData : []);
      
      // Fetch lessons with filters
      const lessonsData = await lessonsService.getGlobalLibraryLessons(
        selectedContentType,
        selectedCategory
      );
      setLessons(Array.isArray(lessonsData) ? lessonsData : []);
    } catch (error) {
      console.error('Error loading library data:', error);
      toast.error('Failed to load library content');
      // Ensure arrays are set even on error
      setAvailableCategories([]);
      setLessons([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredLessons = lessons.filter(lesson => {
    const matchesSearch = lesson.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (lesson.description && lesson.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                         (lesson.tags && lesson.tags.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const toggleLessonSelection = (lessonId) => {
    setSelectedLessons(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lessonId)) {
        newSet.delete(lessonId);
      } else {
        newSet.add(lessonId);
      }
      return newSet;
    });
  };

  const handleAddLessons = async () => {
    if (selectedLessons.size === 0) {
      toast.error('Please select at least one lesson');
      return;
    }

    setAdding(true);
    try {
      const lessonIds = Array.from(selectedLessons);
      console.log('Adding lessons to course:', { courseId, lessonIds });
      
      await lessonsService.addLessonsFromLibrary(courseId, lessonIds);
      toast.success(`Added ${selectedLessons.size} lesson(s) to your course`);
      navigate(returnUrl);
    } catch (error) {
      console.error('Error adding lessons:', error);
      console.error('Error details:', error.response?.data);
      toast.error(error.response?.data?.message || 'Failed to add lessons to course');
    } finally {
      setAdding(false);
    }
  };

  const getLessonIcon = (contentType) => {
    switch (contentType) {
      case 'video': return '🎥';
      case 'pdf': return '📄';
      case 'scorm': return '📦';
      case 'html': return '🌐';
      default: return '📄';
    }
  };

  const getLessonTypeLabel = (contentType) => {
    switch (contentType) {
      case 'video': return 'Video';
      case 'pdf': return 'PDF';
      case 'scorm': return 'SCORM';
      case 'html': return 'HTML';
      default: return contentType;
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds || seconds === 0) return null;
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    } else if (minutes > 0) {
      return `${minutes}:${String(secs).padStart(2, '0')}`;
    } else {
      return `0:${String(secs).padStart(2, '0')}`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Byte Learning Library</h1>
              {course && (
                <p className="text-gray-600 mt-1">
                  Adding lessons to: <span className="font-semibold text-gray-900">{course.title}</span>
                </p>
              )}
            </div>
            <button
              onClick={() => navigate(returnUrl)}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
            >
              ← Back to Course
            </button>
          </div>
        </div>

        {/* Search Bar - Full Width */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, description, or tags..."
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base"
          />
        </div>

        {/* Category Pills with Filter Icon */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-start gap-3">
            {/* Filter Icon - Clickable to expand/collapse */}
            <button
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className={`p-2 rounded-lg transition-colors shrink-0 ${
                filtersExpanded
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="Toggle filters"
            >
              <FunnelIcon className="w-5 h-5" />
            </button>

            {/* Horizontal Category List */}
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-[#2afeae] text-[#1b365d]'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {Array.isArray(availableCategories) && availableCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === category
                      ? 'bg-[#2afeae] text-[#1b365d]'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Expanded Filters Section */}
          {filtersExpanded && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Content Type Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Content Type
                  </label>
                  <select
                    value={selectedContentType}
                    onChange={(e) => setSelectedContentType(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  >
                    <option value="all">All Types</option>
                    <option value="video">Videos</option>
                    <option value="pdf">Documents</option>
                    <option value="scorm">SCORM</option>
                    <option value="html">Interactive</option>
                  </select>
                </div>
                {/* Placeholder for future filters */}
              </div>
            </div>
          )}
        </div>

        {/* Selection Summary */}
        {selectedLessons.size > 0 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div>
              <p className="text-indigo-900 font-medium">
                {selectedLessons.size} lesson{selectedLessons.size > 1 ? 's' : ''} selected
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedLessons(new Set())}
                className="px-4 py-2 text-[#1b365d] bg-white border border-[#2afeae] rounded hover:bg-[#e8fdf6]"
              >
                Clear Selection
              </button>
              <button
                onClick={handleAddLessons}
                disabled={adding}
                className="px-6 py-2 bg-[#2afeae] text-[#1b365d] rounded hover:bg-[#25e89e] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? 'Adding...' : 'Add to Course'}
              </button>
            </div>
          </div>
        )}

        {/* Lessons Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Loading lessons...</div>
          </div>
        ) : filteredLessons.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📚</div>
            <p className="text-gray-600 text-lg">No lessons found matching your criteria</p>
            <p className="text-gray-500 mt-2">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLessons.map(lesson => (
              <div
                key={lesson.id}
                onClick={() => toggleLessonSelection(lesson.id)}
                className={`bg-white rounded-lg shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                  selectedLessons.has(lesson.id)
                    ? 'ring-2 ring-indigo-500 shadow-lg'
                    : 'hover:ring-1 hover:ring-gray-300'
                }`}
              >
                {/* Thumbnail */}
                <div className="relative bg-gradient-to-br from-indigo-500 to-purple-600 h-48 flex items-center justify-center">
                  <div className="text-white text-6xl opacity-80">
                    {getLessonIcon(lesson.contentType)}
                  </div>
                  {selectedLessons.has(lesson.id) && (
                    <div className="absolute top-3 right-3 bg-[#2afeae] text-[#1b365d] rounded-full p-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  {/* Type and Category Badges */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                      <span>{getLessonIcon(lesson.contentType)}</span>
                      <span>{getLessonTypeLabel(lesson.contentType)}</span>
                    </span>
                    {lesson.category && (
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">
                        {lesson.category}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                    {lesson.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {lesson.description}
                  </p>

                  {/* Meta Info */}
                  {formatDuration(lesson.durationSeconds) && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{formatDuration(lesson.durationSeconds)}</span>
                    </div>
                  )}

                  {/* Tags */}
                  {lesson.tags && (
                    <div className="flex flex-wrap gap-1">
                      {lesson.tags.split(',').slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className="px-2 py-0.5 bg-[#e8fdf6] text-[#1b365d] text-xs rounded"
                        >
                          {tag.trim()}
                        </span>
                      ))}
                      {lesson.tags.split(',').length > 3 && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                          +{lesson.tags.split(',').length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Fixed bottom action bar for mobile */}
        {selectedLessons.size > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg md:hidden z-50">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-gray-700">
                {selectedLessons.size} selected
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedLessons(new Set())}
                  className="px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded"
                >
                  Clear
                </button>
                <button
                  onClick={handleAddLessons}
                  disabled={adding}
                  className="px-4 py-2 text-sm bg-[#2afeae] text-[#1b365d] rounded disabled:opacity-50"
                >
                  {adding ? 'Adding...' : 'Add to Course'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
