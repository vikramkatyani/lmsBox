import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { EllipsisVerticalIcon } from '@heroicons/react/24/outline';

export default function RowActionMenu({ items }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  const visibleItems = items.filter((item) => !item.hidden);

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      zIndex: 50,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handleClickOutside = (e) => {
      if (
        buttonRef.current?.contains(e.target) ||
        menuRef.current?.contains(e.target)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleDismiss = () => setOpen(false);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleDismiss, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleDismiss, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  if (visibleItems.length === 0) {
    return null;
  }

  const menu = (
    <div
      ref={menuRef}
      style={menuStyle}
      className="w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
      role="menu"
    >
      {visibleItems.map((item) => (
        <button
          key={item.label}
          role="menuitem"
          onClick={() => {
            if (!item.disabled) {
              item.onClick();
              setOpen(false);
            }
          }}
          disabled={item.disabled}
          title={item.title}
          className={`w-full text-left px-4 py-2 text-sm transition-colors ${
            item.disabled
              ? 'text-gray-400 cursor-not-allowed'
              : item.danger
                ? 'text-red-700 hover:bg-red-50'
                : item.variant === 'warning'
                  ? 'text-amber-800 hover:bg-amber-50'
                  : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className="flex justify-end">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Actions"
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <EllipsisVerticalIcon className="h-5 w-5" />
        </button>
      </div>
      {open && typeof document !== 'undefined' && createPortal(menu, document.body)}
    </>
  );
}
