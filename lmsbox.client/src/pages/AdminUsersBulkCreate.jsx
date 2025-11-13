import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import toast from 'react-hot-toast';
import { bulkCreateUsers } from '../services/users';
import { listUserGroups } from '../services/learningPathways';
import usePageTitle from '../hooks/usePageTitle';

export default function AdminUsersBulkCreate() {
  const navigate = useNavigate();
  usePageTitle('Bulk Add Users');

  const [emailsText, setEmailsText] = useState('');
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupOptions, setGroupOptions] = useState([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [selectedPathways, setSelectedPathways] = useState([]); // array of {id, name}
  const [submitting, setSubmitting] = useState(false);

  const openGroupPicker = async () => {
    setGroupPickerOpen(true);
    setGroupLoading(true);
    try {
      const result = await listUserGroups({ search: '' });
      const assignedIds = selectedPathways.map(p => String(p.id));
      const availablePathways = (result.items || []).filter(item => !assignedIds.includes(String(item.id)));
      setGroupOptions(availablePathways);
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
      const result = await listUserGroups({ search: term });
      const assignedIds = selectedPathways.map(p => String(p.id));
      const availablePathways = (result.items || []).filter(item => !assignedIds.includes(String(item.id)));
      setGroupOptions(availablePathways);
    } catch (e) {
      console.error(e);
      setGroupOptions([]);
    } finally {
      setGroupLoading(false);
    }
  };

  const toggleGroup = (gId, gName) => {
    setSelectedPathways(prev => {
      const has = prev.some(p => p.id === gId);
      if (has) return prev.filter(p => p.id !== gId);
      return [...prev, { id: gId, name: gName }];
    });
  };

  const onSubmit = async () => {
    const emails = emailsText
      .split(/[\n,;\s]+/)
      .map(e => e.trim())
      .filter(e => e.length > 0);

    if (emails.length === 0) {
      toast.error('Please enter at least one email');
      return;
    }

    setSubmitting(true);
    try {
      const groupIds = selectedPathways.map(p => String(p.id));
      const res = await bulkCreateUsers({ emailsText: emailsText, emails: null, groupIds });
      const { summary } = res || {};
      toast.success(`Created: ${summary?.created || 0}, Skipped: ${summary?.skipped || 0}, Failed: ${summary?.failed || 0}`);
      navigate('/admin/users');
    } catch (e) {
      console.error(e);
      toast.error(e.response?.data?.message || 'Bulk create failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 hover:text-gray-900 mb-4">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Bulk Add Users</h1>

        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Add Multiple Users</h2>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Emails (comma, semicolon, or newline separated)</label>
              <textarea
                value={emailsText}
                onChange={e => setEmailsText(e.target.value)}
                className="w-full min-h-40 border border-gray-300 rounded px-4 py-2"
                placeholder="user1@example.com, user2@example.com\nuser3@example.com"
              />
              <p className="text-xs text-gray-500 mt-1">Users will be created with role Learner and Active status. First and last name will be requested on first login.</p>
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">Assign to Learning Pathways (optional)</label>
                <button
                  type="button"
                  onClick={openGroupPicker}
                  className="px-3 py-1.5 text-sm bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 cursor-pointer"
                >
                  Select Pathways
                </button>
              </div>

              {selectedPathways.length === 0 ? (
                <div className="text-center text-gray-500 py-4 text-sm">No pathways selected.</div>
              ) : (
                <ul className="divide-y border rounded">
                  {selectedPathways.map((p) => (
                    <li key={p.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                      <span className="text-sm text-gray-900">{p.name}</span>
                      <button type="button" onClick={() => toggleGroup(p.id, p.name)} className="text-sm text-red-600 hover:text-red-700">Remove</button>
                    </li>
                  ))}
                </ul>
              )}

              {groupPickerOpen && (
                <div className="mt-3 border rounded p-3 bg-white">
                  <div className="flex items-center gap-2 mb-3">
                    <input value={groupSearch} onChange={(e) => searchGroups(e.target.value)} className="flex-1 border rounded px-3 py-2" placeholder="Search pathways" />
                    <button type="button" onClick={() => setGroupPickerOpen(false)} className="px-3 py-2 text-sm bg-gray-100 text-gray-800 rounded hover:bg-gray-200">Close</button>
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
                            onClick={() => toggleGroup(g.id, g.name)}
                            className={`px-3 py-1.5 text-sm rounded ${
                              selectedPathways.some(p => p.id === g.id) ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}
                          >
                            {selectedPathways.some(p => p.id === g.id) ? 'Remove' : 'Add'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="px-6 py-4 border-t flex justify-end gap-3">
            <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Cancel</button>
            <button disabled={submitting} onClick={onSubmit} className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 disabled:opacity-50">Create Users</button>
          </div>
        </div>
      </div>
    </div>
  );
}
