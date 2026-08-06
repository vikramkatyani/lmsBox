import React from 'react';
import AdminHeader from '../components/AdminHeader';
import { EvolvePackageInspector } from '@import-engine/ui/EvolvePackageInspector.jsx';

/**
 * Admin page hosting the Import Engine Developer Debug View.
 * Sprint 1 — inspect Evolve packages only (no LMS import / AI / HTML render).
 */
export default function AdminImportEngine() {
  return (
    <div className="min-h-screen bg-[#f7f5f2]">
      <AdminHeader />
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <EvolvePackageInspector />
      </main>
    </div>
  );
}
