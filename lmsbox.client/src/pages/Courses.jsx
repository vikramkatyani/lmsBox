import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LearnerHeader from '../components/LearnerHeader';
import LearnerLessonProgressReportContent from '../components/LearnerLessonProgressReportContent';
import { CourseGridSkeleton } from '../components/CourseCardSkeleton';
import { getMyCourses, getMyCertificates } from '../services/learnerCourses';
import { deriveLessonStatus, getLearnerDashboardSnapshot } from '../services/learnerDashboard';
import { getMyProfile } from '../services/profile';
import { useDebounce } from '../hooks/useDebounce';
import toast from 'react-hot-toast';
import usePageTitle from '../hooks/usePageTitle';
import { getUserName } from '../utils/auth';

function LearnerStatsCard({ icon, value, label }) {
  return (
    <div className="min-w-[130px] rounded-2xl bg-white/90 p-4 text-center shadow-sm">
      <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-700">
        {icon}
      </div>
      <div className="text-4xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-700">{label}</div>
    </div>
  );
}

const CourseCard = React.memo(function CourseCard({ course, lessons = [], onNavigate, isCertificate = false }) {
  const [hover, setHover] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showLessons, setShowLessons] = useState(false);

  const handleBannerClick = useCallback(() => {
    if (isCertificate && course.certificateUrl) {
      window.open(course.certificateUrl, '_blank');
      return;
    }

    if (isCertificate && !course.certificateUrl) {
      (async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`/api/learner/courses/${course.id}/certificate`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.certificateUrl) {
              window.open(data.certificateUrl, '_blank');
            }
          } else {
            const errorData = await response.json().catch(() => ({}));
            alert(errorData.message || 'Failed to load certificate. Please try again.');
          }
        } catch (error) {
          console.error('Error fetching certificate:', error);
          alert('Network error. Please check your connection and try again.');
        }
      })();
      return;
    }

    onNavigate(course.id);
  }, [course.certificateUrl, course.id, isCertificate, onNavigate]);

  const handleToggleLessons = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    setShowLessons((prev) => !prev);
  }, []);

  const handleMouseEnter = useCallback(() => setHover(true), []);
  const handleMouseLeave = useCallback(() => setHover(false), []);

  const handleImageError = useCallback(() => {
    if (!imageError) {
      setImageError(true);
    }
  }, [imageError]);

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative self-start bg-white rounded-2xl overflow-hidden shadow hover:shadow-lg transition ${isCertificate ? 'cursor-pointer' : ''}`}
      onClick={isCertificate ? handleBannerClick : undefined}
    >
      <div
        className={`relative h-40 bg-gray-100 overflow-hidden ${isCertificate ? '' : 'cursor-pointer'}`}
        onClick={isCertificate ? undefined : handleBannerClick}
      >
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
              {isCertificate ? (
                <svg className="w-8 h-8 text-(--tenant-primary)" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" fill="currentColor" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-(--tenant-primary)" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 3v18l15-9L5 3z" fill="currentColor" />
                </svg>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900">{course.title}</h3>
          {!isCertificate && (
            <button
              type="button"
              onClick={handleToggleLessons}
              className="shrink-0 rounded-full p-1 text-slate-700 hover:bg-slate-100"
              aria-expanded={showLessons}
              aria-label={showLessons ? 'Collapse lesson list' : 'Expand lesson list'}
            >
              <svg
                className={`h-5 w-5 transition-transform ${showLessons ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>

        {isCertificate ? (
          <div className="mt-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Completed {course.certificateIssuedDate ? new Date(course.certificateIssuedDate).toLocaleDateString() : ''}</span>
            </div>
            <button className="w-full bg-(--tenant-primary) text-white font-medium py-2 rounded hover:opacity-90">
              View Certificate
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <div className="mb-3">
              {course.progress >= 100 ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Completed
                </span>
              ) : (course.progress > 0 || course.hasAccessedLessons) ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  In Progress
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                  Not Started
                </span>
              )}
            </div>
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
        )}

        {!isCertificate && showLessons && (
          <div className="mt-4">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Modules</h4>
            {lessons.length === 0 ? (
              <p className="text-sm text-slate-500">No lessons available for this course yet.</p>
            ) : (
              <ul className="space-y-2">
                {lessons.map((lesson, index) => {
                  const status = deriveLessonStatus(lesson);
                  const statusIcon =
                    status === 'Completed' ? (
                      <div className="text-green-600">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    ) : status === 'In Progress' ? (
                      <div className="text-yellow-500">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                          <circle cx="10" cy="10" r="8" />
                        </svg>
                      </div>
                    ) : (
                      <div className="w-5 h-5 shrink-0 border-2 border-gray-300 rounded-full" />
                    );

                  return (
                    <li
                      key={lesson.id || `${course.id}-lesson-${index}`}
                      className="flex items-center gap-3 px-1 py-1.5 text-sm cursor-pointer rounded hover:bg-gray-100 transition-colors"
                      onClick={() => onNavigate(course.id, lesson.id)}
                    >
                      {statusIcon}
                      <div className="font-normal text-slate-900">{lesson.title}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
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
  const [courseLessonsMap, setCourseLessonsMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [learnerWelcome, setLearnerWelcome] = useState({
    firstName: '',
    isFirstLogin: false,
  });
  const [headerStats, setHeaderStats] = useState({
    totalCourses: 0,
    inProgressLessons: 0,
    notStartedLessons: 0,
    totalLessons: 0,
  });

  const debouncedQuery = useDebounce(query, 300);

  const tabParam = params.tab;
  const activeTab = tabParam || initialTab || 'all';

  usePageTitle(
    activeTab === 'progress-report'
      ? 'Progress Report'
      : activeTab === 'certificates'
        ? 'Certificates'
        : 'Courses'
  );

  useEffect(() => {
    let active = true;

    getMyProfile()
      .then((profile) => {
        if (active) {
          setLearnerWelcome({
            firstName: profile.firstName?.trim() || '',
            isFirstLogin: Boolean(profile.isFirstLogin),
          });
        }
      })
      .catch((error) => {
        console.error('Error loading learner welcome details:', error);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    const loadHeaderStats = async () => {
      try {
        const snapshot = await getLearnerDashboardSnapshot(abortController.signal);
        if (!abortController.signal.aborted) {
          const lessonsByCourse = snapshot.courses.reduce((acc, course) => {
            acc[course.id] = Array.isArray(course.lessons) ? course.lessons : [];
            return acc;
          }, {});

          setHeaderStats({
            totalCourses: snapshot.stats.totalCourses,
            inProgressLessons: snapshot.stats.inProgressLessons,
            notStartedLessons: snapshot.stats.notStartedLessons,
            totalLessons: snapshot.stats.totalLessons,
          });
          setCourseLessonsMap(lessonsByCourse);
        }
      } catch (e) {
        if (!abortController.signal.aborted) {
          console.error('Error loading learner header stats:', e);
        }
      }
    };

    loadHeaderStats();
    return () => abortController.abort();
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    const loadCourses = async () => {
      setLoading(true);
      try {
        if (activeTab === 'progress-report') {
          if (!abortController.signal.aborted) {
            setCourses([]);
          }
          return;
        }

        let data;
        if (activeTab === 'certificates') {
          data = await getMyCertificates(abortController.signal);
        } else {
          data = await getMyCourses(debouncedQuery, 'all', abortController.signal);
        }

        if (!abortController.signal.aborted) {
          setCourses(data);
        }
      } catch (e) {
        if (!abortController.signal.aborted) {
          console.error('Error loading courses:', e);
          toast.error('Failed to load courses');
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadCourses();

    return () => {
      abortController.abort();
    };
  }, [activeTab, debouncedQuery]);

  const setTab = useCallback((tab) => {
    setLoading(true);
    navigate(`/courses/${tab}`);
  }, [navigate]);

  const resetFilters = useCallback(() => {
    setQuery('');
    setSort('recently_accessed');
    setProgressFilter('all');
  }, []);

  const visibleCourses = useMemo(() => {
    let list = courses.slice();

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(q));
    }

    if (progressFilter === 'not_started') list = list.filter((c) => c.progress === 0);
    if (progressFilter === 'in_progress') list = list.filter((c) => c.progress > 0 && c.progress < 100);
    if (progressFilter === 'completed') list = list.filter((c) => c.progress >= 100);

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

  const goToCourse = useCallback((id, lessonId = null) => {
    if (lessonId) {
      navigate(`/course/${id}?lessonId=${lessonId}`);
    } else {
      navigate(`/course/${id}`);
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-page-bg">
      <LearnerHeader />

      <div className="p-4 max-w-7xl mx-auto">
        <section className="mb-6 rounded-3xl bg-boxlms-navbar p-6 sm:p-8 text-boxlms-navbar-txt">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex items-center rounded-full bg-white/15 px-4 py-1 text-sm font-medium">
                Learning Journey
              </span>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight">
                {learnerWelcome.isFirstLogin ? 'Welcome' : 'Welcome back'}, {learnerWelcome.firstName || getUserName() || 'Learner'}
              </h2>
              <p className="mt-3 text-lg opacity-90">
                This is your learning area. From here, you can access any courses that you&apos;ve been assigned and see how much progress you have made.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <LearnerStatsCard
                icon={
                  <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                }
                value={headerStats.totalCourses}
                label="Assigned Courses"
              />
              <LearnerStatsCard
                icon={
                  <svg className="h-7 w-7 text-amber-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
                value={
                  <>
                    <span>{headerStats.inProgressLessons}</span>
                    <span className="ml-1 align-top text-lg font-medium text-slate-600">
                      /{headerStats.totalLessons}
                    </span>
                  </>
                }
                label="In Progress Modules"
              />
              <LearnerStatsCard
                icon={
                  <svg className="h-7 w-7 text-slate-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                }
                value={
                  <>
                    <span>{headerStats.notStartedLessons}</span>
                    <span className="ml-1 align-top text-lg font-medium text-slate-600">
                      /{headerStats.totalLessons}
                    </span>
                  </>
                }
                label="Not Started Modules"
              />
            </div>
          </div>
        </section>

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
              Certificates
            </button>
            <button
              onClick={() => setTab('progress-report')}
              className={`py-3 px-1 border-b-2 text-sm font-medium ${activeTab === 'progress-report' ? 'border-(--tenant-primary) text-(--tenant-primary)' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              Progress Report
            </button>
          </nav>
        </div>

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

        {activeTab === 'progress-report' ? (
          <LearnerLessonProgressReportContent />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-start gap-6">
            {loading ? (
              <CourseGridSkeleton count={8} />
            ) : visibleCourses.length === 0 ? (
              <div className="col-span-full text-gray-600">No data found.</div>
            ) : (
              visibleCourses.map((c) => (
                <CourseCard
                  key={c.id}
                  course={c}
                  lessons={courseLessonsMap[c.id] || []}
                  onNavigate={goToCourse}
                  isCertificate={activeTab === 'certificates'}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
