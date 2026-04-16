import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import AdminHeader from '../components/AdminHeader';
import usePageTitle from '../hooks/usePageTitle';
import {
  archiveAutomationTask,
  createAutomationTask,
  getAutomationTask,
  listAutomationLearningPathways,
  listAutomationTasks,
  pauseAutomationTask,
  previewAutomationAudience,
  publishAutomationTask,
  resumeAutomationTask,
  updateAutomationTask
} from '../services/automation';

const taskTypes = ['Notification', 'Reminder', 'Announcement'];
const statusOptions = ['Draft', 'Published', 'Paused', 'Archived'];

const emptyForm = {
  type: 'Notification',
  title: '',
  description: '',
  eventKey: 'LearningPathwayAssignment',
  emailSubject: '',
  emailBodyHtml: '',
  scheduleMode: 'Immediate',
  intervalMinutes: '',
  daysAfterAssignment: '',
  audienceType: 'AllUsers',
  learningPathwayIds: [],
  announcementSendAtLocal: ''
};

function toDateTimeLocal(value) {
  if (!value) return '';
  const raw = String(value);
  if (raw.length >= 16 && raw.includes('T')) {
    return raw.replace('Z', '').slice(0, 16);
  }
  return '';
}

function RichTextEditor({ value, onChange }) {
  const editorRef = React.useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const applyCommand = (command, argument = null) => {
    editorRef.current?.focus();
    document.execCommand(command, false, argument);
    onChange(editorRef.current?.innerHTML || '');
  };

  const addLink = () => {
    const url = window.prompt('Enter URL');
    if (!url) return;
    applyCommand('createLink', url);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-300 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b bg-gray-50 px-3 py-2">
        <select
          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
          onChange={(e) => {
            if (e.target.value) applyCommand('formatBlock', e.target.value);
            e.target.value = '';
          }}
          defaultValue=""
        >
          <option value="" disabled>Style</option>
          <option value="P">Paragraph</option>
          <option value="H2">Heading</option>
          <option value="BLOCKQUOTE">Quote</option>
        </select>
        <button type="button" onClick={() => applyCommand('bold')} className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100">B</button>
        <button type="button" onClick={() => applyCommand('italic')} className="rounded border border-gray-300 bg-white px-2 py-1 text-xs italic text-gray-700 hover:bg-gray-100">I</button>
        <button type="button" onClick={() => applyCommand('underline')} className="rounded border border-gray-300 bg-white px-2 py-1 text-xs underline text-gray-700 hover:bg-gray-100">U</button>
        <button type="button" onClick={() => applyCommand('insertUnorderedList')} className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-100">Bullets</button>
        <button type="button" onClick={() => applyCommand('insertOrderedList')} className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-100">Numbered</button>
        <button type="button" onClick={addLink} className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-100">Link</button>
        <button type="button" onClick={() => applyCommand('removeFormat')} className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-100">Clear</button>
      </div>
      <div
        ref={editorRef}
        className="min-h-[220px] bg-white p-4 text-sm leading-relaxed text-gray-800 outline-none"
        contentEditable
        onInput={() => onChange(editorRef.current?.innerHTML || '')}
        data-placeholder="Write your automation email content..."
        suppressContentEditableWarning
      />
      <div className="border-t bg-gray-50 px-3 py-2 text-xs text-gray-500">
        Use headings, bullets, links, and emphasis to create a clear email.
      </div>
    </div>
  );
}

