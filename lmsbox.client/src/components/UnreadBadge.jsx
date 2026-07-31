export default function UnreadBadge({ count, className = '' }) {
  if (!count || count <= 0) return null;

  const label = count > 9 ? '9+' : String(count);

  return (
    <span
      className={`inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold leading-none text-white ${className}`}
      aria-label={`${count} unread announcements`}
    >
      {label}
    </span>
  );
}
