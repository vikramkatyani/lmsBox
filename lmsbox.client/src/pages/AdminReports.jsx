import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import usePageTitle from '../hooks/usePageTitle';
import {
  ChartBarIcon,
  UserGroupIcon,
  AcademicCapIcon,
  DocumentChartBarIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  BookOpenIcon,
  MapIcon
} from '@heroicons/react/24/outline';

export default function AdminReports() {
  usePageTitle('Reports & Analytics');
  const [activeCategory, setActiveCategory] = useState('all');

  const reportCategories = [
    { id: 'all', name: 'All Reports', icon: DocumentChartBarIcon },
    { id: 'users', name: 'Users & Engagement', icon: UserGroupIcon },
    { id: 'courses', name: 'Course Analytics', icon: AcademicCapIcon },
    { id: 'pathways', name: 'Learning Pathways', icon: MapIcon },
    { id: 'admin', name: 'Administrative', icon: ChartBarIcon }
  ];

  const reports = [
    {
      id: 'user-activity',
      name: 'User Activity Report',
      description: 'Track user login frequency, last active date, and identify idle users',
      category: 'users',
      icon: ClockIcon,
      path: '/admin/reports/user-activity',
      color: 'bg-blue-500'
    },
    {
      id: 'user-progress',
      name: 'User Progress Report',
      description: 'View individual user progress across all courses and learning pathways',
      category: 'users',
      icon: ArrowTrendingUpIcon,
      path: '/admin/reports/user-progress',
      color: 'bg-indigo-500'
    },
    {
      id: 'course-enrollment',
      name: 'Course Enrollment Report',
      description: 'Analyze enrollment trends over time across all courses',
      category: 'courses',
      icon: AcademicCapIcon,
      path: '/admin/reports/course-enrollment',
      color: 'bg-purple-500'
    },
    {
      id: 'course-completion',
      name: 'Course Completion Report',
      description: 'Track course completion rates and average completion time',
      category: 'courses',
      icon: ChartBarIcon,
      path: '/admin/reports/course-completion',
      color: 'bg-green-500'
    },
    {
      id: 'lesson-analytics',
      name: 'Lesson Analytics Report',
      description: 'Per-lesson analytics including views, completions, and quiz performance',
      category: 'courses',
      icon: BookOpenIcon,
      path: '/admin/reports/lesson-analytics',
      color: 'bg-yellow-500'
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
      color: 'bg-purple-500'
    },
    {
      id: 'content-usage',
      name: 'Content Usage Report',
      description: 'Track overall platform usage including courses, pathways, and groups',
      category: 'admin',
      icon: DocumentChartBarIcon,
      path: '/admin/reports/content-usage',
      color: 'bg-orange-500'
    }
  ];

  const filteredReports = activeCategory === 'all' 
    ? reports 
    : reports.filter(r => r.category === activeCategory);

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

          {/* Category Filter */}
          <div className="border-b border-gray-200 bg-white rounded-t-lg px-4">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              {reportCategories.map((category) => {
                const Icon = category.icon;
                const isActive = activeCategory === category.id;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`
                      group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                      ${isActive
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
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
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Reports Grid */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredReports.map((report) => {
              const Icon = report.icon;
              return (
                <Link
                  key={report.id}
                  to={report.path}
                  className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-500 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all"
                >
                  <div>
                    <span className={`rounded-lg inline-flex p-3 ${report.color} text-white ring-4 ring-white`}>
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                  </div>
                  <div className="mt-8">
                    <h3 className="text-lg font-medium text-gray-900">
                      {report.name}
                    </h3>
                    <p className="mt-2 text-sm text-gray-500">
                      {report.description}
                    </p>
                  </div>
                  <span
                    className="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400"
                    aria-hidden="true"
                  >
                    <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                    </svg>
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Quick Actions section removed as per requirement */}
        </div>
      </div>
    </div>
  );
}
