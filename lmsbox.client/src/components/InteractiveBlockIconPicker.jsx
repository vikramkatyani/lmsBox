import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import Modal from './Modal';
import {
  formatIconKey,
  humanizeIconName,
  parseIconKey,
  renderLucideIconSvg,
  searchLucideIcons,
} from '../utils/interactiveBlockIcons';

function IconGlyph({ name, style = 'outline', className = 'h-5 w-5' }) {
  const svg = name ? renderLucideIconSvg(name, style) : '';
  if (!svg) {
    return (
      <span
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-dashed border-current text-[10px] leading-none opacity-60"
        aria-hidden="true"
      >
        —
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full ${className}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export default function InteractiveBlockIconPicker({
  label = 'Icon',
  value,
  onChange,
}) {
  const searchId = useId();
  const searchRef = useRef(null);
  const [open, setOpen] = useState(false);
  const selected = parseIconKey(value);
  const [query, setQuery] = useState('');
  const [style, setStyle] = useState('outline');

  const openPicker = () => {
    setQuery('');
    setStyle(selected.style);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [open]);

  const matches = useMemo(() => searchLucideIcons(query), [query]);
  const selectedLabel = selected.name
    ? `${humanizeIconName(selected.name)} (${selected.style})`
    : 'Default';

  const choose = (name, nextStyle = style) => {
    onChange(formatIconKey(name, nextStyle));
    setOpen(false);
  };

  const chooseDefault = () => {
    onChange('');
    setOpen(false);
  };

  const switchStyle = (nextStyle) => {
    setStyle(nextStyle);
    if (selected.name) {
      onChange(formatIconKey(selected.name, nextStyle));
    }
  };

  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <button
        type="button"
        onClick={openPicker}
        className="flex w-full items-center justify-between gap-2 rounded border bg-white px-3 py-2 text-left"
      >
        <span className="flex min-w-0 items-center gap-2 text-[#1b365d]">
          <IconGlyph name={selected.name} style={selected.style} />
          <span className="truncate text-gray-900">{selectedLabel}</span>
        </span>
        <span className="shrink-0 text-xs text-[#1b365d]">Browse</span>
      </button>
      <p className="mt-1 text-xs text-gray-500">
        Search the Lucide library and choose outline or solid. Leave as Default to keep the template icon.
      </p>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Choose an icon"
        size="xl"
        zIndexClass="z-[90]"
        footer={(
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded border bg-white px-4 py-2 hover:bg-gray-50"
          >
            Close
          </button>
        )}
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor={searchId} className="mb-1 block text-sm font-medium">Search</label>
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  ref={searchRef}
                  id={searchId}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded border py-2 pl-9 pr-3"
                  placeholder="Search by name, e.g. shield, book, alert"
                />
              </div>
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium">Style</span>
              <div className="inline-flex rounded border p-0.5">
                {['outline', 'solid'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => switchStyle(option)}
                    className={`rounded px-3 py-1.5 text-sm capitalize ${
                      style === option
                        ? 'bg-[#1b365d] text-white'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={chooseDefault}
            className={`flex w-full items-center gap-2 rounded border px-3 py-2 text-left text-sm ${
              !selected.name ? 'border-[#1b365d] bg-[#f0f5fb]' : 'hover:bg-gray-50'
            }`}
          >
            <IconGlyph name="" />
            <span>
              <span className="font-medium">Default</span>
              <span className="ml-2 text-xs text-gray-500">Use the template icon</span>
            </span>
          </button>

          <p className="text-xs text-gray-500">
            {matches.length} icon{matches.length === 1 ? '' : 's'}
            {query.trim() ? ` matching “${query.trim()}”` : ''}
          </p>

          {matches.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No icons match that search.</p>
          ) : (
            <div className="grid max-h-[28rem] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-6">
              {matches.map((name) => {
                const isSelected = selected.name === name;
                return (
                  <button
                    key={name}
                    type="button"
                    title={humanizeIconName(name)}
                    onClick={() => choose(name, style)}
                    className={`flex flex-col items-center gap-1 rounded border px-2 py-2 text-center ${
                      isSelected
                        ? 'border-[#1b365d] bg-[#1b365d] text-white'
                        : 'border-gray-200 text-[#1b365d] hover:border-[#1b365d] hover:bg-[#f0f5fb]'
                    }`}
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '80px' }}
                  >
                    <IconGlyph
                      name={name}
                      style={style}
                      className={`h-6 w-6 ${isSelected ? 'text-white' : 'text-[#1b365d]'}`}
                    />
                    <span className={`w-full truncate text-[11px] leading-tight ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                      {humanizeIconName(name)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
