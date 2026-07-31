import { useCallback, useEffect, useState } from 'react';
import { getUnreadAnnouncementCount } from '../services/announcements';

const POLL_INTERVAL_MS = 60000;

export default function useUnreadAnnouncements({ enabled = true } = {}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setUnreadCount(0);
      return;
    }

    try {
      setLoading(true);
      const count = await getUnreadAnnouncementCount();
      setUnreadCount(count);
    } catch (error) {
      if (error?.response?.status !== 401) {
        console.error('Failed to load unread announcement count', error);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    refresh();

    if (!enabled) return undefined;

    const intervalId = window.setInterval(refresh, POLL_INTERVAL_MS);
    const handleFocus = () => refresh();
    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled, refresh]);

  return { unreadCount, loading, refresh };
}
