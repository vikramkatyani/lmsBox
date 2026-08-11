import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import AdminProfile from './pages/AdminProfile';
import LearnerProfile from './pages/LearnerProfile';
import Notifications from './pages/Notifications';
import Login from './pages/Login';
import VerifyLogin from './pages/VerifyLogin';
import EmailNotRegistered from './pages/EmailNotRegistered';
import AuthTest from './pages/AuthTest';
import Courses from './pages/Courses';
import CourseContent from './pages/CourseContent';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminUsersBulkCreate from './pages/AdminUsersBulkCreate';
import AdminCourses from './pages/AdminCourses';
import AdminSurveys from './pages/AdminSurveys';
import AdminReports from './pages/AdminReports';
import AdminCourseEditor from './pages/AdminCourseEditor';
import AdminCoursePreview from './pages/AdminCoursePreview';
import AdminLessonLibrary from './pages/AdminLessonLibrary';
import AdminAutomation from './pages/AdminAutomation';
import AdminUserGroups from './pages/AdminUserGroups';
import AdminUserGroupEditor from './pages/AdminUserGroupEditor';
import AdminUserEditor from './pages/AdminUserEditor';
import QuizCreator from './pages/QuizCreator';
import InteractiveLessonEditor from './pages/InteractiveLessonEditor';
import InteractiveLessonPreview from './pages/InteractiveLessonPreview';
import QuestionBankQuizCreator from './pages/QuestionBankQuizCreator';
import QuestionBankQuizList from './pages/QuestionBankQuizList';
import QuestionBankQuestionList from './pages/QuestionBankQuestionList';
import QuestionBankQuestionCreator from './pages/QuestionBankQuestionCreator';
import QuizAttemptsReport from './pages/QuizAttemptsReport';
import AssessmentDifficultyReport from './pages/AssessmentDifficultyReport';
import SurveyReport from './pages/SurveyReport';
import SuperAdminActivityLogs from './pages/SuperAdminActivityLogs';
import UserLessonProgressReport from './pages/UserLessonProgressReport';
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
import StorageReport from './pages/StorageReport';
import EngagementAnalytics from './pages/EngagementAnalytics';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import GlobalAIButton from './components/GlobalAIButton';
import { ThemeProvider } from './theme/ThemeContext';
import CompleteProfile from './pages/CompleteProfile';
import SuperAdminLogin from './pages/SuperAdminLogin';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import SuperAdminOrganisations from './pages/SuperAdminOrganisations';
import SuperAdminOrganisationForm from './pages/SuperAdminOrganisationForm';
import SuperAdminLibrary from './pages/SuperAdminLibrary';
import SuperAdminLibraryCreate from './pages/SuperAdminLibraryCreate';
import SuperAdminLibraryEdit from './pages/SuperAdminLibraryEdit';
import SuperAdminTenants from './pages/SuperAdminTenants';
import SuperAdminTenantForm from './pages/SuperAdminTenantForm';
import SuperAdminTenantDetail from './pages/SuperAdminTenantDetail';
import TenantAdminOrganisations from './pages/TenantAdminOrganisations';
import TenantAdminBranding from './pages/TenantAdminBranding';
import OrganisationSettings from './pages/OrganisationSettings';
import { CohortsList, CohortSubmission } from './pages/Qualifications';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {/* Super Admin routes - separate from regular users */}
          <Route path="/superadmin/login" element={<SuperAdminLogin />} />
          <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
          <Route path="/superadmin/tenants" element={<SuperAdminTenants />} />
          <Route path="/superadmin/tenants/create" element={<SuperAdminTenantForm />} />
          <Route path="/superadmin/tenants/:id" element={<SuperAdminTenantDetail />} />
          <Route path="/superadmin/tenants/:id/edit" element={<SuperAdminTenantForm />} />
          <Route path="/superadmin/organisations" element={<SuperAdminOrganisations />} />
          <Route path="/superadmin/organisations/create" element={<SuperAdminOrganisationForm />} />
          <Route path="/superadmin/organisations/:id/edit" element={<SuperAdminOrganisationForm />} />
          <Route path="/superadmin/library" element={<SuperAdminLibrary />} />
          <Route path="/superadmin/library/create" element={<SuperAdminLibraryCreate />} />
          <Route path="/superadmin/library/edit/:id" element={<SuperAdminLibraryEdit />} />
          
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
          <Route path="/auth/email-not-registered" element={<EmailNotRegistered />} />
          <Route path="/auth-test" element={<AuthTest />} />
          
          {/* Tenant admin */}
          <Route
            path="/tenant/organisations"
            element={
              <AdminRoute>
                <TenantAdminOrganisations />
              </AdminRoute>
            }
          />
          <Route
            path="/tenant/branding"
            element={
              <AdminRoute>
                <TenantAdminBranding />
              </AdminRoute>
            }
          />

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

          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Notifications />
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
          
          {/* Qualifications routes - learner submission (no authentication required) */}
          <Route path="/qualifications" element={<CohortsList />} />
          <Route path="/qualifications/cohorts/:cohortId" element={<CohortSubmission />} />
          
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
            path="/admin/courses/:courseId/preview"
            element={
              <AdminRoute>
                <AdminCoursePreview />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/courses/:courseId/library"
            element={
              <AdminRoute>
                <AdminLessonLibrary />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/surveys"
            element={
              <AdminRoute>
                <AdminSurveys />
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
            path="/admin/automation"
            element={
              <AdminRoute>
                <AdminAutomation />
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
            path="/admin/reports/user-lesson-progress"
            element={
              <AdminRoute>
                <UserLessonProgressReport />
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
            path="/admin/reports/storage"
            element={
              <AdminRoute>
                <StorageReport />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/analytics/engagement"
            element={
              <AdminRoute>
                <EngagementAnalytics />
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
          <Route
            path="/admin/interactive/create/:courseId"
            element={
              <AdminRoute>
                <InteractiveLessonEditor />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/interactive/edit/:lessonId"
            element={
              <AdminRoute>
                <InteractiveLessonEditor />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/interactive/preview/:lessonId"
            element={
              <AdminRoute>
                <InteractiveLessonPreview />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/question-bank/quizzes/create"
            element={
              <AdminRoute>
                <QuestionBankQuizCreator />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/question-bank/quizzes"
            element={
              <AdminRoute>
                <QuestionBankQuizList />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/question-bank/quizzes/edit/:quizId"
            element={
              <AdminRoute>
                <QuestionBankQuizCreator />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/question-bank/questions"
            element={
              <AdminRoute>
                <QuestionBankQuestionList />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/question-bank/questions/create"
            element={
              <AdminRoute>
                <QuestionBankQuestionCreator />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/question-bank/questions/edit/:questionId"
            element={
              <AdminRoute>
                <QuestionBankQuestionCreator />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/reports/quiz-attempts"
            element={
              <AdminRoute>
                <QuizAttemptsReport />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/reports/assessment-difficulty"
            element={
              <AdminRoute>
                <AssessmentDifficultyReport />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/reports/surveys"
            element={
              <AdminRoute>
                <SurveyReport />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/reports/activity-logs"
            element={
              <AdminRoute>
                <SuperAdminActivityLogs />
              </AdminRoute>
            }
          />
        </Routes>
        <GlobalAIButton />
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