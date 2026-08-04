import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Searchable select that accepts string options or { value, label } objects.
 * Used by Question Bank question creator (category picker).
 */
export default function SearchableSelect({
  label,
  value,
  onChange,
  options = [],
  placeholder = '',
  disabled = false,
  inputClassName = '',
}) {
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const normalizedOptions = useMemo(() => {
    const list = (options || [])
      .map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
      .filter((o) => o && o.label);
    const seen = new Set();
    return list.filter((o) => {
      const k = (o.value ?? o.label).toString().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [options]);

  const filtered = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter((o) => (o.label || '').toLowerCase().includes(q));
  }, [normalizedOptions, query]);

  const commit = (next) => {
    onChange?.(next);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={containerRef}>
      {label ? <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label> : null}
      <div className="relative">
        <input
          type="text"
          value={open ? query : value || ''}
          disabled={disabled}
          onFocus={() => {
            if (disabled) return;
            setOpen(true);
            setQuery('');
          }}
          onChange={(e) => {
            setOpen(true);
            setQuery(e.target.value);
            onChange?.(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={placeholder}
          className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${inputClassName}`}
        />

        {open && !disabled ? (
          <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow max-h-56 overflow-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No matches</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value ?? o.label}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => commit(o.value ?? o.label)}
                >
                  {o.label}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
