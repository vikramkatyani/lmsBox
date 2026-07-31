import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import usePageTitle from '../hooks/usePageTitle';
import { getFavoriteReports, updateFavoriteReports } from '../services/profile';
import {
  ChartBarIcon,
  UserGroupIcon,
  AcademicCapIcon,
  DocumentChartBarIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  BookOpenIcon,
  MapIcon,
  ChartPieIcon,
  ClipboardDocumentListIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { HardDrive } from 'lucide-react';

export default function AdminReports() {
  usePageTitle('Reports & Analytics');
  const [activeCategory, setActiveCategory] = useState(null);
  const [favoriteReportIds, setFavoriteReportIds] = useState([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [togglingFavoriteId, setTogglingFavoriteId] = useState(null);

  const reportCategories = [
    { id: 'favorites', name: 'Favourites', icon: StarIcon },
    { id: 'users', name: 'Users & Engagement', icon: UserGroupIcon },
    { id: 'courses', name: 'Course Analytics', icon: AcademicCapIcon },
    { id: 'pathways', name: 'Learning Pathways', icon: MapIcon },
    { id: 'admin', name: 'Administrative', icon: ChartBarIcon },
    { id: 'all', name: 'All Reports', icon: DocumentChartBarIcon }
  ];

  const reports = [
    {
      id: 'user-activity',
      name: 'User Activity Report',
      description: 'Track user login frequency, last active date, and identify idle users',
      category: 'users',
      icon: ClockIcon,
      path: '/admin/reports/user-activity',
      color: 'bg-[#2afeae]'
    },
    {
      id: 'user-progress',
      name: 'User Progress Report',
      description: 'View individual user progress across all courses and learning pathways',
      category: 'users',
      icon: ArrowTrendingUpIcon,
      path: '/admin/reports/user-progress',
      color: 'bg-[#1b365d]'
    },
    {
      id: 'time-tracking',
      name: 'Time Tracking & Engagement',
      description: 'Detailed time spent analytics by users, courses, and lessons with engagement metrics',
      category: 'users',
      icon: ClockIcon,
      path: '/admin/reports/time-tracking',
      color: 'bg-rose-500'
    },
    {
      id: 'engagement-analytics',
      name: 'Engagement Analytics',
      description: 'Real-time engagement tracking with daily scores, top users, and activity breakdown',
      category: 'users',
      icon: ChartPieIcon,
      path: '/admin/analytics/engagement',
      color: 'bg-purple-600'
    },
    {
      id: 'course-enrollment',
      name: 'Course Enrollment Report',
      description: 'Analyse enrollment trends over time across all courses',
      category: 'courses',
      icon: AcademicCapIcon,
      path: '/admin/reports/course-enrollment',
      color: 'bg-[#36454F]'
    },
    {
      id: 'course-completion',
      name: 'Course Completion Report',
      description: 'Track course completion rates and average completion time',
      category: 'courses',
      icon: ChartBarIcon,
      path: '/admin/reports/course-completion',
      color: 'bg-[#2afeae]'
    },
    {
      id: 'lesson-analytics',
      name: 'Lesson Analytics Report',
      description: 'Per-lesson analytics including views, completions, and assessment performance',
      category: 'courses',
      icon: BookOpenIcon,
      path: '/admin/reports/lesson-analytics',
      color: 'bg-yellow-500'
    },
    {
      id: 'user-lesson-progress',
      name: 'User-Lesson Progress Report',
      description: 'Detailed view of each user\'s progress on individual lessons with time spent and completion status',
      category: 'courses',
      icon: BookOpenIcon,
      path: '/admin/reports/user-lesson-progress',
      color: 'bg-indigo-500'
    },
    {
      id: 'quiz-attempts',
      name: 'Assessment Attempts Report',
      description: 'Heat maps for assessment, category, and question difficulty plus latest-attempt drill-down',
      category: 'courses',
      icon: ChartPieIcon,
      path: '/admin/reports/quiz-attempts',
      color: 'bg-violet-600'
    },
    {
      id: 'assessment-difficulty',
      name: 'Assessment Difficulty Report',
      description: 'All assessments with attempt, completion, and pass statistics plus per-question difficulty drill-down',
      category: 'courses',
      icon: ChartBarIcon,
      path: '/admin/reports/assessment-difficulty',
      color: 'bg-orange-600'
    },
    {
      id: 'survey-report',
      name: 'Survey Report',
      description: 'Table of all course-linked surveys with attempt counts; open any row for question-level analytics',
      category: 'courses',
      icon: ClipboardDocumentListIcon,
      path: '/admin/reports/surveys',
      color: 'bg-emerald-600'
    },
    {
      id: 'pathway-progress',
      name: 'Pathway Progress Report',
      description: 'Track completion rates and time spent on learning pathways',
      category: 'pathways',
      icon: MapIcon,
      path: '/admin/reports/pathway-progress',
      color: 'bg-teal-500'
    },
    {
      id: 'pathway-assignments',
      name: 'Pathway Assignment Report',
      description: 'View which pathways are assigned to which users and their progress',
      category: 'pathways',
      icon: UserGroupIcon,
      path: '/admin/reports/pathway-assignments',
      color: 'bg-cyan-500'
    },
    {
      id: 'user-course-progress',
      name: 'User-Course Progress Report',
      description: 'Comprehensive view of all users and their course progress with detailed filtering',
      category: 'admin',
      icon: DocumentChartBarIcon,
      path: '/admin/reports/user-course-progress',
      color: 'bg-[#36454F]'
    },
    {
      id: 'content-usage',
      name: 'Content Usage Report',
      description: 'Track overall platform usage including courses, pathways, and groups',
      category: 'admin',
      icon: DocumentChartBarIcon,
      path: '/admin/reports/content-usage',
      color: 'bg-[#36454F]'
    },
    {
      id: 'activity-logs',
      name: 'Activity Log Report',
      description:
        'Browse all logged platform activity from learners and admins with search, filters, and full detail view',
      category: 'admin',
      icon: ClipboardDocumentListIcon,
      path: '/admin/reports/activity-logs',
      color: 'bg-teal-700'
    },
    {
      id: 'storage-usage',
      name: 'Storage Usage Report',
      description: 'Monitor Azure storage consumption and manage your storage quota',
      category: 'admin',
      icon: HardDrive,
      path: '/admin/reports/storage',
      color: 'bg-indigo-600'
    }
  ];

  const favoriteIdSet = new Set(favoriteReportIds);

  useEffect(() => {
    let cancelled = false;

    async function loadFavorites() {
      try {
        const data = await getFavoriteReports();
        if (cancelled) return;

        const ids = data?.favoriteReportIds ?? [];
        setFavoriteReportIds(ids);
        setActiveCategory(ids.length > 0 ? 'favorites' : 'all');
      } catch {
        if (!cancelled) {
          setActiveCategory('all');
        }
      } finally {
        if (!cancelled) {
          setFavoritesLoaded(true);
        }
      }
    }

    loadFavorites();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleFavorite = async (reportId, event) => {
    event.preventDefault();
    event.stopPropagation();

    if (togglingFavoriteId) return;

    const isFavorite = favoriteIdSet.has(reportId);
    const nextFavorites = isFavorite
      ? favoriteReportIds.filter((id) => id !== reportId)
      : [...favoriteReportIds, reportId];

    setFavoriteReportIds(nextFavorites);
    setTogglingFavoriteId(reportId);

    try {
      const data = await updateFavoriteReports(nextFavorites);
      const savedFavorites = data?.favoriteReportIds ?? nextFavorites;
      setFavoriteReportIds(savedFavorites);
      if (savedFavorites.length === 0 && activeCategory === 'favorites') {
        setActiveCategory('all');
      }
    } catch {
      setFavoriteReportIds(favoriteReportIds);
    } finally {
      setTogglingFavoriteId(null);
    }
  };

  const getFilteredReports = () => {
    if (activeCategory === 'all') return reports;
    if (activeCategory === 'favorites') {
      return reports.filter((report) => favoriteIdSet.has(report.id));
    }
    return reports.filter((report) => report.category === activeCategory);
  };

  const renderReportCard = (report) => {
    const Icon = report.icon;
    const isFavorite = favoriteIdSet.has(report.id);

    return (
      <Link
        key={report.id}
        to={report.path}
        className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all"
      >
        <div className="flex items-start justify-between gap-3">
          <span className={`rounded-lg inline-flex p-3 ${report.color} text-white ring-4 ring-white`}>
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
          <button
            type="button"
            onClick={(event) => toggleFavorite(report.id, event)}
            disabled={togglingFavoriteId === report.id}
            className={`rounded-md p-1 transition-colors ${
              isFavorite
                ? 'text-amber-500 hover:text-amber-600'
                : 'text-gray-300 hover:text-amber-500'
            }`}
            aria-label={isFavorite ? `Remove ${report.name} from favourites` : `Add ${report.name} to favourites`}
            title={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
          >
            {isFavorite ? (
              <StarIconSolid className="h-6 w-6" aria-hidden="true" />
            ) : (
              <StarIcon className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900">
            {report.name}
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            {report.description}
          </p>
        </div>
      </Link>
    );
  };

  const sectionCategories = reportCategories.filter(
    (category) => category.id !== 'all' && category.id !== 'favorites'
  );

  const filteredReports = getFilteredReports();

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
            <p className="mt-2 text-sm text-gray-700">
              Generate comprehensive reports and insights about your LMS
            </p>
          </div>

          <div className="border-b border-gray-200 bg-white rounded-t-lg px-4">
            <nav className="-mb-px flex flex-wrap gap-x-8" aria-label="Tabs">
              {reportCategories.map((category) => {
                const Icon = category.icon;
                const isActive = activeCategory === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    disabled={!favoritesLoaded}
                    className={`
                      group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                      ${isActive
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                      ${!favoritesLoaded ? 'opacity-60 cursor-wait' : ''}
                    `}
                  >
                    <Icon
                      className={`
                        -ml-0.5 mr-2 h-5 w-5
                        ${isActive ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500'}
                      `}
                      aria-hidden="true"
                    />
                    <span>{category.name}</span>
                    {category.id === 'favorites' && favoriteReportIds.length > 0 && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {favoriteReportIds.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {!favoritesLoaded ? (
            <div className="rounded-lg border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
              Loading reports...
            </div>
          ) : activeCategory === 'all' ? (
            <div className="space-y-10">
              {sectionCategories.map((category) => {
                const categoryReports = reports.filter((report) => report.category === category.id);
                if (categoryReports.length === 0) return null;

                return (
                  <section key={category.id}>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">{category.name}</h2>
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                      {categoryReports.map(renderReportCard)}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : activeCategory === 'favorites' && filteredReports.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
              <StarIcon className="mx-auto h-10 w-10 text-gray-300" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-medium text-gray-900">No favourite reports yet</h2>
              <p className="mt-2 text-sm text-gray-500">
                Use the star on any report card to add it here for quick access.
              </p>
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                className="mt-6 inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Browse all reports
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredReports.map(renderReportCard)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