function SearchablePathwayMultiSelect({
  label,
  pathways,
  selectedIds,
  onChange,
  loading,
  searchPlaceholder = 'Search pathways...'
}) {
  const [query, setQuery] = useState('');

  const filteredPathways = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return pathways;
    return pathways.filter((pathway) => (pathway.name || '').toLowerCase().includes(keyword));
  }, [pathways, query]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const filteredIds = useMemo(() => filteredPathways.map((pathway) => pathway.id), [filteredPathways]);

  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedSet.has(id));

  const toggleFiltered = (checked) => {
    const next = new Set(selectedIds);
    filteredIds.forEach((id) => {
      if (checked) next.add(id);
      else next.delete(id);
    });
    onChange(Array.from(next));
  };

  const toggleOne = (id, checked) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onChange(Array.from(next));
  };

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">{label}</label>

      {loading ? (
        <p className="text-sm text-gray-500">Loading learning pathways...</p>
      ) : (
        <div className="rounded border border-gray-300 p-3">
          <div className="mb-3 flex items-center gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <span className="whitespace-nowrap text-xs text-gray-500">{selectedIds.length} selected</span>
          </div>

          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={(e) => toggleFiltered(e.target.checked)}
            />
            Select all filtered
          </label>

          <div className="max-h-44 space-y-2 overflow-y-auto">
            {filteredPathways.length === 0 ? (
              <div className="py-2 text-sm text-gray-500">No pathways match your search.</div>
            ) : (
              filteredPathways.map((pathway) => (
                <label key={pathway.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(pathway.id)}
                    onChange={(e) => toggleOne(pathway.id, e.target.checked)}
                  />
                  {pathway.name}
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, hint, children }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50/40 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function TaskModal({
  isOpen,
  editingId,
  form,
  setForm,
  pathways,
  pathwaysLoading,
  onClose,
  onSaveDraft,
  onPublish
}) {
  if (!isOpen) return null;

  const isNotification = form.type === 'Notification';
  const isReminder = form.type === 'Reminder';
  const isAnnouncement = form.type === 'Announcement';

  const title = editingId ? `Edit ${form.type}` : `Create ${form.type}`;

  const setValue = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="fixed inset-0 z-80 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded px-3 py-1 text-sm text-gray-600 hover:bg-gray-100">Close</button>
        </div>

        <div className="space-y-6 p-6">
          <SectionCard
            title="Notification Labels"
            hint="Used internally by admins for identifying and managing this automation task."
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
                <input
                  value={form.title}
                  onChange={(e) => setValue('title', e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2"
                  placeholder="Example: Monthly pathway completion notice"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setValue('description', e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2"
                  placeholder="Internal notes for admins"
                />
              </div>
            </div>
          </SectionCard>

          {(isNotification || isReminder) && (
            <SectionCard
              title="Trigger Rules"
              hint="Choose when this automation should run."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Event</label>
                  <select
                    className="w-full rounded border border-gray-300 px-3 py-2"
                    value={form.eventKey}
                    onChange={(e) => setValue('eventKey', e.target.value)}
                  >
                    {isNotification && (
                      <>
                        <option value="LearningPathwayAssignment">Learning Pathway Assignment</option>
                        <option value="LearningPathwayCompletion">Learning Pathway Completion</option>
                      </>
                    )}
                    {isReminder && (
                      <>
                        <option value="NotStarted">Not Started</option>
                        <option value="InProgress">In Progress</option>
                        <option value="NotCompleted">Not Completed</option>
                      </>
                    )}
                  </select>
                </div>

                {isNotification && (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Send Timing</label>
                      <select
                        className="w-full rounded border border-gray-300 px-3 py-2"
                        value={form.scheduleMode}
                        onChange={(e) => {
                          const mode = e.target.value;
                          setValue('scheduleMode', mode);
                          if (mode === 'StandardNotification') {
                            setValue('intervalMinutes', '');
                          }
                        }}
                      >
                        <option value="Immediate">Immediate</option>
                        <option value="StandardNotification">Send with Standard Notification</option>
                      </select>
                      {form.scheduleMode === 'StandardNotification' && (
                        <p className="mt-1 text-xs text-gray-500">Email is queued for the daily scheduler run at 8:45 AM.</p>
                      )}
                    </div>
                  </>
                )}

                {isReminder && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Days After Assignment</label>
                    <input
                      type="number"
                      min="1"
                      value={form.daysAfterAssignment}
                      onChange={(e) => setValue('daysAfterAssignment', e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2"
                    />
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {(isNotification || isReminder) && (
            <SectionCard
              title="Audience"
              hint="Select one or more pathways that define recipients."
            >
              <SearchablePathwayMultiSelect
                label="Learning Pathways"
                pathways={pathways}
                selectedIds={form.learningPathwayIds}
                onChange={(ids) => setValue('learningPathwayIds', ids)}
                loading={pathwaysLoading}
              />
            </SectionCard>
          )}

          {isAnnouncement && (
            <SectionCard
              title="Audience & Schedule"
              hint="Choose who receives the announcement and when it should be sent."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Audience</label>
                  <select
                    className="w-full rounded border border-gray-300 px-3 py-2"
                    value={form.audienceType}
                    onChange={(e) => setValue('audienceType', e.target.value)}
                  >
                    <option value="AllUsers">All users</option>
                    <option value="LearningPathways">Users with specific learning pathways</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Announcement Date and Time</label>
                  <input
                    type="datetime-local"
                    value={form.announcementSendAtLocal}
                    onChange={(e) => setValue('announcementSendAtLocal', e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>

              {form.audienceType === 'LearningPathways' && (
                <SearchablePathwayMultiSelect
                  label="Learning Pathways (multi-select)"
                  pathways={pathways}
                  selectedIds={form.learningPathwayIds}
                  onChange={(ids) => setValue('learningPathwayIds', ids)}
                  loading={pathwaysLoading}
                />
              )}
            </SectionCard>
          )}

          <SectionCard
            title="Email Content"
            hint="This is the message learners will receive by email."
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email Subject</label>
              <input
                value={form.emailSubject}
                onChange={(e) => setValue('emailSubject', e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
                placeholder="What recipients see in their inbox"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email Body</label>
              <RichTextEditor value={form.emailBodyHtml} onChange={(html) => setValue('emailBodyHtml', html)} />
            </div>
          </SectionCard>

          <SectionCard
            title="Before You Publish"
            hint="Quick summary to help confirm task setup."
          >
            <div className="grid grid-cols-1 gap-2 text-sm text-gray-700 md:grid-cols-2">
              <div><span className="font-medium text-gray-900">Type:</span> {form.type}</div>
              <div><span className="font-medium text-gray-900">Event:</span> {form.eventKey || 'N/A'}</div>
              <div><span className="font-medium text-gray-900">Pathways:</span> {form.learningPathwayIds.length}</div>
              <div><span className="font-medium text-gray-900">Audience:</span> {form.audienceType || 'N/A'}</div>
              <div className="md:col-span-2"><span className="font-medium text-gray-900">Send at:</span> {form.announcementSendAtLocal || (form.scheduleMode === 'StandardNotification' ? 'Daily scheduler at 8:45 AM' : 'Immediate')}</div>
            </div>
          </SectionCard>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t bg-white px-6 py-4">
          <button
            onClick={onSaveDraft}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Save Draft
          </button>
          <button
            onClick={onPublish}
            className="rounded bg-boxlms-primary-btn px-4 py-2 text-sm font-medium text-boxlms-primary-btn-txt hover:brightness-90"
          >
            Publish
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminAutomation() {
  usePageTitle('Automation');

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const [pathways, setPathways] = useState([]);
  const [pathwaysLoading, setPathwaysLoading] = useState(false);

  const statusClass = useMemo(() => ({
    Draft: 'bg-gray-100 text-gray-700',
    Published: 'bg-green-100 text-green-700',
    Paused: 'bg-yellow-100 text-yellow-700',
    Archived: 'bg-red-100 text-red-700'
  }), []);

  const statusDotClass = useMemo(() => ({
    Draft: 'bg-gray-400',
    Published: 'bg-green-500',
    Paused: 'bg-yellow-500',
    Archived: 'bg-red-500'
  }), []);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const result = await listAutomationTasks({
        page: 1,
        pageSize: 100,
        search,
        type: typeFilter,
        status: statusFilter
      });
      setTasks(result.items || []);
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Failed to load automation tasks');
    } finally {
      setLoading(false);
    }
  };

  const loadLookups = async () => {
    setPathwaysLoading(true);

    try {
      const loadedPathways = await listAutomationLearningPathways();
      setPathways(loadedPathways);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load automation lookups');
    } finally {
      setPathwaysLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const openCreate = async (type) => {
    await loadLookups();
    setEditingId(null);
    setForm({ ...emptyForm, type });
    setIsModalOpen(true);
  };

  const openEdit = async (id) => {
    await loadLookups();
    try {
      const task = await getAutomationTask(id);
      setEditingId(id);
      setForm({
        type: task.type,
        title: task.title || '',
        description: task.description || '',
        eventKey: task.eventKey || (task.type === 'Reminder' ? 'NotStarted' : 'LearningPathwayAssignment'),
        emailSubject: task.emailSubject || '',
        emailBodyHtml: task.emailBodyHtml || '',
        scheduleMode: task.scheduleMode === 'Delayed' ? 'StandardNotification' : (task.scheduleMode || 'Immediate'),
        intervalMinutes: task.intervalMinutes || '',
        daysAfterAssignment: task.daysAfterAssignment || '',
        audienceType: task.audienceType || 'AllUsers',
        learningPathwayIds: task.learningPathwayIds || [],
        announcementSendAtLocal: toDateTimeLocal(task.announcementSendAtLocal)
      });
      setIsModalOpen(true);
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Failed to load task details');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const selectedCourseIdsFromPathways = useMemo(() => {
    if (!form.learningPathwayIds?.length || !pathways?.length) return [];

    const courseIdSet = new Set();
    pathways
      .filter((pathway) => form.learningPathwayIds.includes(pathway.id))
      .forEach((pathway) => {
        (pathway.courseIds || []).forEach((courseId) => courseIdSet.add(courseId));
      });

    return Array.from(courseIdSet);
  }, [form.learningPathwayIds, pathways]);

  const toPayload = () => ({
    type: form.type,
    title: form.title,
    description: form.description,
    eventKey: form.eventKey,
    courseIds: form.type === 'Announcement' ? [] : selectedCourseIdsFromPathways,
    emailSubject: form.emailSubject,
    emailBodyHtml: form.emailBodyHtml,
    scheduleMode: form.scheduleMode,
    intervalMinutes: form.scheduleMode === 'StandardNotification' ? null : (form.intervalMinutes ? Number(form.intervalMinutes) : null),
    daysAfterAssignment: form.daysAfterAssignment ? Number(form.daysAfterAssignment) : null,
    audienceType: form.audienceType,
    learningPathwayIds: form.learningPathwayIds,
    announcementSendAtLocal: form.announcementSendAtLocal ? `${form.announcementSendAtLocal}:00` : null,
    timeZoneId: 'UTC'
  });

  const saveDraft = async () => {
    try {
      const payload = toPayload();
      if (editingId) await updateAutomationTask(editingId, payload);
      else await createAutomationTask(payload);

      toast.success('Draft saved');
      closeModal();
      loadTasks();
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Failed to save draft');
    }
  };

  const publishFromModal = async () => {
    try {
      const payload = toPayload();
      let taskId = editingId;

      if (taskId) {
        await updateAutomationTask(taskId, payload);
      } else {
        const created = await createAutomationTask(payload);
        taskId = created?.id;
      }

      if (!taskId) {
        toast.error('Task ID not available for publish');
        return;
      }

      await publishAutomationTask(taskId);
      toast.success('Task published');
      closeModal();
      loadTasks();
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Failed to publish task');
    }
  };

  const publishFromList = async (id) => {
    try {
      await publishAutomationTask(id);
      toast.success('Task published');
      loadTasks();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to publish task');
    }
  };

  const pauseFromList = async (id) => {
    try {
      await pauseAutomationTask(id);
      toast.success('Task paused');
      loadTasks();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to pause task');
    }
  };

  const resumeFromList = async (id) => {
    try {
      await resumeAutomationTask(id);
      toast.success('Task resumed');
      loadTasks();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to resume task');
    }
  };

  const archiveFromList = async (id) => {
    if (!window.confirm('Archive this automation task?')) return;

    try {
      await archiveAutomationTask(id);
      toast.success('Task archived');
      loadTasks();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to archive task');
    }
  };

  const previewAudience = async () => {
    if (form.type !== 'Announcement') return;

    try {
      const result = await previewAutomationAudience({
        audienceType: form.audienceType,
        learningPathwayIds: form.learningPathwayIds
      });
      toast.success(`Audience preview: ${result.recipientCount} users`);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to preview audience');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold text-gray-900">Automation</h1>
          <AddAutomationTaskMenu onAdd={openCreate} />
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg bg-white p-4 shadow md:grid-cols-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks"
            className="rounded border border-gray-300 px-3 py-2"
          />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded border border-gray-300 px-3 py-2">
            <option value="">All types</option>
            {taskTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded border border-gray-300 px-3 py-2">
            <option value="">All statuses</option>
            {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={loadTasks} className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Apply Filters</button>
        </div>

        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Event/Audience</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">Loading...</td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">No automation tasks found.</td>
                </tr>
              ) : (
                tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="group relative inline-block max-w-full">
                        <div className="flex max-w-[320px] items-center gap-2 truncate font-medium underline decoration-dotted decoration-gray-400 underline-offset-2">
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusDotClass[task.status] || 'bg-gray-400'}`} aria-hidden="true" />
                          {task.title}
                        </div>
                        <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-80 rounded-md border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-700 shadow-lg group-hover:block">
                          {task.description?.trim() || 'No description provided.'}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">ID: {task.id}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{task.type}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{task.eventKey || task.audienceType}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`rounded px-2 py-1 text-xs font-medium ${statusClass[task.status] || 'bg-gray-100 text-gray-700'}`}>{task.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEdit(task.id)} className="rounded bg-info px-2 py-1 text-xs text-[#1b365d] hover:bg-[#d9e5f2]">Edit</button>
                        {task.status === 'Draft' && <button onClick={() => publishFromList(task.id)} className="rounded bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100">Publish</button>}
                        {task.status === 'Published' && <button onClick={() => pauseFromList(task.id)} className="rounded bg-yellow-50 px-2 py-1 text-xs text-yellow-700 hover:bg-yellow-100">Pause</button>}
                        {task.status === 'Paused' && <button onClick={() => resumeFromList(task.id)} className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100">Resume</button>}
                        {task.status !== 'Archived' && <button onClick={() => archiveFromList(task.id)} className="rounded bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100">Archive</button>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TaskModal
        isOpen={isModalOpen}
        editingId={editingId}
        form={form}
        setForm={setForm}
        pathways={pathways}
        pathwaysLoading={pathwaysLoading}
        onClose={closeModal}
        onSaveDraft={saveDraft}
        onPublish={publishFromModal}
      />

      {isModalOpen && form.type === 'Announcement' && (
        <button
          onClick={previewAudience}
          className="fixed bottom-5 right-5 rounded-full bg-boxlms-primary-btn px-4 py-2 text-sm font-medium text-boxlms-primary-btn-txt shadow-lg hover:brightness-90"
        >
          Preview Audience
        </button>
      )}
    </div>
  );
}

function AddAutomationTaskMenu({ onAdd }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const taskOptions = [
    { type: 'Notification', label: 'Notification Task' },
    { type: 'Reminder', label: 'Reminder Task' },
    { type: 'Announcement', label: 'Announcement Task' }
  ];

  useEffect(() => {
    const onClickOutside = (event) => {
      if (!menuRef.current || menuRef.current.contains(event.target)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 rounded bg-boxlms-primary-btn px-4 py-2 text-sm font-medium text-boxlms-primary-btn-txt hover:brightness-90"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Automation Task
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg">
          {taskOptions.map((option) => (
            <button
              key={option.type}
              onClick={() => {
                setOpen(false);
                onAdd(option.type);
              }}
              className="w-full border-b border-gray-100 px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
