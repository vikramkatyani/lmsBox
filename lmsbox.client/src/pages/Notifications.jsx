import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import LearnerHeader from '../components/LearnerHeader';
import usePageTitle from '../hooks/usePageTitle';
import { getAnnouncements, markAnnouncementAsRead } from '../services/announcements';

function formatAnnouncementDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function stripHtmlPreview(html) {
  if (!html) return '';
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 140 ? `${text.slice(0, 140)}...` : text;
}

function AnnouncementDetailModal({ announcement, onClose }) {
  if (!announcement) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 flex items-start justify-between border-b bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{announcement.title}</h2>
            <p className="mt-1 text-sm text-gray-500">{formatAnnouncementDate(announcement.scheduledForUtc)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
          >
            Close
          </button>
        </div>
        <div
          className="prose prose-sm max-w-none px-6 py-5 text-gray-800"
          dangerouslySetInnerHTML={{ __html: announcement.bodyHtml || '' }}
        />
      </div>
    </div>
  );
}

export default function Notifications() {
  usePageTitle('Notifications');

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);

  const loadAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAnnouncements(1, 100);
      setAnnouncements(Array.isArray(data?.items) ? data.items : []);
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
  }, [loadAnnouncements]);

  const notifyUnreadCountChanged = () => {
    window.dispatchEvent(new CustomEvent('announcements:updated'));
  };

  const openAnnouncement = async (announcement) => {
    setSelectedAnnouncement(announcement);

    if (announcement.isRead) return;

    try {
      await markAnnouncementAsRead(announcement.id);
      setAnnouncements((prev) =>
        prev.map((item) =>
          item.id === announcement.id
            ? { ...item, isRead: true, readAtUtc: new Date().toISOString() }
            : item
        )
      );
      notifyUnreadCountChanged();
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Failed to mark announcement as read');
    }
  };

  const closeAnnouncement = () => {
    setSelectedAnnouncement(null);
  };

  return (
    <>
      <LearnerHeader />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link
            to="/courses"
            className="mb-4 inline-flex items-center text-sm text-gray-600 transition hover:text-gray-900"
          >
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            Back to Courses
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <p className="mt-1 text-sm text-gray-500">Your announcements and updates.</p>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="px-6 py-10 text-center text-sm text-gray-500">Loading announcements...</div>
          ) : announcements.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-500">No announcements yet.</div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {announcements.map((announcement) => (
                <li key={announcement.id}>
                  <button
                    type="button"
                    onClick={() => openAnnouncement(announcement)}
                    className={`flex w-full items-start gap-4 px-6 py-4 text-left transition hover:bg-gray-50 ${
                      announcement.isRead ? 'bg-white' : 'bg-blue-50/40'
                    }`}
                  >
                    <div className="mt-1 flex-shrink-0">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                          announcement.isRead ? 'bg-transparent' : 'bg-blue-600'
                        }`}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className={`truncate text-sm ${announcement.isRead ? 'font-medium text-gray-800' : 'font-semibold text-gray-900'}`}>
                          {announcement.title}
                        </p>
                        <span className="whitespace-nowrap text-xs text-gray-500">
                          {formatAnnouncementDate(announcement.scheduledForUtc)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                        {stripHtmlPreview(announcement.bodyHtml)}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <AnnouncementDetailModal announcement={selectedAnnouncement} onClose={closeAnnouncement} />
    </>
  );
}
