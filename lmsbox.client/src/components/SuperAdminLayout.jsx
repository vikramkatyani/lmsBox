import React from 'react';
import { Navigate } from 'react-router-dom';
import SuperAdminHeader from './SuperAdminHeader';
import { getUserRole } from '../utils/auth';

export default function SuperAdminLayout({ children }) {
  const role = getUserRole();
  
  // Check if user is SuperAdmin
  if (role !== 'SuperAdmin') {
    return <Navigate to="/superadmin/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SuperAdminHeader />
      <main>
        {children}
      </main>
    </div>
  );
}
