import React from 'react';
import AdminHeader from '../components/AdminHeader';
import usePageTitle from '../hooks/usePageTitle';

export default function AdminReports() {
  usePageTitle('Reports & Analytics');
  
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Reports & Analytics</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">User Reports</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-500">User activity and engagement reports will be displayed here.</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Course Reports</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-500">Course completion and performance metrics will be displayed here.</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Certificate Reports</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-500">Certificate issuance reports will be displayed here.</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">System Analytics</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-500">Overall system usage analytics will be displayed here.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
