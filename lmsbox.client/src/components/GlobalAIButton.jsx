import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { adminFeatureFlags, isSuperAdmin } from '../config/adminFeatureFlags';
import { isOrgAdmin, isTenantAdmin } from '../utils/auth';

const GlobalAIButton = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const canUseAdminAi =
    isSuperAdmin() || isOrgAdmin() || isTenantAdmin();

  if (!adminFeatureFlags.showAdminAiAssistant || !canUseAdminAi) {
    return null;
  }

  // Only show on admin pages; hide on course editor (has its own AI) and import engine (Sprint 1: no AI)
  const isAdminPage = location.pathname.startsWith('/admin');
  const isCourseEditorPage = location.pathname.includes('/admin/courses/') && 
                             (location.pathname.includes('/edit') || location.pathname === '/admin/courses/new');
  const isImportEnginePage = location.pathname.startsWith('/admin/import-engine');

  if (!isAdminPage || isCourseEditorPage || isImportEnginePage) {
    return null;
  }

  const handleClick = () => {
    // Navigate to create course page with AI assistant open
    navigate('/admin/courses/new?openAI=true');
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-50 bg-boxlms-navbar text-boxlms-navbar-active p-4 rounded-full shadow-lg hover:shadow-xl hover:brightness-110 transition-all duration-200 flex items-center gap-2 group"
      title="Create Course with AI"
    >
      <Sparkles className="w-6 h-6" />
      <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap font-medium">
        AI Assistant
      </span>
    </button>
  );
};

export default GlobalAIButton;
