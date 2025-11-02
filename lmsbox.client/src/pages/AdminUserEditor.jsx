import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import toast from 'react-hot-toast';
import { getUser, saveUser } from '../services/users';
import { listUserGroups } from '../services/userGroups';
import usePageTitle from '../hooks/usePageTitle';

export default function AdminUserEditor() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const isNew = !userId;

  usePageTitle(isNew ? 'Add User' : 'Edit User');

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    groupIds: [],
    role: 'Learner',
    status: 'Active'
  });

  const [submitted, setSubmitted] = useState(false);

  // Group picker
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupOptions, setGroupOptions] = useState([]);
  const [groupLoading, setGroupLoading] = useState(false);

  useEffect(() => {
    if (!isNew) {
      (async () => {
        try {
          const u = await getUser(userId);
          setForm({
            firstName: u.firstName || '',
            lastName: u.lastName || '',
            email: u.email || '',
            groupIds: u.groupIds || [],
            role: u.role || 'Learner',
            status: u.status || 'Active'
          });
        } catch (e) {
          console.error(e);
          
          // Display detailed error message
          let errorMessage = 'Failed to load user';
          
          if (e.response?.data?.message) {
            errorMessage = e.response.data.message;
          } else if (e.message) {
            errorMessage = e.message;
          }
          
          // Handle specific error cases
          if (e.response?.status === 404) {
            errorMessage = 'User not found. It may have been deleted.';
            // Navigate back after a short delay
            setTimeout(() => navigate('/admin/users'), 2000);
          } else if (e.response?.status === 403) {
            errorMessage = 'You do not have permission to view this user.';
          } else if (e.response?.status === 500) {
            errorMessage = 'Server error occurred while loading user. Please try again.';
          } else if (!e.response) {
            errorMessage = 'Network error. Please check your connection and try again.';
          }
          
          toast.error(errorMessage);
        }
      })();
    }
  }, [isNew, userId, navigate]);

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const openGroupPicker = async () => {
    setGroupPickerOpen(true);
    setGroupLoading(true);
    try {
      const items = await listUserGroups('');
      setGroupOptions(items);
    } catch (e) {
      console.error(e);
      setGroupOptions([]);
    } finally {
      setGroupLoading(false);
    }
  };

  const searchGroups = async (term) => {
    setGroupSearch(term);
    setGroupLoading(true);
    try {
      const items = await listUserGroups(term);
      setGroupOptions(items);
    } catch (e) {
      console.error(e);
      setGroupOptions([]);
    } finally {
      setGroupLoading(false);
    }
  };

  const toggleGroup = (gId) => {
    setForm((prev) => {
      const has = prev.groupIds.includes(gId);
      return { ...prev, groupIds: has ? prev.groupIds.filter((id) => id !== gId) : [...prev.groupIds, gId] };
    });
  };

  const isValid = () => {
    return form.firstName.trim() && form.lastName.trim() && form.email.trim();
  };

  const onSave = async () => {
    setSubmitted(true);
    if (!isValid()) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      const payload = { id: userId, ...form };
      const response = await saveUser(payload, !isNew);
      
      // Display success message with details
      if (isNew) {
        const message = response?.message || 'User created successfully';
        const emailStatus = response?.emailStatus;
        
        if (emailStatus === 'failed') {
          toast.success(`${message}`, {
            duration: 6000 // Show longer for important info
          });
          // Show a warning about email failure
          setTimeout(() => {
            toast.error('Registration email failed to send. You may need to manually notify the user.', {
              duration: 8000
            });
          }, 1000);
        } else {
          toast.success(`${message}${response?.id ? ` (ID: ${response.id})` : ''}`);
        }
      } else {
        const message = response?.message || 'User updated successfully';
        toast.success(message);
      }
      
      navigate('/admin/users');
    } catch (e) {
      console.error('Error saving user:', e);
      
      // Simple and robust error message extraction
      let errorMessage = 'Failed to save user';
      
      // Try different ways to get the error message
      if (e.response?.data?.message) {
        errorMessage = e.response.data.message;
      } else if (e.message && e.message !== 'Request failed with status code 400') {
        errorMessage = e.message;
      } else if (e.response?.data) {
        // Sometimes the message might be directly in data or have a different structure
        if (typeof e.response.data === 'string') {
          errorMessage = e.response.data;
        } else if (e.response.data.error) {
          errorMessage = e.response.data.error;
        }
      }
      
      // Handle duplicate email specifically
      if (errorMessage.toLowerCase().includes('email already exists') || 
          errorMessage.toLowerCase().includes('user with this email')) {
        errorMessage = 'A user with this email address already exists. Please use a different email.';
      }
      
      toast.error(errorMessage, { duration: 5000 });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 hover:text-gray-900 mb-4">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-6">{isNew ? 'Add New User' : 'Edit User'}</h1>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">{isNew ? 'New User' : `User: ${userId}`}</h2>
          </div>

          <div className="p-6 space-y-6">
            {/* Personal Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span className="text-red-600">*</span>
                </label>
                <input
                  value={form.firstName}
                  onChange={(e) => handleChange('firstName', e.target.value)}
                  className={`w-full border rounded px-4 py-2 ${submitted && !form.firstName.trim() ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="First name"
                />
                {submitted && !form.firstName.trim() && <p className="text-xs text-red-600 mt-1">Required</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name <span className="text-red-600">*</span>
                </label>
                <input
                  value={form.lastName}
                  onChange={(e) => handleChange('lastName', e.target.value)}
                  className={`w-full border rounded px-4 py-2 ${submitted && !form.lastName.trim() ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Last name"
                />
                {submitted && !form.lastName.trim() && <p className="text-xs text-red-600 mt-1">Required</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className={`w-full border rounded px-4 py-2 ${submitted && !form.email.trim() ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="user@example.com"
              />
              {submitted && !form.email.trim() && <p className="text-xs text-red-600 mt-1">Required</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={form.role} onChange={(e) => handleChange('role', e.target.value)} className="w-full border rounded px-4 py-2">
                  <option value="Learner">Learner</option>
                  <option value="OrgAdmin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select value={form.status} onChange={(e) => handleChange('status', e.target.value)} className="w-full border rounded px-4 py-2">
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>
            </div>

            {/* Groups */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">Learning Pathways</label>
                <button
                  type="button"
                  onClick={openGroupPicker}
                  className="px-3 py-1.5 text-sm bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 cursor-pointer"
                >
                  Add to Pathways
                </button>
              </div>

              {form.groupIds.length === 0 ? (
                <div className="text-center text-gray-500 py-4 text-sm">No pathways assigned yet.</div>
              ) : (
                <ul className="divide-y border rounded">
                  {form.groupIds.map((gId) => (
                    <li key={gId} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                      <span className="text-sm text-gray-900">{gId}</span>
                      <button
                        type="button"
                        onClick={() => toggleGroup(gId)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {groupPickerOpen && (
                <div className="mt-3 border rounded p-3 bg-white">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      value={groupSearch}
                      onChange={(e) => searchGroups(e.target.value)}
                      className="flex-1 border rounded px-3 py-2"
                      placeholder="Search groups"
                    />
                    <button type="button" onClick={() => setGroupPickerOpen(false)} className="px-3 py-2 text-sm bg-gray-100 text-gray-800 rounded hover:bg-gray-200">
                      Close
                    </button>
                  </div>
                  {groupLoading ? (
                    <div className="text-sm text-gray-500">Loading...</div>
                  ) : groupOptions.length === 0 ? (
                    <div className="text-sm text-gray-500">No pathways found.</div>
                  ) : (
                    <ul className="divide-y max-h-60 overflow-y-auto">
                      {groupOptions.map((g) => (
                        <li key={g.id} className="py-2 flex items-center justify-between">
                          <div>
                            <div className="text-sm text-gray-900">{g.name}</div>
                            <div className="text-xs text-gray-500">{g.description}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleGroup(g.id)}
                            className={`px-3 py-1.5 text-sm rounded ${
                              form.groupIds.includes(g.id)
                                ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}
                          >
                            {form.groupIds.includes(g.id) ? 'Remove' : 'Add'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 py-4 border-t flex justify-end gap-3">
            <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
              Cancel
            </button>
            <button onClick={onSave} className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 cursor-pointer">
              {isNew ? 'Create User' : 'Update User'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
