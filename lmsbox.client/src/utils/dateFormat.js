/** Format as DD-MMM-YYYY (e.g. 19-May-2026). */
export function formatAppDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
    .format(date)
    .replace(/\s+/g, '-');
}

/** Format as DD-MMM-YYYY HH:mm (e.g. 19-May-2026 14:30). */
export function formatAppDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);

  return `${formatAppDate(value)} ${time}`;
}
