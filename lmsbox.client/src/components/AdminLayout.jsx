import React from 'react';
import AdminHeader from './AdminHeader';

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main>{children}</main>
    </div>
  );
}
