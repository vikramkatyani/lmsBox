import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import VerifyLogin from './pages/VerifyLogin';
import AuthTest from './pages/AuthTest';
import Courses from './pages/Courses';
import Certificates from './pages/certificates';
import CourseContent from './pages/CourseContent';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminCourses from './pages/AdminCourses';
import AdminReports from './pages/AdminReports';
import AdminCourseEditor from './pages/AdminCourseEditor';
import AdminUserGroups from './pages/AdminUserGroups';
import AdminUserGroupEditor from './pages/AdminUserGroupEditor';
import AdminUserEditor from './pages/AdminUserEditor';
import QuizCreator from './pages/QuizCreator';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import { ThemeProvider } from './theme/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
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
            path="/admin/users/:userId/edit"
            element={
              <AdminRoute>
                <AdminUserEditor />
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
            path="/admin/reports"
            element={
              <AdminRoute>
                <AdminReports />
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