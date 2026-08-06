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
  {
    label: 'Learning',
    children: [
      { to: '/admin/courses', label: 'Courses', flag: 'showCoursesNav' },
      { to: '/admin/learning-pathways', label: 'Pathways', flag: 'showPathwaysNav' },
      { to: '/admin/question-bank/questions', label: 'Question Bank' },
    ],
  },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/automation', label: 'Automation' },
];

const superAdminNavLinks = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  {
    label: 'Learning',
    children: [
      { to: '/admin/question-bank/questions', label: 'Question Bank' },
      { to: '/admin/question-bank/quizzes', label: 'Bank Assessments' },
      { to: '/admin/courses', label: 'Courses' },
      { to: '/admin/learning-pathways', label: 'Pathways' },
      { to: '/admin/surveys', label: 'Surveys' },
    ],
  },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/automation', label: 'Automation' },
];

const filterNavLinks = (links) =>
  links
    .map((item) => {
      if (item.children?.length) {
        const children = item.children.filter(
          (child) => !child.flag || adminFeatureFlags[child.flag]
        );
        return children.length ? { ...item, children } : null;
      }
      if (item.flag && !adminFeatureFlags[item.flag]) {
        return null;
      }
      return item;
    })
    .filter(Boolean);

/** Primary admin header navigation (role-aware). */
export const getAdminNavLinks = () => {
  if (isSuperAdmin()) {
    return filterNavLinks(superAdminNavLinks);
  }
  return filterNavLinks(orgAdminNavLinks);
};

/** @deprecated Use getAdminNavLinks() */
export const adminNavLinks = filterNavLinks(orgAdminNavLinks);

/** Whether create/edit/delete user actions are shown in admin UI. */
export const canManageUsersInUI = () => {
  const role = getUserRole();
  // CTA blocks OrgAdmin (API-managed users). In lmsBox, OrgAdmin manages users in UI.
  return role !== 'OrgDA';
};

/** SuperAdmin and OrgAdmin can generate reusable admin login links from the user listing. */
export const canGenerateLoginLinkInUI = () => {
  const roles = getUserRoles();
  return roles.includes('SuperAdmin') || roles.includes('OrgAdmin');
};
