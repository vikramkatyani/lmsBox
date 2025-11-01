import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LearnerHeader from '../components/LearnerHeader';
import { CourseGridSkeleton } from '../components/CourseCardSkeleton';
import { getMyCourses, getMyCertificates } from '../services/learnerCourses';
import { useDebounce } from '../hooks/useDebounce';
import toast from 'react-hot-toast';

const CourseCard = React.memo(function CourseCard({ course, onNavigate }) {
  const [hover, setHover] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleClick = useCallback(() => {
    onNavigate(course.id);
  }, [course.id, onNavigate]);

  const handleMouseEnter = useCallback(() => setHover(true), []);
  const handleMouseLeave = useCallback(() => setHover(false), []);

  const handleImageError = useCallback(() => {
    if (!imageError) {
      setImageError(true);
    }
  }, [imageError]);

  return (
    <div
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative bg-white rounded overflow-hidden shadow hover:shadow-lg cursor-pointer transition"
    >
      <div className="relative h-40 bg-gray-100 overflow-hidden">
        <img 
          src={imageError ? '/assets/default-course-banner.png' : course.banner} 
          alt={course.title} 
          loading="lazy"
          className={`w-full h-full object-cover transition-transform ${hover ? 'scale-105 filter blur-sm brightness-75' : ''}`}
          onError={handleImageError}
        />
        {hover && (
            <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-white/60 rounded-full p-3">
              <svg className="w-8 h-8 text-(--tenant-primary)" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 3v18l15-9L5 3z" fill="currentColor" />
              </svg>
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900">{course.title}</h3>

        <div className="mt-4">
          <div className="h-2 bg-gray-200 rounded overflow-hidden">
            <div className="h-full bg-(--tenant-primary)" style={{ width: `${Math.min(100, course.progress)}%` }} />
          </div>
          <div className="mt-2 text-sm text-gray-600">
            {course.progress === 0 ? (
              <span className="inline-block bg-(--tenant-primary) text-white text-xs font-medium px-3 py-1 rounded">START COURSE</span>
            ) : (
              <span>{course.progress}% complete</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default function Courses({ initialTab = {} }) {
  const params = useParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recently_accessed');
  const [progressFilter, setProgressFilter] = useState('all');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);

  // Debounce search query to avoid excessive API calls
  const debouncedQuery = useDebounce(query, 300);

  // Determine active tab: precedence -> url param -> initialTab prop -> default 'all'
  const tabParam = params.tab;
  const activeTab = tabParam || initialTab || 'all';

  useEffect(() => {
    const pageTitle = import.meta.env.VITE_APP_TITLE ? `${import.meta.env.VITE_APP_TITLE} - Courses` : 'LMS Box - Courses';
    document.title = pageTitle;
  }, []);

  // Load courses when tab changes or search query changes
  useEffect(() => {
    // Create an AbortController for this request
    const abortController = new AbortController();
    
    const loadCourses = async () => {
      setLoading(true);
      try {
        let data;
        if (activeTab === 'certificates') {
          data = await getMyCertificates(abortController.signal);
        } else {
          // Use debounced query for search
          data = await getMyCourses(debouncedQuery, 'all', abortController.signal);
        }
        
        // Only update state if the request wasn't aborted
        if (!abortController.signal.aborted) {
          setCourses(data);
        }
      } catch (e) {
        // Don't show error if the request was intentionally aborted
        if (!abortController.signal.aborted) {
          console.error('Error loading courses:', e);
          toast.error('Failed to load courses');
        }
      } finally {
        // Only update loading state if the request wasn't aborted
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadCourses();

    // Cleanup function to abort the request if activeTab changes
    return () => {
      abortController.abort();
    };
  }, [activeTab, debouncedQuery]); // Use debouncedQuery instead of direct query

  const setTab = useCallback((tab) => {
    // Reset loading state when changing tabs to provide immediate feedback
    setLoading(true);
    // navigate to path-based tab
    navigate(`/courses/${tab}`);
  }, [navigate]);

  const resetFilters = useCallback(() => {
    setQuery('');
    setSort('recently_accessed');
    setProgressFilter('all');
  }, []);

  // Filter and sort courses based on current controls
  const visibleCourses = useMemo(() => {
    let list = courses.slice();

    // Search (client-side for now)
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(q));
    }

    // Progress filter (client-side)
    if (progressFilter === 'not_started') list = list.filter((c) => c.progress === 0);
    if (progressFilter === 'in_progress') list = list.filter((c) => c.progress > 0 && c.progress < 100);
    if (progressFilter === 'completed') list = list.filter((c) => c.progress >= 100);

    // Sort
    if (sort === 'title_az') list.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'title_za') list.sort((a, b) => b.title.localeCompare(a.title));
    if (sort === 'recently_enrolled') {
      list.sort((a, b) => {
        const dateA = a.enrolledDate ? new Date(a.enrolledDate) : new Date(0);
        const dateB = b.enrolledDate ? new Date(b.enrolledDate) : new Date(0);
        return dateB - dateA;
      });
    }
    if (sort === 'recently_accessed') {
      list.sort((a, b) => {
        const dateA = a.lastAccessedDate ? new Date(a.lastAccessedDate) : new Date(0);
        const dateB = b.lastAccessedDate ? new Date(b.lastAccessedDate) : new Date(0);
        return dateB - dateA;
      });
    }

    return list;
  }, [courses, query, sort, progressFilter]);

  const goToCourse = useCallback((id) => {
    navigate(`/course/${id}`);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-page-bg">
      <LearnerHeader />

      <div className="p-4 max-w-7xl mx-auto">
        <h1 className="text-3xl font-semibold text-gray-900 mb-6">My learning</h1>

        

        {/* Tab buttons */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setTab('all')}
              className={`py-3 px-1 border-b-2 text-sm font-medium ${activeTab === 'all' ? 'border-(--tenant-primary) text-(--tenant-primary)' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              All courses
            </button>
            <button
              onClick={() => setTab('certificates')}
              className={`py-3 px-1 border-b-2 text-sm font-medium ${activeTab === 'certificates' ? 'border-(--tenant-primary) text-(--tenant-primary)' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              Certifications
            </button>
          </nav>
        </div>

        {/* Controls shown only for All courses tab */}
        {activeTab === 'all' && (
          <div className="flex flex-wrap items-center gap-4 mb-10">
            <div className="flex-1 min-w-[220px]">
              <div className="relative">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search my courses`}
                  className="w-full border border-gray-300 rounded px-4 py-2"
                />
                <button className="absolute right-1 top-1.5 bg-(--tenant-primary) text-white px-3 py-1 rounded">
                  🔍
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">Sort by</label>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="border rounded px-3 py-2">
                <option value="recently_accessed">Recently Accessed</option>
                <option value="recently_enrolled">Recently Enrolled</option>
                <option value="title_az">Title: A to Z</option>
                <option value="title_za">Title: Z to A</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">Filter by</label>
              <select value={progressFilter} onChange={(e) => setProgressFilter(e.target.value)} className="border rounded px-3 py-2">
                <option value="all">All progress</option>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <button onClick={resetFilters} className="text-sm text-gray-700 underline ml-2">Reset</button>
          </div>
        )}

        {/* Grid of cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            <CourseGridSkeleton count={8} />
          ) : visibleCourses.length === 0 ? (
            <div className="col-span-full text-gray-600">No data found.</div>
          ) : (
            visibleCourses.map((c) => (
              <CourseCard key={c.id} course={c} onNavigate={goToCourse} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
