import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'lg',
  zIndexClass = 'z-50',
}) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  if (typeof document === 'undefined' || !document.body) return null;

  const sizeClass = {
    md: 'sm:max-w-2xl',
    lg: 'sm:max-w-4xl',
    xl: 'sm:max-w-6xl',
  }[size] || 'sm:max-w-4xl';

  return createPortal(
    <div className={`fixed inset-0 ${zIndexClass} overflow-y-auto`}>
      <div className="flex min-h-screen items-center justify-center px-4 py-8">
        <button
          type="button"
          className="fixed inset-0 bg-gray-500/75 transition-opacity"
          onClick={onClose}
          aria-label="Close dialog"
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={`relative w-full ${sizeClass} overflow-hidden rounded-lg bg-white text-left shadow-xl`}
        >
          <div className="flex items-center justify-between border-b border-gray-200 bg-[#1b365d] px-6 py-4">
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-2 text-white/80 hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-6">{children}</div>

          {footer ? (
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}
