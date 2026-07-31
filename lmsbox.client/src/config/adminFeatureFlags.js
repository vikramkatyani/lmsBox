import { getUserRole, getUserRoles } from '../utils/auth';

/**
 * Toggle admin UI visibility without removing routes or APIs.
 * Set flags to true when re-enabling features in the menu.
 */
export const adminFeatureFlags = {
  showCoursesNav: true,
  showPathwaysNav: true,
  showAdminAiAssistant: false,
};

/** Platform admin (SuperAdmin) — system-wide access. */
export const isSuperAdmin = () => getUserRole() === 'SuperAdmin';

const orgAdminNavLinks = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/courses', label: 'Courses', flag: 'showCoursesNav' },
  { to: '/admin/learning-pathways', label: 'Pathways', flag: 'showPathwaysNav' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/automation', label: 'Automation' },
];

const superAdminNavLinks = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  {
    label: 'Learning',
    children: [
      { to: '/admin/question-bank/questions', label: 'Question Bank' },
      { to: '/admin/courses', label: 'Courses' },
      { to: '/admin/learning-pathways', label: 'Pathways' },
      { to: '/admin/surveys', label: 'Surveys' },
    ],
  },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/automation', label: 'Automation' },
];

/** Primary admin header navigation (role-aware). */
export const getAdminNavLinks = () => {
  if (isSuperAdmin()) {
    return superAdminNavLinks;
  }
  return orgAdminNavLinks.filter((link) => !link.flag || adminFeatureFlags[link.flag]);
};

/** @deprecated Use getAdminNavLinks() */
export const adminNavLinks = orgAdminNavLinks.filter(
  (link) => !link.flag || adminFeatureFlags[link.flag]
);

/** OrgAdmin can list users; create/edit/delete stay API-only when false. */
export const canManageUsersInUI = () => {
  const role = getUserRole();
  return role !== 'OrgAdmin' && role !== 'OrgDA';
};

/** SuperAdmin and OrgAdmin can generate reusable admin login links from the user listing. */
export const canGenerateLoginLinkInUI = () => {
  const roles = getUserRoles();
  return roles.includes('SuperAdmin') || roles.includes('OrgAdmin');
};
