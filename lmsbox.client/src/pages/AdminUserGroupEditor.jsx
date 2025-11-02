import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import toast from 'react-hot-toast';
import { getUserGroup, saveUserGroup, listCoursesForMapping, listUsers } from '../services/userGroups';
import usePageTitle from '../hooks/usePageTitle';

export default function AdminUserGroupEditor() {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const isNew = !groupId;

  usePageTitle(isNew ? 'Add User Group' : 'Edit User Group');

  const [form, setForm] = useState({
    name: '',
    description: '',
    courseIds: [],
    userIds: []
  });

  const [submitted, setSubmitted] = useState(false);
  const [tab, setTab] = useState('details'); // details | courses | users

  // Course picker
  const [coursePickerOpen, setCoursePickerOpen] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const [courseOptions, setCourseOptions] = useState([]);
  const [courseLoading, setCourseLoading] = useState(false);

  // User picker
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userOptions, setUserOptions] = useState([]);
  const [userLoading, setUserLoading] = useState(false);

  useEffect(() => {
    if (!isNew) {
      (async () => {
        try {
          const g = await getUserGroup(groupId);
          setForm({
            name: g.name || '',
            description: g.description || '',
            courseIds: g.courseIds || [],
            userIds: g.userIds || []
          });
        } catch (e) {
          console.error(e);
          toast.error('Failed to load group');
        }
      })();
    }
  }, [isNew, groupId]);

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const openCoursePicker = async () => {
    setCoursePickerOpen(true);
    setCourseLoading(true);
    try {
      const items = await listCoursesForMapping('');
      setCourseOptions(items);
    } catch (e) {
      console.error(e);
      setCourseOptions([]);
    } finally {
      setCourseLoading(false);
    }
  };

  const searchCourses = async (term) => {
    setCourseSearch(term);
    setCourseLoading(true);
    try {
      const items = await listCoursesForMapping(term);
      setCourseOptions(items);
    } catch (e) {
      console.error(e);
      setCourseOptions([]);
    } finally {
      setCourseLoading(false);
    }
  };

  const toggleCourse = (cId) => {
    setForm((prev) => {
      const has = prev.courseIds.includes(cId);
      return { ...prev, courseIds: has ? prev.courseIds.filter((id) => id !== cId) : [...prev.courseIds, cId] };
    });
  };

  const openUserPicker = async () => {
    setUserPickerOpen(true);
    setUserLoading(true);
    try {
      const items = await listUsers('');
      setUserOptions(items);
    } catch (e) {
      console.error(e);
      setUserOptions([]);
    } finally {
      setUserLoading(false);
    }
  };

  const searchUsers = async (term) => {
    setUserSearch(term);
    setUserLoading(true);
    try {
      const items = await listUsers(term);
      setUserOptions(items);
    } catch (e) {
      console.error(e);
      setUserOptions([]);
    } finally {
      setUserLoading(false);
    }
  };

  const toggleUser = (uId) => {
    setForm((prev) => {
      const has = prev.userIds.includes(uId);
      return { ...prev, userIds: has ? prev.userIds.filter((id) => id !== uId) : [...prev.userIds, uId] };
    });
  };

  const onSave = async () => {
    setSubmitted(true);
    if (!form.name.trim()) {
      toast.error('Pathway name is required');
      return;
    }
    try {
      const payload = { id: groupId, ...form };
      await saveUserGroup(payload, !isNew);
      toast.success(isNew ? 'Learning pathway created' : 'Learning pathway updated');
      navigate('/admin/user-groups');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save pathway');
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
        <h1 className="text-3xl font-bold text-gray-900 mb-6">{isNew ? 'Create Learning Pathway' : 'Edit Learning Pathway'}</h1>

        <div className="bg-white rounded-lg shadow">
          {/* Tabs */}
          <div className="px-6 pt-4 border-b">
            <div className="flex gap-6">
              <button
                className={`pb-3 text-sm font-medium border-b-2 ${tab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                onClick={() => setTab('details')}
              >
                Details
              </button>
              <button
                className={`pb-3 text-sm font-medium border-b-2 ${tab === 'courses' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                onClick={() => setTab('courses')}
              >
                Courses ({form.courseIds.length})
              </button>
              <button
                className={`pb-3 text-sm font-medium border-b-2 ${tab === 'users' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                onClick={() => setTab('users')}
              >
                Users ({form.userIds.length})
              </button>
            </div>
          </div>

          {/* Details Tab */}
          {tab === 'details' && (
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pathway Name <span className="text-red-600">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className={`w-full border rounded px-4 py-2 ${submitted && !form.name.trim() ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Enter pathway name"
                />
                {submitted && !form.name.trim() && <p className="text-xs text-red-600 mt-1">Name is required.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  className="w-full border border-gray-300 rounded px-4 py-2"
                  rows={4}
                  placeholder="Describe this group"
                />
              </div>
            </div>
          )}

          {/* Courses Tab */}
          {tab === 'courses' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">Assign courses that all users in this group can access.</p>
                <button
                  onClick={openCoursePicker}
                  className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 cursor-pointer"
                >
                  Add Courses
                </button>
              </div>

              {form.courseIds.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No courses assigned yet.</div>
              ) : (
                <ul className="divide-y border rounded">
                  {form.courseIds.map((cId) => (
                    <li key={cId} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                      <span className="text-sm text-gray-900">{cId}</span>
                      <button
                        onClick={() => toggleCourse(cId)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {coursePickerOpen && (
                <div className="mt-3 border rounded p-3 bg-white">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      value={courseSearch}
                      onChange={(e) => searchCourses(e.target.value)}
                      className="flex-1 border rounded px-3 py-2"
                      placeholder="Search courses"
                    />
                    <button onClick={() => setCoursePickerOpen(false)} className="px-3 py-2 text-sm bg-gray-100 text-gray-800 rounded hover:bg-gray-200">
                      Close
                    </button>
                  </div>
                  {courseLoading ? (
                    <div className="text-sm text-gray-500">Loading...</div>
                  ) : courseOptions.length === 0 ? (
                    <div className="text-sm text-gray-500">No courses found.</div>
                  ) : (
                    <ul className="divide-y max-h-60 overflow-y-auto">
                      {courseOptions.map((c) => (
                        <li key={c.id} className="py-2 flex items-center justify-between">
                          <div>
                            <div className="text-sm text-gray-900">{c.title}</div>
                            <div className="text-xs text-gray-500">{c.id}</div>
                          </div>
                          <button
                            onClick={() => toggleCourse(c.id)}
                            className={`px-3 py-1.5 text-sm rounded ${
                              form.courseIds.includes(c.id)
                                ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}
                          >
                            {form.courseIds.includes(c.id) ? 'Remove' : 'Add'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Users Tab */}
          {tab === 'users' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">Assign users to this group.</p>
                <button
                  onClick={openUserPicker}
                  className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 cursor-pointer"
                >
                  Add Users
                </button>
              </div>

              {form.userIds.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No users assigned yet.</div>
              ) : (
                <ul className="divide-y border rounded">
                  {form.userIds.map((uId) => (
                    <li key={uId} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                      <span className="text-sm text-gray-900">{uId}</span>
                      <button
                        onClick={() => toggleUser(uId)}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {userPickerOpen && (
                <div className="mt-3 border rounded p-3 bg-white">
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      value={userSearch}
                      onChange={(e) => searchUsers(e.target.value)}
                      className="flex-1 border rounded px-3 py-2"
                      placeholder="Search users"
                    />
                    <button onClick={() => setUserPickerOpen(false)} className="px-3 py-2 text-sm bg-gray-100 text-gray-800 rounded hover:bg-gray-200">
                      Close
                    </button>
                  </div>
                  {userLoading ? (
                    <div className="text-sm text-gray-500">Loading...</div>
                  ) : userOptions.length === 0 ? (
                    <div className="text-sm text-gray-500">No users found.</div>
                  ) : (
                    <ul className="divide-y max-h-60 overflow-y-auto">
                      {userOptions.map((u) => (
                        <li key={u.id} className="py-2 flex items-center justify-between">
                          <div>
                            <div className="text-sm text-gray-900">{u.name}</div>
                            <div className="text-xs text-gray-500">{u.email}</div>
                          </div>
                          <button
                            onClick={() => toggleUser(u.id)}
                            className={`px-3 py-1.5 text-sm rounded ${
                              form.userIds.includes(u.id)
                                ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}
                          >
                            {form.userIds.includes(u.id) ? 'Remove' : 'Add'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="px-6 py-4 border-t flex justify-end gap-3">
            <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
              Cancel
            </button>
            <button onClick={onSave} className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 cursor-pointer">
              Save Learning Pathway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
