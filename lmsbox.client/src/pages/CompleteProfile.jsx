import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import LearnerHeader from '../components/LearnerHeader';
import { getMyProfile, updateMyProfile } from '../services/profile';
import { getUserRole } from '../utils/auth';
import toast from 'react-hot-toast';
import usePageTitle from '../hooks/usePageTitle';

export default function CompleteProfile() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const role = getUserRole();

  usePageTitle('Complete Your Profile');

  useEffect(() => {
    (async () => {
      try {
        const me = await getMyProfile();
        setForm({ firstName: me.firstName || '', lastName: me.lastName || '' });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('Please enter both first and last name');
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile({ firstName: form.firstName.trim(), lastName: form.lastName.trim() });
      toast.success('Profile updated');
      // Redirect based on role
      if (role === 'admin' || role === 'Admin' || role === 'OrgAdmin' || role === 'SuperAdmin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/courses/all');
      }
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const Header = (role === 'admin' || role === 'Admin' || role === 'OrgAdmin' || role === 'SuperAdmin') ? AdminHeader : LearnerHeader;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Complete Your Profile</h1>
        <p className="text-sm text-gray-600 mb-6">Please provide your name to continue using the platform.</p>
        <div className="bg-white rounded-lg shadow p-6">
          {loading ? (
            <div className="text-gray-500">Loading...</div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="w-full border rounded px-4 py-2 border-gray-300" placeholder="First name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="w-full border rounded px-4 py-2 border-gray-300" placeholder="Last name" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Back</button>
                <button disabled={saving} onClick={onSave} className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 disabled:opacity-50">Save and Continue</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
