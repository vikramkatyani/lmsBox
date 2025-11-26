import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AdminProfile from './pages/AdminProfile';
import LearnerProfile from './pages/LearnerProfile';
import Login from './pages/Login';
import VerifyLogin from './pages/VerifyLogin';
import AuthTest from './pages/AuthTest';
import Courses from './pages/Courses';
import CourseContent from './pages/CourseContent';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminUsersBulkCreate from './pages/AdminUsersBulkCreate';
import AdminCourses from './pages/AdminCourses';
import AdminReports from './pages/AdminReports';
import AdminCourseEditor from './pages/AdminCourseEditor';
import AdminUserGroups from './pages/AdminUserGroups';
import AdminUserGroupEditor from './pages/AdminUserGroupEditor';
import AdminUserEditor from './pages/AdminUserEditor';
import QuizCreator from './pages/QuizCreator';
import AdminSurveyEditor from './pages/AdminSurveyEditor';
import UserActivityReport from './pages/UserActivityReport';
import UserProgressReport from './pages/UserProgressReport';
import CourseEnrollmentReport from './pages/CourseEnrollmentReport';
import CourseCompletionReport from './pages/CourseCompletionReport';
import LessonAnalyticsReport from './pages/LessonAnalyticsReport';
import TimeTrackingReport from './pages/TimeTrackingReport';
import ContentUsageReport from './pages/ContentUsageReport';
import PathwayProgressReport from './pages/PathwayProgressReport';
import PathwayAssignmentsReport from './pages/PathwayAssignmentsReport';
import UserCourseProgressReport from './pages/UserCourseProgressReport';
import CustomReportBuilder from './pages/CustomReportBuilder';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import { ThemeProvider } from './theme/ThemeContext';
import CompleteProfile from './pages/CompleteProfile';
import SuperAdminLogin from './pages/SuperAdminLogin';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import SuperAdminOrganisations from './pages/SuperAdminOrganisations';
import SuperAdminOrganisationForm from './pages/SuperAdminOrganisationForm';
import SuperAdminLibrary from './pages/SuperAdminLibrary';
import SuperAdminLibraryCreate from './pages/SuperAdminLibraryCreate';
import OrganisationSettings from './pages/OrganisationSettings';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {/* Super Admin routes - separate from regular users */}
          <Route path="/superadmin/login" element={<SuperAdminLogin />} />
          <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
          <Route path="/superadmin/organisations" element={<SuperAdminOrganisations />} />
          <Route path="/superadmin/organisations/create" element={<SuperAdminOrganisationForm />} />
          <Route path="/superadmin/organisations/:id/edit" element={<SuperAdminOrganisationForm />} />
          <Route path="/superadmin/library" element={<SuperAdminLibrary />} />
          <Route path="/superadmin/library/create" element={<SuperAdminLibraryCreate />} />
          
          {/* Public routes */}
          <Route 
            path="/" 
            element={<Login />}
          />
          <Route 
            path="/login" 
            element={<Login />}
          />
          <Route path="/verify-login" element={<VerifyLogin />} />
          <Route path="/auth-test" element={<AuthTest />} />
          
          {/* Admin profile page */}
          <Route
            path="/admin/profile"
            element={
              <AdminRoute>
                <AdminProfile />
              </AdminRoute>
            }
          />
          
          {/* Learner profile page */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <LearnerProfile />
              </ProtectedRoute>
            }
          />
          
          {/* Protected courses routes (path-based tabs) */}
          <Route path="/courses" element={<Navigate to="/courses/all" replace />} />
          <Route
            path="/courses/:tab"
            element={
              <ProtectedRoute>
                <Courses />
              </ProtectedRoute>
            }
          />
          {/* Profile completion route */}
          <Route
            path="/profile/complete"
            element={
              <ProtectedRoute>
                <CompleteProfile />
              </ProtectedRoute>
            }
          />
          {/* Protected course content/lessons route */}
          <Route
            path="/course/:courseId"
            element={
              <ProtectedRoute>
                <CourseContent />
              </ProtectedRoute>
            }
          />
          {/* Legacy certificates route -> redirect to courses certificate tab */}
          <Route path="/certificates" element={<Navigate to="/courses/certificates" replace />} />
          
          {/* Admin routes - protected with AdminRoute */}
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <AdminUsers />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users/new"
            element={
              <AdminRoute>
                <AdminUserEditor />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users/bulk-new"
            element={
              <AdminRoute>
                <AdminUsersBulkCreate />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users/:userId/edit"
            element={
              <AdminRoute>
                <AdminUserEditor />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <AdminRoute>
                <OrganisationSettings />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/courses"
            element={
              <AdminRoute>
                <AdminCourses />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/courses/new"
            element={
              <AdminRoute>
                <AdminCourseEditor />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/courses/:courseId/edit"
            element={
              <AdminRoute>
                <AdminCourseEditor />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/surveys/create"
            element={
              <AdminRoute>
                <AdminSurveyEditor />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/surveys/edit/:surveyId"
            element={
              <AdminRoute>
                <AdminSurveyEditor />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <AdminRoute>
                <AdminReports />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/reports/user-activity"
            element={
              <AdminRoute>
                <UserActivityReport />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/reports/user-progress"
            element={
              <AdminRoute>
                <UserProgressReport />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/reports/course-enrollment"
            element={
              <AdminRoute>
                <CourseEnrollmentReport />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/reports/course-completion"
            element={
              <AdminRoute>
                <CourseCompletionReport />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/reports/lesson-analytics"
            element={
              <AdminRoute>
                <LessonAnalyticsReport />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/reports/time-tracking"
            element={
              <AdminRoute>
                <TimeTrackingReport />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/reports/content-usage"
            element={
              <AdminRoute>
                <ContentUsageReport />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/reports/pathway-progress"
            element={
              <AdminRoute>
                <PathwayProgressReport />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/reports/pathway-assignments"
            element={
              <AdminRoute>
                <PathwayAssignmentsReport />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/reports/user-course-progress"
            element={
              <AdminRoute>
                <UserCourseProgressReport />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/reports/custom-builder"
            element={
              <AdminRoute>
                <CustomReportBuilder />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/learning-pathways"
            element={
              <AdminRoute>
                <AdminUserGroups />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/learning-pathways/new"
            element={
              <AdminRoute>
                <AdminUserGroupEditor />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/learning-pathways/:groupId/edit"
            element={
              <AdminRoute>
                <AdminUserGroupEditor />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/quiz/create/:courseId?"
            element={
              <AdminRoute>
                <QuizCreator />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/quiz/edit/:quizId"
            element={
              <AdminRoute>
                <QuizCreator />
              </AdminRoute>
            }
          />
        </Routes>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              iconTheme: {
                primary: '#4ade80',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </Router>
    </ThemeProvider>
  );
}

export default App;