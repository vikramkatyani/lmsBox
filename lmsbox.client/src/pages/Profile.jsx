import React, { useEffect, useState } from 'react';
import { getMyProfile } from '../services/profile';
import AdminHeader from '../components/AdminHeader';
import LearnerHeader from '../components/LearnerHeader';
import usePageTitle from '../hooks/usePageTitle';

export default function Profile() {
  usePageTitle('My Profile');
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getMyProfile();
        setProfile(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Detect role for header
  const isAdminUser = profile?.roles?.some((role) =>
    ['admin', 'Admin', 'OrgAdmin', 'TenantAdmin', 'SuperAdmin'].includes(role)
  );

  if (loading) {
    return (
      <>
        {isAdminUser ? <AdminHeader /> : <LearnerHeader />}
        <div className="max-w-2xl mx-auto py-12 text-center text-gray-500">Loading profile...</div>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        {isAdminUser ? <AdminHeader /> : <LearnerHeader />}
        <div className="max-w-2xl mx-auto py-12 text-center text-red-500">Failed to load profile.</div>
      </>
    );
  }

  return (
    <>
      {isAdminUser ? <AdminHeader /> : <LearnerHeader />}
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">My Profile</h1>
        <div className="bg-white rounded-lg shadow p-6 space-y-6 border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-gray-500">Full Name</div>
              <div className="text-lg font-medium text-gray-900">{profile.firstName} {profile.lastName}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Email</div>
              <div className="text-lg font-medium text-gray-900">{profile.email}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Organisation</div>
              <div className="text-lg font-medium text-gray-900">{profile.organisation || '—'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Role(s)</div>
              <div className="text-lg font-medium text-gray-900">{profile.roles?.join(', ') || '—'}</div>
            </div>
          </div>

          <div>
            <div className="text-sm text-gray-500 mb-2">Assigned Learning Pathways</div>
            {profile.assignedPathways && profile.assignedPathways.length > 0 ? (
              <ul className="list-disc pl-6 space-y-1">
                {profile.assignedPathways.map((p) => (
                  <li key={p.id} className="text-gray-800">{p.title || p.id}</li>
                ))}
              </ul>
            ) : (
              <div className="text-gray-400">No pathways assigned.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
