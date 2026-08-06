import React, { useRef } from 'react';

/**
 * ZIP upload control. Delegates all processing to the parent via onUpload.
 */
export function PackageUpload({ onUpload, busy }) {
  const inputRef = useRef(null);

  const handleChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      onUpload(file);
      event.target.value = '';
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    if (busy) return;
    const file = event.dataTransfer.files?.[0];
    if (file && (file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip')) {
      onUpload(file);
    }
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-3"
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={handleChange}
        disabled={busy}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="rounded-md bg-[#1b365d] px-4 py-2 text-sm font-medium text-white hover:bg-[#152a4a] disabled:opacity-60"
      >
        {busy ? 'Inspecting…' : 'Upload Evolve ZIP'}
      </button>
      <span className="text-sm text-slate-500">
        Drop a published Evolve package here, or choose a .zip file.
      </span>
    </div>
  );
}

export default PackageUpload;
