import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import toast from 'react-hot-toast';
import { uploadMedia, uploadScorm } from '../services/upload';
import { listQuizzes } from '../services/quizzes';
import usePageTitle from '../hooks/usePageTitle';
import { adminCourseService, courseHelpers } from '../services/adminCourses';

export default function AdminCourseEditor() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const isNew = !courseId;

  usePageTitle(isNew ? 'Add Course' : 'Edit Course');

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    shortDescription: '',
    longDescription: '',
    category: '',
    tags: [],
    certificateEnabled: true,
    bannerFile: null,
    bannerPreview: '',
    status: 'Draft'
  });

  const [tagInput, setTagInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // details | lessons | quizzes

  // Load course data if editing
  useEffect(() => {
    if (!isNew && courseId) {
      loadCourse();
    }
  }, [courseId, isNew]);

  // Load quizzes when quizzes tab is selected
  useEffect(() => {
    if (activeTab === 'quizzes' && courseId && !isNew) {
      loadCourseQuizzes();
    }
  }, [activeTab, courseId, isNew]);

  const loadCourse = async () => {
    try {
      setLoading(true);
      const courseData = await adminCourseService.getCourse(courseId);
      const formData = courseHelpers.transformCourseResponseToForm(courseData);
      setForm(formData);
      setLessons(courseData.lessons || []);
      // Load quizzes for this course
      await loadCourseQuizzes();
    } catch (error) {
      console.error('Error loading course:', error);
      toast.error('Failed to load course data');
      navigate('/admin/courses');
    } finally {
      setLoading(false);
    }
  };

  const loadCourseQuizzes = async () => {
    if (!courseId) return;
    try {
      setQuizzesLoading(true);
      // Load all quizzes and filter by courseId
      const allQuizzes = await listQuizzes('');
      
      // Filter by courseId (now returned directly from backend)
      const filtered = allQuizzes.filter(q => q.courseId === courseId);
      
      setCourseQuizzes(filtered);
    } catch (error) {
      console.error('Error loading course quizzes:', error);
      toast.error('Failed to load quizzes');
    } finally {
      setQuizzesLoading(false);
    }
  };

  // Lessons state
  const [lessons, setLessons] = useState([]);
  const [isEditingLesson, setIsEditingLesson] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [draftLesson, setDraftLesson] = useState({
    id: '',
    order: 1,
    type: 'video', // video | pdf | scorm | quiz
    title: '',
    description: '',
    isOptional: false,
    // type fields
    src: '', // for video/pdf
    entryUrl: '', // for scorm
    quizId: '' // for quiz
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  // Quiz picker state
  const [quizPickerOpen, setQuizPickerOpen] = useState(false);
  const [quizSearch, setQuizSearch] = useState('');
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizOptions, setQuizOptions] = useState([]);

  // Course quizzes state
  const [courseQuizzes, setCourseQuizzes] = useState([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);

  const openQuizPicker = async () => {
    setQuizPickerOpen(true);
    setQuizLoading(true);
    try {
      const items = await listQuizzes('');
      setQuizOptions(items);
    } catch (e) {
      console.error(e);
      setQuizOptions([]);
    } finally {
      setQuizLoading(false);
    }
  };

  const searchQuizzes = async (term) => {
    setQuizSearch(term);
    setQuizLoading(true);
    try {
      const items = await listQuizzes(term);
      setQuizOptions(items);
    } catch (e) {
      console.error(e);
      setQuizOptions([]);
    } finally {
      setQuizLoading(false);
    }
  };

  const selectQuiz = (q) => {
    setDraftLesson((prev) => ({ ...prev, quizId: q.id, title: prev.title || q.title }));
    setQuizPickerOpen(false);
    toast.success('Quiz selected');
  };

  const isValid = useMemo(() => form.title.trim().length > 0, [form.title]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleBannerChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    const preview = URL.createObjectURL(file);
    setForm(prev => ({ ...prev, bannerFile: file, bannerPreview: preview }));
  };

  const removeBanner = () => {
    if (form.bannerPreview) URL.revokeObjectURL(form.bannerPreview);
    setForm(prev => ({ ...prev, bannerFile: null, bannerPreview: '' }));
  };

  const commitTag = (raw) => {
    const value = raw.trim();
    if (!value) return;
    if (form.tags.includes(value)) return;
    setForm(prev => ({ ...prev, tags: [...prev.tags, value] }));
    setTagInput('');
  };

  const onTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitTag(tagInput.replace(',', ''));
    }
    if (e.key === 'Backspace' && !tagInput && form.tags.length) {
      // remove last
      setForm(prev => ({ ...prev, tags: prev.tags.slice(0, -1) }));
    }
  };

  const removeTag = (tag) => setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));

  // ---------- Lessons handlers ----------
  const newId = () => 'l' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  const defaultDraftFor = (type) => ({
    id: '',
    order: lessons.length + 1,
    type,
    title: '',
    description: '',
    isOptional: false,
    src: '',
    entryUrl: '',
    quizId: ''
  });

  const startAddLesson = (type) => {
    setEditingIndex(null);
    setDraftLesson(defaultDraftFor(type));
    setIsEditingLesson(true);
  };

  const editLesson = (index) => {
    const l = lessons[index];
    setEditingIndex(index);
    setDraftLesson({ ...l });
    setIsEditingLesson(true);
  };

  const deleteLesson = (index) => {
    if (!window.confirm('Delete this lesson?')) return;
    setLessons(prev => prev.filter((_, i) => i !== index));
    toast.success('Lesson deleted');
  };

  const moveLesson = (index, dir) => {
    const ni = dir === 'up' ? index - 1 : index + 1;
    if (ni < 0 || ni >= lessons.length) return;
    setLessons(prev => {
      const arr = prev.slice();
      [arr[index], arr[ni]] = [arr[ni], arr[index]];
      return arr;
    });
  };

  const cancelLessonEdit = () => {
    setIsEditingLesson(false);
    setEditingIndex(null);
  };

  const saveLesson = () => {
    // validate
    const d = draftLesson;
    if (!d.title.trim()) {
      toast.error('Lesson title is required');
      return;
    }
    if (d.type === 'video' || d.type === 'pdf') {
      if (!d.src.trim()) {
        toast.error('Please provide a valid URL');
        return;
      }
    }
    if (d.type === 'scorm' && !d.entryUrl.trim()) {
      toast.error('SCORM entry URL is required');
      return;
    }
    if (d.type === 'quiz' && !d.quizId.trim()) {
      toast.error('Quiz ID is required');
      return;
    }

    if (editingIndex === null) {
      const toAdd = { ...d, id: newId() };
      setLessons(prev => [...prev, toAdd]);
      toast.success('Lesson added');
    } else {
      setLessons(prev => prev.map((l, i) => (i === editingIndex ? { ...d } : l)));
      toast.success('Lesson updated');
    }
    setIsEditingLesson(false);
    setEditingIndex(null);
  };

  const onSave = async () => {
    setSubmitted(true);
    if (!isValid) {
      toast.error('Please enter a course title');
      return;
    }
    
    try {
      setSaving(true);
      
      // Prepare course data
      const courseData = courseHelpers.transformCourseFormToRequest(form);
      
      let savedCourse;
      if (isNew) {
        savedCourse = await adminCourseService.createCourse(courseData);
        toast.success('Course created successfully');
      } else {
        savedCourse = await adminCourseService.updateCourse(courseId, courseData);
        toast.success('Course updated successfully');
      }
      
      navigate('/admin/courses');
    } catch (error) {
      console.error('Error saving course:', error);
      const message = error.response?.data?.message || 'Failed to save course';
      toast.error(message);
    } finally {
      setSaving(false);
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
        <h1 className="text-3xl font-bold text-gray-900 mb-6">{isNew ? 'Create New Course' : 'Edit Course'}</h1>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-8">
            <div className="flex items-center justify-center">
              <div className="text-gray-500">Loading course data...</div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            {/* Tabs */}
            <div className="px-6 pt-4 border-b">
              <div className="flex gap-6">
                <button
                className={`pb-3 text-sm font-medium border-b-2 ${activeTab==='details' ? 'border-(--tenant-primary) text-(--tenant-primary)' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                onClick={() => setActiveTab('details')}
              >
                Details
              </button>
              <button
                className={`pb-3 text-sm font-medium border-b-2 ${activeTab==='lessons' ? 'border-(--tenant-primary) text-(--tenant-primary)' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                onClick={() => setActiveTab('lessons')}
              >
                Lessons
              </button>
              <button
                className={`pb-3 text-sm font-medium border-b-2 ${activeTab==='quizzes' ? 'border-(--tenant-primary) text-(--tenant-primary)' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                onClick={() => setActiveTab('quizzes')}
              >
                Quizzes
              </button>
            </div>
          </div>

          {/* Details Tab */}
          {activeTab === 'details' && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Course Title <span className="text-red-600">*</span></label>
                  <input
                    value={form.title}
                    onChange={(e) => handleChange('title', e.target.value)}
                    className={`w-full border rounded px-4 py-2 ${submitted && !isValid ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="Enter course title"
                  />
                  {submitted && !isValid && (
                    <p className="text-xs text-red-600 mt-1">Title is required.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
                  <textarea
                    value={form.shortDescription}
                    onChange={(e) => handleChange('shortDescription', e.target.value)}
                    className="w-full border border-gray-300 rounded px-4 py-2"
                    rows={2}
                    placeholder="One-liner shown on cards/search results"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Long Description</label>
                  <textarea
                    value={form.longDescription}
                    onChange={(e) => handleChange('longDescription', e.target.value)}
                    className="w-full border border-gray-300 rounded px-4 py-2"
                    rows={6}
                    placeholder="Full description shown on course page"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Course Banner / Thumbnail</label>
                  {form.bannerPreview ? (
                    <div className="border rounded p-2">
                      <img src={form.bannerPreview} alt="Banner preview" className="w-full h-36 object-cover rounded" />
                      <div className="flex gap-2 mt-2">
                        <button onClick={removeBanner} className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Remove</button>
                        <label className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer">
                          Change
                          <input type="file" accept="image/*" onChange={handleBannerChange} className="hidden" />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <label className="w-full border border-dashed border-gray-300 rounded p-4 flex items-center justify-center cursor-pointer hover:bg-gray-50">
                      <div className="text-center">
                        <div className="text-gray-500">Click to upload image</div>
                        <div className="text-xs text-gray-400">PNG, JPG, GIF up to ~5MB</div>
                      </div>
                      <input type="file" accept="image/*" onChange={handleBannerChange} className="hidden" />
                    </label>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Enable Certificate</label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.certificateEnabled}
                      onChange={(e) => handleChange('certificateEnabled', e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Issue certificate on completion</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                    className="w-full border border-gray-300 rounded px-4 py-2"
                  >
                    <option value="">Select a category</option>
                    {courseHelpers.getCategoryOptions().map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                  <div className="flex flex-wrap items-center gap-2 border border-gray-300 rounded px-2 py-2">
                    {form.tags.map(tag => (
                      <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                        {tag}
                        <button onClick={() => removeTag(tag)} className="text-gray-500 hover:text-gray-700">×</button>
                      </span>
                    ))}
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={onTagKeyDown}
                      placeholder="Type and press Enter"
                      className="flex-1 min-w-[120px] outline-none px-2 py-1 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Cancel</button>
              <button onClick={onSave} className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 cursor-pointer">Save</button>
            </div>
          </div>
          )}

          {/* Lessons Tab */}
          {activeTab === 'lessons' && (
            <div className="p-6 space-y-6">
              {/* Add lesson */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900">Lessons</h2>
                <div className="flex items-center gap-2">
                  <AddLessonMenu onAdd={(type) => {
                    startAddLesson(type);
                  }} />
                </div>
              </div>

              {/* Lessons table */}
              <div className="overflow-x-auto border rounded">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Optional</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {lessons.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No lessons yet. Click "Add Lesson" to get started.</td>
                      </tr>
                    ) : (
                      lessons.map((l, idx) => (
                        <tr key={l.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 w-20">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">{l.title || <span className="text-gray-400">Untitled</span>}</div>
                            {l.description && (
                              <div className="text-xs text-gray-500 truncate max-w-[420px]">{l.description}</div>
                            )}
                            {l.type === 'quiz' && l.quizId && (
                              <div className="text-xs text-blue-600 mt-1">Quiz ID: {l.quizId}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <TypeBadge type={l.type} />
                          </td>
                          <td className="px-4 py-3">{l.isOptional ? 'Yes' : 'No'}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => moveLesson(idx, 'up')} disabled={idx===0} className="px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded disabled:opacity-40">↑</button>
                              <button onClick={() => moveLesson(idx, 'down')} disabled={idx===lessons.length-1} className="px-2 py-1 text-sm bg-gray-100 text-gray-700 rounded disabled:opacity-40">↓</button>
                              <button onClick={() => editLesson(idx)} className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100">Edit</button>
                              <button onClick={() => deleteLesson(idx)} className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100">Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Lesson editor */}
              {isEditingLesson && (
                <div className="border rounded p-4 bg-gray-50">
                  <h3 className="text-md font-semibold text-gray-900 mb-4">{editingIndex===null ? 'Add Lesson' : 'Edit Lesson'}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <select value={draftLesson.type} onChange={(e)=>setDraftLesson(prev=>({...prev,type:e.target.value}))} className="w-full border rounded px-3 py-2">
                        <option value="video">Video</option>
                        <option value="pdf">PDF</option>
                        <option value="scorm">SCORM</option>
                        <option value="quiz">Quiz</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                      <input value={draftLesson.title} onChange={(e)=>setDraftLesson(prev=>({...prev,title:e.target.value}))} className="w-full border rounded px-3 py-2" placeholder="Lesson title" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea value={draftLesson.description} onChange={(e)=>setDraftLesson(prev=>({...prev,description:e.target.value}))} className="w-full border rounded px-3 py-2" rows={3} placeholder="Lesson description (optional)" />
                    </div>
                    <div className="md:col-span-2">
                      {draftLesson.type === 'video' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Video URL</label>
                          <input value={draftLesson.src} onChange={(e)=>setDraftLesson(prev=>({...prev,src:e.target.value}))} className="w-full border rounded px-3 py-2" placeholder="https://... (mp4 or HLS)" />
                          <div className="mt-2 flex items-center gap-2">
                            <label className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded cursor-pointer hover:bg-gray-200">
                              Upload file
                              <input type="file" accept="video/*" className="hidden" onChange={async (e)=>{
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploading(true); setUploadProgress(0);
                                try {
                                  const res = await uploadMedia(file, setUploadProgress);
                                  setDraftLesson(prev=>({...prev, src: res.url }));
                                  toast.success('Video uploaded');
                                } catch(err){
                                  console.error(err);
                                  toast.error('Video upload failed');
                                } finally {
                                  setUploading(false);
                                  setTimeout(()=>setUploadProgress(0), 600);
                                }
                              }} />
                            </label>
                            {uploading && <span className="text-xs text-gray-600">Uploading… {uploadProgress}%</span>}
                          </div>
                        </div>
                      )}
                      {draftLesson.type === 'pdf' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">PDF URL</label>
                          <input value={draftLesson.src} onChange={(e)=>setDraftLesson(prev=>({...prev,src:e.target.value}))} className="w-full border rounded px-3 py-2" placeholder="https://... .pdf" />
                          <div className="mt-2 flex items-center gap-2">
                            <label className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded cursor-pointer hover:bg-gray-200">
                              Upload PDF
                              <input type="file" accept="application/pdf" className="hidden" onChange={async (e)=>{
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (file.type !== 'application/pdf') { toast.error('Please select a PDF file'); return; }
                                setUploading(true); setUploadProgress(0);
                                try {
                                  const res = await uploadMedia(file, setUploadProgress);
                                  setDraftLesson(prev=>({...prev, src: res.url }));
                                  toast.success('PDF uploaded');
                                } catch(err){
                                  console.error(err);
                                  toast.error('PDF upload failed');
                                } finally {
                                  setUploading(false);
                                  setTimeout(()=>setUploadProgress(0), 600);
                                }
                              }} />
                            </label>
                            {uploading && <span className="text-xs text-gray-600">Uploading… {uploadProgress}%</span>}
                          </div>
                        </div>
                      )}
                      {draftLesson.type === 'scorm' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">SCORM Entry URL</label>
                          <input value={draftLesson.entryUrl} onChange={(e)=>setDraftLesson(prev=>({...prev,entryUrl:e.target.value}))} className="w-full border rounded px-3 py-2" placeholder="/content/scorm/pkg-123/shared/launchpage.html" />
                          <div className="mt-2 flex items-center gap-2">
                            <label className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded cursor-pointer hover:bg-gray-200">
                              Upload SCORM .zip
                              <input type="file" accept=".zip,application/zip" className="hidden" onChange={async (e)=>{
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploading(true); setUploadProgress(0);
                                try {
                                  const res = await uploadScorm(file, setUploadProgress);
                                  setDraftLesson(prev=>({...prev, entryUrl: res.entryUrl }));
                                  toast.success('SCORM uploaded');
                                } catch(err){
                                  console.error(err);
                                  toast.error('SCORM upload failed');
                                } finally {
                                  setUploading(false);
                                  setTimeout(()=>setUploadProgress(0), 600);
                                }
                              }} />
                            </label>
                            {uploading && <span className="text-xs text-gray-600">Uploading… {uploadProgress}%</span>}
                          </div>
                        </div>
                      )}
                      {draftLesson.type === 'quiz' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Quiz</label>
                          <div className="flex flex-wrap gap-2">
                            <input value={draftLesson.quizId} onChange={(e)=>setDraftLesson(prev=>({...prev,quizId:e.target.value}))} className="flex-1 border rounded px-3 py-2" placeholder="Paste an existing quiz ID" />
                            <button
                              type="button"
                              onClick={openQuizPicker}
                              className="px-3 py-2 text-sm bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
                            >
                              Select Existing
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const target = courseId ? `/admin/quiz/create/${courseId}` : '/admin/quiz/create';
                                const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
                                window.location.href = `${target}?returnTo=${returnTo}`;
                              }}
                              className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Create New Quiz
                            </button>
                            {draftLesson.quizId && (
                              <a
                                href={`/admin/quiz/edit/${encodeURIComponent(draftLesson.quizId)}?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                                className="px-3 py-2 text-sm bg-orange-100 text-orange-800 rounded hover:bg-orange-200"
                              >
                                Edit This Quiz
                              </a>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">Create a new quiz, paste an ID, or select from existing quizzes.</div>

                          {/* Picker panel */}
                          {quizPickerOpen && (
                            <div className="mt-3 border rounded p-3 bg-white">
                              <div className="flex items-center gap-2 mb-3">
                                <input
                                  value={quizSearch}
                                  onChange={(e)=>searchQuizzes(e.target.value)}
                                  className="flex-1 border rounded px-3 py-2"
                                  placeholder="Search quizzes by title or ID"
                                />
                                <button type="button" onClick={()=>setQuizPickerOpen(false)} className="px-3 py-2 text-sm bg-gray-100 text-gray-800 rounded hover:bg-gray-200">Close</button>
                              </div>
                              {quizLoading ? (
                                <div className="text-sm text-gray-500">Loading…</div>
                              ) : quizOptions.length === 0 ? (
                                <div className="text-sm text-gray-500">No quizzes found.</div>
                              ) : (
                                <ul className="divide-y">
                                  {quizOptions.map((q) => (
                                    <li key={q.id} className="py-2 flex items-center justify-between">
                                      <div>
                                        <div className="text-sm text-gray-900">{q.title}</div>
                                        <div className="text-xs text-gray-500">{q.id}</div>
                                      </div>
                                      <button type="button" onClick={()=>selectQuiz(q)} className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100">Select</button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" checked={draftLesson.isOptional} onChange={(e)=>setDraftLesson(prev=>({...prev,isOptional:e.target.checked}))} className="rounded text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm text-gray-700">Mark as optional</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={cancelLessonEdit} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Cancel</button>
                    <button onClick={saveLesson} className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 cursor-pointer">Save Lesson</button>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Cancel</button>
                <button 
                  onClick={onSave} 
                  disabled={saving}
                  className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Course'}
                </button>
              </div>
            </div>
          )}

          {/* Quizzes Tab */}
          {activeTab === 'quizzes' && (
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Course Quizzes</h2>
                <button
                  onClick={() => navigate(`/admin/quiz/create/${courseId}`)}
                  className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 cursor-pointer"
                >
                  Create New Quiz
                </button>
              </div>

              {quizzesLoading ? (
                <div className="text-center py-8">
                  <div className="text-gray-500">Loading quizzes...</div>
                </div>
              ) : courseQuizzes.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-500 mb-4">No quizzes created for this course yet.</div>
                  <button
                    onClick={() => navigate(`/admin/quiz/create/${courseId}`)}
                    className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 cursor-pointer"
                  >
                    Create First Quiz
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {courseQuizzes.map((quiz) => (
                    <div key={quiz.id} className="border rounded-lg p-4 bg-white shadow-sm">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-lg font-medium text-gray-900">{quiz.title}</h3>
                          <p className="text-sm text-gray-600 mt-1">{quiz.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span>Passing Score: {quiz.passingScore}%</span>
                            <span>Questions: {quiz.questionCount || 0}</span>
                            {quiz.isTimed && <span>Time Limit: {quiz.timeLimit} min</span>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate(`/admin/quiz/edit/${quiz.id}`)}
                            className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Delete this quiz? This action cannot be undone.')) {
                                // TODO: Implement delete
                                toast.info('Delete functionality coming soon');
                              }
                            }}
                            className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

// Small helper components and functions
function TypeBadge({ type }) {
  const map = {
    video: 'bg-blue-100 text-blue-800',
    pdf: 'bg-purple-100 text-purple-800',
    scorm: 'bg-green-100 text-green-800',
    quiz: 'bg-orange-100 text-orange-800'
  };
  const label = type === 'scorm' ? 'SCORM' : type.charAt(0).toUpperCase() + type.slice(1);
  return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${map[type] || 'bg-gray-100 text-gray-800'}`}>{label}</span>;
}

function AddLessonMenu({ onAdd }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(v=>!v)} className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded hover:brightness-90 cursor-pointer"> Add Lesson</button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-white border rounded shadow z-10">
          {['video','pdf','scorm','quiz'].map(t => (
            <button key={t} onClick={() => { onAdd(t); setOpen(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50">{t === 'scorm' ? 'SCORM' : t.charAt(0).toUpperCase()+t.slice(1)}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// Note: lesson handlers live inside the component scope above
