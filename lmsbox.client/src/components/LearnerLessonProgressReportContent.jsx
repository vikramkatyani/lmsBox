import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  deriveLessonStatus,
  getLearnerDashboardSnapshot,
} from '../services/learnerDashboard';
import toast from 'react-hot-toast';

function formatDate(dateValue) {
  if (!dateValue) {
    return '-';
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export default function LearnerLessonProgressReportContent({ showBackLink = false }) {
  const [loading, setLoading] = useState(true);
  const [lessons, setLessons] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const controller = new AbortController();

    const loadData = async () => {
      setLoading(true);
      try {
        const snapshot = await getLearnerDashboardSnapshot(controller.signal);
        if (!controller.signal.aborted) {
          setLessons(snapshot.lessons || []);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('Failed to load progress report', error);
          toast.error('Unable to load report.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    loadData();
    return () => controller.abort();
  }, []);

  const courseOptions = useMemo(() => {
    const uniqueTitles = [...new Set(lessons.map((record) => record.courseTitle))];
    return uniqueTitles.sort((a, b) => a.localeCompare(b));
  }, [lessons]);

  const filteredRecords = useMemo(() => {
    return lessons
      .filter((record) => {
        const recordStatus = deriveLessonStatus(record);
        const matchesSearch =
          !searchTerm.trim() ||
          record.lessonTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.courseTitle.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCourse = courseFilter === 'all' || record.courseTitle === courseFilter;
        const matchesStatus = statusFilter === 'all' || recordStatus === statusFilter;

        return matchesSearch && matchesCourse && matchesStatus;
      })
      .sort((a, b) => {
        if (a.courseTitle === b.courseTitle) {
          return (a.ordinal || 0) - (b.ordinal || 0);
        }
        return a.courseTitle.localeCompare(b.courseTitle);
      });
  }, [lessons, searchTerm, courseFilter, statusFilter]);

  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Module Progress Report</h1>
            <p className="mt-1 text-sm text-slate-600">
              Review progress records with filters by course and module status.
            </p>
          </div>
          {showBackLink ? (
            <Link
              to="/courses/all"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Back to Courses
            </Link>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <input
            type="text"
            placeholder="Search course or module"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />

          <select
            value={courseFilter}
            onChange={(event) => setCourseFilter(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">All courses</option>
            {courseOptions.map((title) => (
              <option key={title} value={title}>
                {title}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="Completed">Completed</option>
            <option value="In Progress">In Progress</option>
            <option value="Not Started">Not Started</option>
          </select>
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading records...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">No module records found for selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3">Course</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Accessed</th>
                  <th className="px-4 py-3">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredRecords.map((record) => {
                  const status = deriveLessonStatus(record);
                  return (
                    <tr key={record.id}>
                      <td className="px-4 py-3">{record.courseTitle}</td>
                      <td className="px-4 py-3">{record.lessonTitle}</td>
                      <td className="px-4 py-3">{Math.min(100, Math.round(Number(record.progress || 0)))}%</td>
                      <td className="px-4 py-3">{status}</td>
                      <td className="px-4 py-3">{formatDate(record.lastAccessedAt)}</td>
                      <td className="px-4 py-3">{formatDate(record.completedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
