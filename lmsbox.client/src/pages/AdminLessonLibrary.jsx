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
import api from '../utils/api';
import { FunnelIcon, EyeIcon } from '@heroicons/react/24/outline';

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
  const [previewingId, setPreviewingId] = useState(null);

  // Available categories from global library (will be fetched from API)
  const [availableCategories, setAvailableCategories] = useState([]);
  
  // Track which library lessons are already added to the course by their global library content IDs
  const [courseLessonLibraryIds, setCourseLessonLibraryIds] = useState(new Set());

  // Fetch course details on mount
  useEffect(() => {
    const fetchCourse = async () => {
      try {
        const courseData = await adminCourseService.getCourse(courseId);
        setCourse(courseData);
        
        // Extract global library content IDs from course lessons
        // When lessons are added from global library, they have a globalLibraryContentId reference
        if (courseData && courseData.lessons && Array.isArray(courseData.lessons)) {
          const libraryIds = new Set();
          courseData.lessons.forEach(lesson => {
            // Check if this lesson was imported from the global library
            if (lesson.globalLibraryContentId) {
              libraryIds.add(lesson.globalLibraryContentId);
            }
          });
          setCourseLessonLibraryIds(libraryIds);
          console.log('Course global library content IDs:', Array.from(libraryIds));
        }
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
      
      // Fetch lessons with filters, excluding ones already in this course
      const lessonsData = await lessonsService.getGlobalLibraryLessons(
        selectedContentType,
        selectedCategory,
        courseId  // Pass courseId to exclude already-added lessons
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
      
      // Refetch the course to get the updated GlobalLibraryContentId mappings from the backend
      const updatedCourseData = await adminCourseService.getCourse(courseId);
      if (updatedCourseData && updatedCourseData.lessons && Array.isArray(updatedCourseData.lessons)) {
        const libraryContentIds = new Set();
        updatedCourseData.lessons.forEach(lesson => {
          // Store the GlobalLibraryContentId from the backend
          if (lesson.globalLibraryContentId) {
            libraryContentIds.add(lesson.globalLibraryContentId);
          }
        });
        setCourseLessonLibraryIds(libraryContentIds);
        console.log('Updated course library IDs:', Array.from(libraryContentIds));
      }
      
      const addedLessonCount = selectedLessons.size;
      
      // Clear selection
      setSelectedLessons(new Set());
      
      // Reload library data to remove newly added lessons from the list
      // Backend will now filter them out since they're in the course
      await loadLibraryData();
      
      toast.success(`Added ${addedLessonCount} lesson(s) to your course`);
      
      // Stay on library page - user can click "Back to course" when ready
    } catch (error) {
      console.error('Error adding lessons:', error);
      toast.error('Failed to add lessons to course');
    } finally {
      setAdding(false);
    }
  };

  const handlePreviewContent = async (lesson) => {
    try {
      setPreviewingId(lesson.id);
      
      // Track preview activity
      await api.post('/api/engagement/track-preview', {
        contentId: lesson.id,
        contentTitle: lesson.title,
        contentType: lesson.contentType,
        isLibraryContent: true
      }).catch(err => {
        // Log but don't fail if tracking fails
        console.warn('Failed to track preview activity:', err);
      });

      // Open preview in new tab based on content type
      const previewUrl = getPreviewUrl(lesson);
      if (previewUrl) {
        window.open(previewUrl, '_blank', 'width=1200,height=800');
      } else {
        toast.error('Preview not available for this content type');
      }
    } catch (error) {
      console.error('Error opening preview:', error);
      toast.error('Failed to open preview');
    } finally {
      setPreviewingId(null);
    }
  };

  const getPreviewUrl = (lesson) => {
    // GlobalLibraryLessonDto uses azureBlobPath property
    if (!lesson.azureBlobPath) {
      return null;
    }

    const blobPath = lesson.azureBlobPath;
    const contentType = lesson.contentType.toLowerCase();

    // Construct the full Azure Blob URL if not already absolute
    let fullUrl = blobPath;
    if (!fullUrl.startsWith('http')) {
      // Build the Azure Blob Storage URL
      fullUrl = `https://elgdocstorage.blob.core.windows.net/lms-content/${blobPath}`;
    }

    switch (contentType) {
      case 'scorm':
        // SCORM packages need to be served through the proxy to handle CORS and script injection
        return `/api/scorm-proxy?url=${encodeURIComponent(fullUrl)}`;
      case 'video':
        // Videos can be served directly from Azure Blob
        return fullUrl;
      case 'pdf':
      case 'document':
        // PDFs can be served directly from Azure Blob
        return fullUrl;
      case 'html':
        // HTML content served directly
        return fullUrl;
      default:
        return fullUrl;
    }
  };

  const isLessonAlreadyAdded = (libraryLesson) => {
    // Check if this library lesson is already in the course using the global library content ID
    return courseLessonLibraryIds.has(libraryLesson.id);
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
          <div className="bg-info border border-[#2afeae] rounded-lg p-4 mb-6 flex items-center justify-between">
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
                <div className="relative bg-boxlms-navbar h-48 flex items-center justify-center">
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
                    <div className="flex flex-wrap gap-1 mb-4">
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

                  {/* Action Buttons */}
                  <div className="flex gap-2 border-t border-gray-200 pt-4 mt-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreviewContent(lesson);
                      }}
                      disabled={previewingId === lesson.id}
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-300 text-gray-700 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Preview this content in a new tab"
                    >
                      {previewingId === lesson.id ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span className="hidden sm:inline">Opening...</span>
                        </>
                      ) : (
                        <>
                          <EyeIcon className="w-4 h-4" />
                          <span className="hidden sm:inline">Preview</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Don't toggle if already added to course
                        if (!isLessonAlreadyAdded(lesson)) {
                          const newSelected = new Set(selectedLessons);
                          if (newSelected.has(lesson.id)) {
                            newSelected.delete(lesson.id);
                          } else {
                            newSelected.add(lesson.id);
                          }
                          setSelectedLessons(newSelected);
                        }
                      }}
                      disabled={isLessonAlreadyAdded(lesson)}
                      className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
                        isLessonAlreadyAdded(lesson)
                          ? 'bg-green-100 text-green-700 border border-green-300 cursor-not-allowed'
                          : selectedLessons.has(lesson.id)
                          ? 'bg-boxlms-primary-btn text-boxlms-primary-btn-txt hover:brightness-90 border border-boxlms-primary-btn'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                      title={isLessonAlreadyAdded(lesson) ? 'Already added to course' : selectedLessons.has(lesson.id) ? 'Remove from selection' : 'Add to course'}
                    >
                      {isLessonAlreadyAdded(lesson) ? (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="hidden sm:inline">In Course</span>
                        </>
                      ) : selectedLessons.has(lesson.id) ? (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="hidden sm:inline">Selected</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <span className="hidden sm:inline">Add</span>
                        </>
                      )}
                    </button>
                  </div>
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
