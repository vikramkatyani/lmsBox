import React, { useCallback } from 'react';
import AdminHeader from '../components/AdminHeader';
import { EvolvePackageInspector } from '@import-engine/ui/EvolvePackageInspector.jsx';
import evolveImportService from '../services/evolveImport';

/**
 * Admin page for the Import Engine.
 * Sprint 1: inspect Evolve packages.
 * Sprint 2: create Draft LMSBox courses from mapped Evolve content.
 * Sprint 3: attach package media (images/video/audio/hotspot) after draft create.
 */
export default function AdminImportEngine() {
  const handleCreateDraftCourse = useCallback(async (plan, { vfs, onProgress } = {}) => {
    return evolveImportService.createDraftCourseWithMedia(plan, vfs, onProgress);
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f5f2]">
      <AdminHeader />
      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
        <EvolvePackageInspector onCreateDraftCourse={handleCreateDraftCourse} />
      </main>
    </div>
  );
}
