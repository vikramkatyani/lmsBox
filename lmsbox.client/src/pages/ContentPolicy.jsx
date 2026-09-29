import { Link } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import ContentPolicyDocument from '../components/ContentPolicyDocument';
import usePageTitle from '../hooks/usePageTitle';

export default function ContentPolicy() {
  usePageTitle('Content Policy');

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link to="/admin/courses" className="text-sm text-gray-600 hover:text-gray-900">
            Back to courses
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-gray-900">Content Policy</h1>
          <p className="mt-2 text-sm text-gray-600">
            Administrators must acknowledge and accept this policy before creating a new course.
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 sm:p-8">
          <ContentPolicyDocument />
        </div>
      </div>
    </div>
  );
}
