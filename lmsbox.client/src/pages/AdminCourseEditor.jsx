import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AdminHeader from '../components/AdminHeader';
import AIAssistant from '../components/AIAssistant';
import ImageCropModal from '../components/ImageCropModal';
import VideoLessonModal from '../components/VideoLessonModal';
import PdfLessonModal from '../components/PdfLessonModal';
import ScormLessonModal from '../components/ScormLessonModal';
import HtmlLessonModal from '../components/HtmlLessonModal';
import QuizLessonModal from '../components/QuizLessonModal';
import ExternalLessonModal from '../components/ExternalLessonModal';
import CourseResourceModal from '../components/CourseResourceModal';
import toast from 'react-hot-toast';
import { uploadMedia, uploadScorm } from '../services/upload';
import { listQuizzes } from '../services/quizzes';
import usePageTitle from '../hooks/usePageTitle';
import { adminCourseService, courseHelpers } from '../services/adminCourses';
import lessonsService from '../services/lessons';
import resourcesService from '../services/resources';
import { adminSurveyService } from '../services/surveys';
import { formatResourceTypeLabel } from '../utils/resourceTypes';
import { getLessonTypeMenuLabel } from '../utils/lessonTypes';
import { SHOW_PRACTICAL_IN_ADD_MENU } from '../config/lessonFeatureFlags';
import { Sparkles } from 'lucide-react';
import { getUserRole } from '../utils/auth';
import { adminFeatureFlags } from '../config/adminFeatureFlags';

export default function AdminCourseEditor() {
  const navigate = useNavigate();
  const { courseId } = useParams();
  const [searchParams] = useSearchParams();
  const isNew = !courseId;
  
  // Check if AI assistant should be opened automatically
  const openAIParam = searchParams.get('openAI');
  
  // Get user role to conditionally show/hide features
  const userRole = getUserRole();

  usePageTitle(isNew ? 'Add Course' : 'Edit Course');

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [aiAssistantOpen, setAiAssistantOpen] = useState(
    adminFeatureFlags.showAdminAiAssistant && openAIParam === 'true'
  );
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    shortDescription: '',
    longDescription: '',
    category: '',
    tags: [],
    certificateEnabled: true,
    bannerFile: null,
    bannerPreview: '',
    status: 'Draft',
    preCourseSurveyId: null,
    postCourseSurveyId: null,
    isPreSurveyMandatory: false,
    isPostSurveyMandatory: false,
    requireSequentialLessons: false,
    showLessonNavigation: false
  });

  const [tagInput, setTagInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // details | lessons | resources | quizzes
  
  // Surveys state (for dropdowns)
  const [availableSurveys, setAvailableSurveys] = useState([]);
  const [surveysLoading, setSurveysLoading] = useState(false);
  
  // Lessons state
  const [lessons, setLessons] = useState([]);
  const [resources, setResources] = useState([]);
  const [openLessonMenuId, setOpenLessonMenuId] = useState(null);
  const [lessonMenuPosition, setLessonMenuPosition] = useState(null);
  const lessonMenuRef = useRef(null);

  // Categories state
  const [categories, setCategories] = useState([]);
  const [categoryInput, setCategoryInput] = useState('');
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);

  // Set active tab from query parameter
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['details', 'lessons', 'resources', 'quizzes'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Load course data if editing
  useEffect(() => {
    if (!isNew && courseId) {
      loadCourse();
      loadSurveys(); // Load surveys for dropdowns
    }
  }, [courseId, isNew]);

  // Load quizzes when quizzes tab is selected
  useEffect(() => {
    if (activeTab === 'quizzes' && courseId && !isNew) {
      loadCourseQuizzes();
    }
  }, [activeTab, courseId, isNew]);

  // Listen for HTML lesson creation from AI Assistant
  useEffect(() => {
    const handleCreateHtmlLesson = async (event) => {
      const { title, htmlContent } = event.detail;
      
      if (!courseId) {
        toast.error('Please save the course first before creating lessons');
        return;
      }

      try {
        toast.loading('Creating HTML lesson...', { id: 'html-lesson' });
        
        // Upload HTML content to Azure Blob
        const uploadResult = await lessonsService.uploadHtmlContent(courseId, title, htmlContent);
        
        // Create the lesson with both htmlUrl and htmlContent for editing
        const newLesson = await lessonsService.createLesson(courseId, {
          title: title,
          type: 'html',
          htmlUrl: uploadResult.htmlUrl,
          htmlContent: htmlContent,
          ordinal: lessons.length + 1,
          isOptional: false
        });
        
        setLessons([...lessons, newLesson]);
        toast.success('HTML lesson created successfully!', { id: 'html-lesson' });
        setActiveTab('lessons'); // Switch to lessons tab
        loadLessons(); // Reload lessons to get fresh data
        // Dispatch event to reset AI Assistant Lesson Content tab
        window.dispatchEvent(new CustomEvent('resetLessonContentTab'));
      } catch (error) {
        console.error('Error creating HTML lesson:', error);
        toast.error('Failed to create HTML lesson', { id: 'html-lesson' });
      }
    };

    window.addEventListener('createHtmlLesson', handleCreateHtmlLesson);
    return () => window.removeEventListener('createHtmlLesson', handleCreateHtmlLesson);
  }, [courseId, lessons, isNew]);

  const loadCourse = async () => {
    try {
      setLoading(true);
      const courseData = await adminCourseService.getCourse(courseId);
      const formData = courseHelpers.transformCourseResponseToForm(courseData);
      setForm(formData);
      setCategoryInput(formData.category || '');
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

  const loadSurveys = async () => {
    try {
      setSurveysLoading(true);
      const surveys = await adminSurveyService.listSurveys();
      // Filter only published surveys for course assignment
      const publishedSurveys = (surveys || []).filter(s => s.status === 'Published');
      setAvailableSurveys(publishedSurveys);
    } catch (error) {
      console.error('Error loading surveys:', error);
      toast.error('Failed to load surveys');
    } finally {
      setSurveysLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await adminCourseService.getCategories();
      setCategories(response.categories || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

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
  
  // Video Lesson Modal state
  const [videoLessonModalOpen, setVideoLessonModalOpen] = useState(false);
  const [editingVideoLesson, setEditingVideoLesson] = useState(null);
  
  // PDF Lesson Modal state
  const [pdfLessonModalOpen, setPdfLessonModalOpen] = useState(false);
  const [editingPdfLesson, setEditingPdfLesson] = useState(null);
  
  // SCORM Lesson Modal state
  const [scormLessonModalOpen, setScormLessonModalOpen] = useState(false);
  const [editingScormLesson, setEditingScormLesson] = useState(null);

  // HTML Lesson Modal state
  const [htmlLessonModalOpen, setHtmlLessonModalOpen] = useState(false);
  const [editingHtmlLesson, setEditingHtmlLesson] = useState(null);
  
  // Quiz Lesson Modal state
  const [quizLessonModalOpen, setQuizLessonModalOpen] = useState(false);
  const [editingQuizLesson, setEditingQuizLesson] = useState(null);

  const [externalLessonModalOpen, setExternalLessonModalOpen] = useState(false);
  const [editingExternalLesson, setEditingExternalLesson] = useState(null);

  // Course Resource Modal state
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [resourceModalType, setResourceModalType] = useState('pdf');
  
  // Drag and drop state
  const [draggedLesson, setDraggedLesson] = useState(null);
  const [draggedOverLesson, setDraggedOverLesson] = useState(null);
  
  // Quiz picker state (old - can be removed after migration)
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

  // Check if a lesson is from global library
  const isGlobalLibraryLesson = (lesson) => {
    return (lesson.videoUrl && lesson.videoUrl.includes('global-library/')) ||
           (lesson.documentUrl && lesson.documentUrl.includes('global-library/')) ||
           (lesson.scormUrl && lesson.scormUrl.includes('global-library/')) ||
           (lesson.htmlUrl && lesson.htmlUrl.includes('global-library/'));
  };

  const isValid = useMemo(() => 
    form.title.trim().length > 0 && form.shortDescription.trim().length > 0, 
    [form.title, form.shortDescription]
  );

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const openCropModal = () => {
    setCropModalOpen(true);
  };

  const handleBannerCrop = async (croppedFile) => {
    try {
      const preview = URL.createObjectURL(croppedFile);
      setForm(prev => ({ ...prev, bannerFile: croppedFile, bannerPreview: preview }));
      
      // Upload the banner immediately
      toast.loading('Uploading banner...', { id: 'banner-upload' });
      const result = await adminCourseService.uploadCourseBanner(croppedFile);
      
      // Update form with the uploaded URL
      setForm(prev => ({ ...prev, bannerPreview: result.url }));
      toast.success('Banner uploaded successfully', { id: 'banner-upload' });
    } catch (error) {
      console.error('Error uploading banner:', error);
      toast.error('Failed to upload banner', { id: 'banner-upload' });
    }
  };

  const removeBanner = () => {
    if (form.bannerPreview && form.bannerPreview.startsWith('blob:')) {
      URL.revokeObjectURL(form.bannerPreview);
    }
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

  // ---------- Category handlers ----------
  const filteredCategories = useMemo(() => {
    if (!categoryInput.trim()) return categories;
    return categories.filter(cat => 
      cat.toLowerCase().includes(categoryInput.toLowerCase())
    );
  }, [categories, categoryInput]);

  const handleCategoryInputChange = (e) => {
    const value = e.target.value;
    setCategoryInput(value);
    setForm(prev => ({ ...prev, category: value }));
    setShowCategorySuggestions(true);
  };

  const handleCategorySelect = (category) => {
    setCategoryInput(category);
    setForm(prev => ({ ...prev, category }));
    setShowCategorySuggestions(false);
  };

  const handleCategoryBlur = () => {
    // Delay to allow click on suggestion
    setTimeout(() => {
      setShowCategorySuggestions(false);
    }, 200);
  };

  // ---------- Lessons handlers ----------
  
  // Load lessons from API
  const loadLessons = async () => {
    if (!courseId) return;
    try {
      const lessonsData = await lessonsService.getLessons(courseId);
      setLessons(lessonsData);
    } catch (error) {
      console.error('Error loading lessons:', error);
      toast.error('Failed to load lessons');
    }
  };

  const handlePreviewCourse = () => {
    if (isNew || !courseId) {
      toast.error('Save the course before previewing');
      return;
    }
    adminCourseService.openCoursePreview(courseId);
  };

  const handlePreviewLesson = (lessonId) => {
    if (isNew || !courseId) {
      toast.error('Save the course before previewing lessons');
      return;
    }
    adminCourseService.openCoursePreview(courseId, lessonId);
  };

  // Load lessons when switching to lessons tab
  useEffect(() => {
    if (activeTab === 'lessons' && courseId && !isNew) {
      loadLessons();
    }
  }, [activeTab, courseId, isNew]);

  useEffect(() => {
    if (activeTab !== 'lessons') {
      setOpenLessonMenuId(null);
      setLessonMenuPosition(null);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!openLessonMenuId) return undefined;

    const closeMenu = () => {
      setOpenLessonMenuId(null);
      setLessonMenuPosition(null);
    };

    const handleClickOutside = (event) => {
      if (lessonMenuRef.current && !lessonMenuRef.current.contains(event.target)) {
        closeMenu();
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [openLessonMenuId]);

  const toggleLessonMenu = (lessonId, event) => {
    if (openLessonMenuId === lessonId) {
      setOpenLessonMenuId(null);
      setLessonMenuPosition(null);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const estimatedMenuHeight = 180;
    const openUpward = window.innerHeight - rect.bottom < estimatedMenuHeight;

    setLessonMenuPosition(
      openUpward
        ? { bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right }
        : { top: rect.bottom + 4, right: window.innerWidth - rect.right }
    );
    setOpenLessonMenuId(lessonId);
  };

  const closeLessonMenu = () => {
    setOpenLessonMenuId(null);
    setLessonMenuPosition(null);
  };

  const getLessonEditAction = (lesson) => {
    if (isGlobalLibraryLesson(lesson)) {
      return null;
    }

    if (lesson.type === 'video') {
      return {
        label: form.status === 'Published' ? 'Captions' : 'Edit',
        onClick: () => handleOpenVideoLessonModal(lesson),
        disabled: false,
      };
    }

    if (lesson.type === 'document') {
      return {
        label: 'Edit',
        onClick: () => handleOpenPdfLessonModal(lesson),
        disabled: form.status === 'Published',
      };
    }

    if (lesson.type === 'scorm') {
      return {
        label: 'Edit',
        onClick: () => handleOpenScormLessonModal(lesson),
        disabled: form.status === 'Published',
      };
    }

    if (lesson.type === 'html') {
      return {
        label: 'Edit',
        onClick: () => handleOpenHtmlLessonModal(lesson),
        disabled: form.status === 'Published',
      };
    }

    if (lesson.type === 'quiz') {
      return {
        label: 'Edit',
        onClick: () => handleOpenQuizLessonModal(lesson),
        disabled: form.status === 'Published',
      };
    }

    if (lesson.type === 'interactive') {
      return {
        label: 'Edit',
        onClick: () => navigate(`/admin/interactive/edit/${lesson.id}`),
        disabled: form.status === 'Published',
      };
    }

    if (lesson.type === 'external') {
      return {
        label: 'Edit',
        onClick: () => handleOpenExternalLessonModal(lesson),
        disabled: form.status === 'Published',
      };
    }

    return {
      label: 'Edit',
      onClick: () => editLesson(lessons.findIndex((item) => item.id === lesson.id)),
      disabled: form.status === 'Published',
    };
  };

  const getLessonDeleteAction = (lesson, index) => {
    if (isGlobalLibraryLesson(lesson)) {
      return {
        label: 'Remove',
        onClick: () => handleDeleteLesson(lesson.id),
        disabled: form.status !== 'Draft',
        title: form.status !== 'Draft' ? 'Can only remove global lessons from draft courses' : 'Remove from course',
      };
    }

    if (['video', 'document', 'scorm', 'html', 'quiz', 'interactive', 'external'].includes(lesson.type)) {
      return {
        label: 'Delete',
        onClick: () => handleDeleteLesson(lesson.id),
        disabled: form.status === 'Published',
      };
    }

    return {
      label: 'Delete',
      onClick: () => deleteLesson(index),
      disabled: form.status === 'Published',
    };
  };

  const loadResources = async () => {
    if (!courseId || isNew) return;
    try {
      const resourcesData = await resourcesService.getResources(courseId);
      setResources(resourcesData);
    } catch (error) {
      console.error('Error loading resources:', error);
      toast.error('Failed to load resources');
    }
  };

  // Load resources when switching to resources tab
  useEffect(() => {
    if (activeTab === 'resources' && courseId && !isNew) {
      loadResources();
    }
  }, [activeTab, courseId, isNew]);

  const handleOpenResourceModal = (type, resource = null) => {
    setResourceModalType(type);
    setEditingResource(resource);
    setResourceModalOpen(true);
  };

  const handleResourceSaved = () => {
    loadResources();
    toast.success('Resource saved successfully');
  };

  const handleDeleteResource = async (resourceId) => {
    if (!window.confirm('Delete this resource? This action cannot be undone.')) return;
    try {
      await resourcesService.deleteResource(courseId, resourceId);
      loadResources();
      toast.success('Resource deleted');
    } catch (error) {
      console.error('Error deleting resource:', error);
      toast.error(error.response?.data?.message || 'Failed to delete resource');
    }
  };

  // Handle video lesson modal
  const handleOpenVideoLessonModal = (lesson = null) => {
    setEditingVideoLesson(lesson);
    setVideoLessonModalOpen(true);
  };

  const handleVideoLessonSaved = () => {
    loadLessons();
    toast.success(
      form.status === 'Published'
        ? 'Video captions saved successfully'
        : 'Video lesson saved successfully'
    );
  };

  // Handle PDF lesson modal
  const handleOpenPdfLessonModal = (lesson = null) => {
    setEditingPdfLesson(lesson);
    setPdfLessonModalOpen(true);
  };

  const handlePdfLessonSaved = () => {
    loadLessons();
    toast.success('PDF lesson saved successfully');
  };

  // Handle SCORM lesson modal
  const handleOpenScormLessonModal = (lesson = null) => {
    setEditingScormLesson(lesson);
    setScormLessonModalOpen(true);
  };

  const handleScormLessonSaved = () => {
    loadLessons();
    toast.success('SCORM lesson saved successfully');
  };

  // Handle HTML lesson modal
  const handleOpenHtmlLessonModal = (lesson = null) => {
    setEditingHtmlLesson(lesson);
    setHtmlLessonModalOpen(true);
  };

  const handleHtmlLessonSaved = () => {
    loadLessons();
    toast.success('HTML lesson saved successfully');
  };

  // Handle Quiz lesson modal
  const handleOpenQuizLessonModal = (lesson = null) => {
    setEditingQuizLesson(lesson);
    setQuizLessonModalOpen(true);
  };

  const handleQuizLessonSaved = () => {
    loadLessons();
    toast.success('Quiz lesson saved successfully');
  };

  const handleOpenExternalLessonModal = (lesson = null) => {
    const hasPractical = lessons.some((l) => l.type === 'external');
    if (!lesson && hasPractical) {
      toast.error('A course can only have one practical lesson.');
      return;
    }
    setEditingExternalLesson(lesson);
    setExternalLessonModalOpen(true);
  };

  const handleExternalLessonSaved = () => {
    loadLessons();
    toast.success('Practical lesson saved successfully');
  };

  const handleDeleteLesson = async (lessonId) => {
    if (!window.confirm('Are you sure you want to delete this lesson?')) return;
    
    try {
      await lessonsService.deleteLesson(courseId, lessonId);
      toast.success('Lesson deleted');
      loadLessons();
    } catch (error) {
      console.error('Error deleting lesson:', error);
      toast.error('Failed to delete lesson');
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, lesson, index) => {
    // Prevent dragging for published courses
    if (form.status === 'Published') {
      e.preventDefault();
      return;
    }
    setDraggedLesson({ lesson, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDraggedOverLesson(index);
  };

  const handleDragLeave = () => {
    setDraggedOverLesson(null);
  };

  const handleDrop = async (e, dropIndex) => {
    e.preventDefault();
    setDraggedOverLesson(null);

    if (!draggedLesson || draggedLesson.index === dropIndex) {
      setDraggedLesson(null);
      return;
    }

    const dragIndex = draggedLesson.index;
    const newLessons = [...lessons];
    const [removed] = newLessons.splice(dragIndex, 1);
    newLessons.splice(dropIndex, 0, removed);

    // Update local state immediately for instant feedback
    setLessons(newLessons);
    setDraggedLesson(null);

    // Save new order to backend
    try {
      const lessonOrders = newLessons.map((lesson, idx) => ({
        lessonId: lesson.id,
        ordinal: idx + 1
      }));

      await lessonsService.reorderLessons(courseId, lessonOrders);
      toast.success('Lesson order updated');
    } catch (error) {
      console.error('Error reordering lessons:', error);
      toast.error('Failed to save lesson order');
      // Reload lessons to revert to server state
      loadLessons();
    }
  };

  const handleDragEnd = () => {
    setDraggedLesson(null);
    setDraggedOverLesson(null);
  };
  
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
      if (!form.title.trim()) {
        toast.error('Please enter a course title');
      } else if (!form.shortDescription.trim()) {
        toast.error('Please enter a short description');
      }
      return;
    }
    
    try {
      setSaving(true);
      
      // Prepare course data
      const courseData = courseHelpers.transformCourseFormToRequest(form);
      
      let _savedCourse;
      if (isNew) {
        _savedCourse = await adminCourseService.createCourse(courseData);
        toast.success('Course created successfully! Now add lessons in the Lessons tab.');
        // Stay on the page and switch to lessons tab
        setActiveTab('lessons');
        // Update the URL to edit mode (correct route order)
        navigate(`/admin/courses/${_savedCourse.id}/edit?tab=lessons`, { replace: true });
      } else {
        _savedCourse = await adminCourseService.updateCourse(courseId, courseData);
        toast.success('Course updated successfully!');
      }
    } catch (error) {
      console.error('Error saving course:', error);
      const message = error.response?.data?.message || 'Failed to save course';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleApplyAIContent = (content) => {
    try {
      // Strip markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```json\n/, '').replace(/^```\n/, '').replace(/\n```$/, '');
      }
      
      // Try to parse as JSON
      const parsed = JSON.parse(cleanContent);
      
      // Check if it's a course outline
      if (parsed.title) {
        setForm(prev => ({
          ...prev,
          title: parsed.title || prev.title,
          shortDescription: parsed.shortDescription || parsed.summary || prev.shortDescription,
          longDescription: parsed.longDescription || parsed.description || prev.longDescription,
          tags: parsed.tags && Array.isArray(parsed.tags) ? parsed.tags : prev.tags,
        }));
        
        toast.success('Course details applied! You can now add lessons manually.');
        setAiAssistantOpen(false);
      }
      // Check if it's quiz questions
      else if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].question) {
        toast('Quiz questions detected. Please use this on the Quiz Creator page.', { icon: 'ℹ️' });
      }
      else {
        toast('Content copied. You can manually apply the changes.', { icon: 'ℹ️' });
      }
    } catch (e) {
      // Not JSON, might be HTML or text content for lesson
      // Copy to clipboard for manual use in lesson editor
      if (navigator.clipboard) {
        navigator.clipboard.writeText(content);
        toast.success('Lesson content copied to clipboard! Paste it into your lesson editor.');
      } else {
        toast('Content generated. Please copy it manually.', { icon: 'ℹ️' });
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      {adminFeatureFlags.showAdminAiAssistant && (
        <AIAssistant 
          mode="slideIn"
          isOpen={aiAssistantOpen}
          onClose={() => setAiAssistantOpen(false)}
          context={form.title ? `Creating course: ${form.title}` : 'Creating a new course'}
          onApplyContent={handleApplyAIContent}
          defaultTab="course"
        />
      )}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 hover:text-gray-900">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          
          {adminFeatureFlags.showAdminAiAssistant && (
            <button
              onClick={() => setAiAssistantOpen(true)}
              className="bg-[#2afeae] text-[#1b365d] px-4 py-2 rounded-lg hover:bg-[#25e89e] hover:shadow-lg transition-all duration-200 flex items-center gap-2 font-medium"
            >
              <Sparkles className="w-5 h-5" />
              AI Assistant
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">{isNew ? 'Create New Course' : 'Edit Course'}</h1>
          {!isNew && courseId && (
            <button
              type="button"
              onClick={handlePreviewCourse}
              className="px-4 py-2 text-sm border border-gray-300 bg-white text-gray-700 rounded hover:bg-gray-50"
            >
              Preview Course
            </button>
          )}
        </div>

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
                className={`pb-3 text-sm font-medium border-b-2 ${activeTab==='details' ? 'border-[#2afeae] text-[#1b365d]' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                onClick={() => setActiveTab('details')}
              >
                Details
              </button>
              <button
                className={`pb-3 text-sm font-medium border-b-2 ${activeTab==='lessons' ? 'border-[#2afeae] text-[#1b365d]' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                onClick={() => setActiveTab('lessons')}
              >
                Lessons
              </button>
              <button
                className={`pb-3 text-sm font-medium border-b-2 ${activeTab==='resources' ? 'border-[#2afeae] text-[#1b365d]' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
                onClick={() => setActiveTab('resources')}
              >
                Resources
              </button>
              <button
                className={`pb-3 text-sm font-medium border-b-2 ${activeTab==='quizzes' ? 'border-[#2afeae] text-[#1b365d]' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Short Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={form.shortDescription}
                    onChange={(e) => handleChange('shortDescription', e.target.value)}
                    className={`w-full border rounded px-4 py-2 ${
                      submitted && !form.shortDescription.trim() 
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-gray-300 focus:ring-blue-500'
                    }`}
                    rows={2}
                    placeholder="One-liner shown on cards/search results (required)"
                  />
                  {submitted && !form.shortDescription.trim() && (
                    <p className="text-sm text-red-500 mt-1">Short description is required</p>
                  )}
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
                        <button type="button" onClick={removeBanner} className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Remove</button>
                        <button type="button" onClick={openCropModal} className="px-3 py-1.5 text-sm bg-[#2afeae] text-[#1b365d] rounded hover:bg-[#25e89e]">
                          Change
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={openCropModal}
                      className="w-full border border-dashed border-gray-300 rounded p-4 flex items-center justify-center hover:bg-gray-50"
                    >
                      <div className="text-center">
                        <div className="text-gray-500">Click to upload image</div>
                        <div className="text-xs text-gray-400">Recommended: 1280x720px (16:9 ratio)</div>
                      </div>
                    </button>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Course Player Navigation</label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.showLessonNavigation}
                      onChange={(e) => handleChange('showLessonNavigation', e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Show Previous / Next buttons</span>
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    When enabled, learners can move between lessons, surveys, and the certificate using footer buttons.
                  </p>
                </div>

                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Content Access</h3>
                  <p className="text-xs text-gray-600 mb-3">
                    Control whether learners can open lessons in any order or must complete them sequentially.
                  </p>
                  <div className="space-y-2">
                    <label className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="lessonAccessMode"
                        checked={!form.requireSequentialLessons}
                        onChange={() => handleChange('requireSequentialLessons', false)}
                        className="mt-0.5 text-[#2afeae] focus:ring-[#2afeae]"
                        disabled={form.status === 'Published'}
                      />
                      <span className="text-xs text-gray-700">
                        <span className="font-medium">Any order</span> — learners can access all lessons freely
                      </span>
                    </label>
                    <label className="flex items-start gap-2">
                      <input
                        type="radio"
                        name="lessonAccessMode"
                        checked={form.requireSequentialLessons}
                        onChange={() => handleChange('requireSequentialLessons', true)}
                        className="mt-0.5 text-[#2afeae] focus:ring-[#2afeae]"
                        disabled={form.status === 'Published'}
                      />
                      <span className="text-xs text-gray-700">
                        <span className="font-medium">Sequential</span> — each lesson unlocks after the previous one is completed
                      </span>
                    </label>
                  </div>
                </div>

                {/* Survey Settings - Hidden for OrgAdmin */}
                {userRole === 'SuperAdmin' && (
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Survey Settings</h3>
                    <p className="text-xs text-gray-600 mb-3">Configure pre and post-course surveys. Create and publish surveys from the Surveys menu to assign them here.</p>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Pre-Course Survey (Optional)</label>
                        <select
                          value={form.preCourseSurveyId || ''}
                          onChange={(e) => handleChange('preCourseSurveyId', e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                          disabled={form.status === 'Published'}
                        >
                          <option value="">No pre-course survey</option>
                          {availableSurveys.map(s => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                          ))}
                        </select>
                        {form.preCourseSurveyId && (
                          <label className="inline-flex items-center gap-2 mt-2">
                            <input
                              type="checkbox"
                              checked={form.isPreSurveyMandatory}
                              onChange={(e) => handleChange('isPreSurveyMandatory', e.target.checked)}
                              className="rounded text-[#2afeae] focus:ring-[#2afeae]"
                              disabled={form.status === 'Published'}
                            />
                            <span className="text-xs text-gray-700">Mandatory (must complete before accessing lessons)</span>
                          </label>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Post-Course Survey (Optional)</label>
                        <select
                          value={form.postCourseSurveyId || ''}
                          onChange={(e) => handleChange('postCourseSurveyId', e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                          disabled={form.status === 'Published'}
                        >
                          <option value="">No post-course survey</option>
                          {availableSurveys.map(s => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                          ))}
                        </select>
                        {form.postCourseSurveyId && (
                          <label className="inline-flex items-center gap-2 mt-2">
                            <input
                              type="checkbox"
                              checked={form.isPostSurveyMandatory}
                              onChange={(e) => handleChange('isPostSurveyMandatory', e.target.checked)}
                              className="rounded text-[#2afeae] focus:ring-[#2afeae]"
                              disabled={form.status === 'Published'}
                            />
                            <span className="text-xs text-gray-700">Mandatory (must complete for course completion & certificate)</span>
                          </label>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={categoryInput || form.category}
                      onChange={handleCategoryInputChange}
                      onFocus={() => setShowCategorySuggestions(true)}
                      onBlur={handleCategoryBlur}
                      placeholder="Select or type a category"
                      className="w-full border border-gray-300 rounded px-4 py-2"
                    />
                    {showCategorySuggestions && filteredCategories.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                        {filteredCategories.map((category, idx) => (
                          <div
                            key={idx}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleCategorySelect(category);
                            }}
                            className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                          >
                            {category}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
                  <AddLessonMenu 
                    disabled={isNew || form.status === 'Published'}
                    hasPractical={lessons.some((l) => l.type === 'external')}
                    onAdd={(type) => {
                      if (type === 'video') {
                        handleOpenVideoLessonModal();
                      } else if (type === 'pdf' || type === 'document') {
                        handleOpenPdfLessonModal();
                      } else if (type === 'scorm') {
                        handleOpenScormLessonModal();
                      } else if (type === 'html') {
                        handleOpenHtmlLessonModal();
                      } else if (type === 'quiz') {
                        handleOpenQuizLessonModal();
                      } else if (type === 'external') {
                        handleOpenExternalLessonModal();
                      } else if (type === 'interactive') {
                        navigate(`/admin/interactive/create/${courseId}`);
                      } else {
                        startAddLesson(type);
                      }
                    }} 
                  />
                </div>
              </div>

              {isNew && (
                <div className="bg-warning border border-warning rounded-lg p-4 text-sm text-warning">
                  <strong>Note:</strong> Please save the course first before adding lessons.
                </div>
              )}

              {form.status === 'Published' && !isNew && (
                <div className="bg-info border border-info rounded-lg p-4 text-sm text-info">
                  <strong>Note:</strong> This course is published. Lessons cannot be modified while the course is published, except you can add or update captions on video lessons. Survey mappings can still be updated from the Details tab. Published courses cannot be unpublished, but they can be archived or deleted.
                </div>
              )}

              {/* Lessons table */}
              <div className="overflow-x-auto border rounded">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">Drag</th>
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
                        <tr 
                          key={l.id} 
                          draggable={form.status !== 'Published'}
                          onDragStart={(e) => handleDragStart(e, l, idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, idx)}
                          onDragEnd={handleDragEnd}
                          className={`hover:bg-gray-50 transition-colors ${
                            form.status !== 'Published' ? 'cursor-move' : ''
                          } ${
                            draggedOverLesson === idx && draggedLesson?.index !== idx
                              ? 'bg-info border-t-2 border-[#2afeae]' 
                              : ''
                          } ${draggedLesson?.index === idx ? 'opacity-50' : ''}`}
                        >
                          <td className="px-4 py-3 text-gray-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                            </svg>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-gray-900">{l.title || <span className="text-gray-400">Untitled</span>}</div>
                              {isGlobalLibraryLesson(l) && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#e8fdf6] text-[#1b365d] text-xs font-medium rounded">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                                  </svg>
                                  Byte Learning Library
                                </span>
                              )}
                            </div>
                            {l.content && (
                              <div className="text-xs text-gray-500 truncate max-w-[420px]">{l.content}</div>
                            )}
                            {l.type === 'quiz' && l.quizId && (
                              <div className="text-xs text-[#1b365d] mt-1">Quiz ID: {l.quizId}</div>
                            )}
                            {l.type === 'interactive' && (
                              <div className="text-xs mt-1">
                                <span className={`inline-flex px-2 py-0.5 rounded-full ${l.interactiveStatus === 'Ready' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                  {l.interactiveStatus || 'Draft'}
                                </span>
                                {typeof l.interactiveBlockCount === 'number' && (
                                  <span className="text-gray-500 ml-2">
                                    {l.interactiveApprovedBlockCount || 0}/{l.interactiveBlockCount} blocks approved
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <TypeBadge type={l.type} />
                          </td>
                          <td className="px-4 py-3">{l.isOptional ? 'Yes' : 'No'}</td>
                          <td className="px-4 py-3">
                            <div
                              className="relative flex justify-end"
                              ref={openLessonMenuId === l.id ? lessonMenuRef : null}
                            >
                              <button
                                type="button"
                                onClick={(event) => toggleLessonMenu(l.id, event)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                                aria-label={`Actions for ${l.title}`}
                                aria-haspopup="menu"
                                aria-expanded={openLessonMenuId === l.id}
                                title="Actions"
                              >
                                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                  <path d="M10 6a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
                                </svg>
                              </button>

                              {openLessonMenuId === l.id && lessonMenuPosition && (() => {
                                const editAction = getLessonEditAction(l);
                                const deleteAction = getLessonDeleteAction(l, idx);
                                const isUnknownType = !isGlobalLibraryLesson(l) &&
                                  !['video', 'document', 'scorm', 'html', 'quiz', 'interactive', 'external'].includes(l.type);

                                return (
                                  <div
                                    role="menu"
                                    className="fixed z-50 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
                                    style={{
                                      top: lessonMenuPosition.top,
                                      bottom: lessonMenuPosition.bottom,
                                      right: lessonMenuPosition.right,
                                    }}
                                  >
                                    <button
                                      type="button"
                                      role="menuitem"
                                      onClick={() => {
                                        closeLessonMenu();
                                        handlePreviewLesson(l.id);
                                      }}
                                      className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                      Preview
                                    </button>

                                    {editAction && (
                                      <button
                                        type="button"
                                        role="menuitem"
                                        disabled={editAction.disabled}
                                        onClick={() => {
                                          if (editAction.disabled) return;
                                          closeLessonMenu();
                                          editAction.onClick();
                                        }}
                                        className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {editAction.label}
                                      </button>
                                    )}

                                    {isUnknownType && (
                                      <>
                                        <button
                                          type="button"
                                          role="menuitem"
                                          disabled={idx === 0 || form.status === 'Published'}
                                          onClick={() => {
                                            if (idx === 0 || form.status === 'Published') return;
                                            closeLessonMenu();
                                            moveLesson(idx, 'up');
                                          }}
                                          className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          Move up
                                        </button>
                                        <button
                                          type="button"
                                          role="menuitem"
                                          disabled={idx === lessons.length - 1 || form.status === 'Published'}
                                          onClick={() => {
                                            if (idx === lessons.length - 1 || form.status === 'Published') return;
                                            closeLessonMenu();
                                            moveLesson(idx, 'down');
                                          }}
                                          className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          Move down
                                        </button>
                                      </>
                                    )}

                                    <div className="my-1 border-t border-gray-100" />

                                    <button
                                      type="button"
                                      role="menuitem"
                                      disabled={deleteAction.disabled}
                                      title={deleteAction.title}
                                      onClick={() => {
                                        if (deleteAction.disabled) return;
                                        closeLessonMenu();
                                        deleteAction.onClick();
                                      }}
                                      className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {deleteAction.label}
                                    </button>
                                  </div>
                                );
                              })()}
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
                              className="px-3 py-2 text-sm bg-[#2afeae] text-[#1b365d] rounded hover:bg-[#25e89e]"
                            >
                              Create New Quiz
                            </button>
                            {draftLesson.quizId && (
                              <a
                                href={`/admin/quiz/edit/${encodeURIComponent(draftLesson.quizId)}?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`}
                                className="px-3 py-2 text-sm bg-info text-[#1b365d] rounded hover:bg-[#d9e5f2]"
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
                                      <button type="button" onClick={()=>selectQuiz(q)} className="px-3 py-1.5 text-sm bg-info text-[#1b365d] rounded hover:bg-[#d9e5f2]">Select</button>
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

          {/* Resources Tab */}
          {activeTab === 'resources' && (
            <div className="p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Resources</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Supplementary files learners can access alongside course lessons (PDF, HTML, or video).
                  </p>
                </div>
                <AddResourceMenu
                  disabled={isNew}
                  onAdd={(type) => handleOpenResourceModal(type)}
                />
              </div>

              {isNew && (
                <div className="bg-warning border border-warning rounded-lg p-4 text-sm text-warning">
                  <strong>Note:</strong> Please save the course first before adding resources.
                </div>
              )}

              {form.status === 'Published' && !isNew && (
                <div className="bg-info border border-info rounded-lg p-4 text-sm text-info">
                  <strong>Note:</strong> This course is published. You can still add, edit, or delete supplementary resources. Lessons and quizzes remain locked.
                </div>
              )}

              <div className="overflow-x-auto border rounded">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {resources.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                          No resources yet. Click &quot;Add Resource&quot; to get started.
                        </td>
                      </tr>
                    ) : (
                      resources.map((resource) => (
                        <tr key={resource.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              {resource.thumbnailUrl ? (
                                <img
                                  src={resource.thumbnailUrl}
                                  alt=""
                                  className="h-12 w-16 shrink-0 rounded object-cover ring-1 ring-gray-200"
                                />
                              ) : (
                                <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded bg-gray-100 text-xs text-gray-400 ring-1 ring-gray-200">
                                  No thumb
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-medium text-gray-900">{resource.title}</div>
                                {resource.description && (
                                  <div className="mt-0.5 line-clamp-2 text-sm text-gray-500">{resource.description}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <ResourceTypeBadge type={resource.type} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleOpenResourceModal(resource.type, resource)}
                                className="px-3 py-1.5 text-sm bg-info text-[#1b365d] rounded hover:bg-[#d9e5f2]"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteResource(resource.id)}
                                className="px-3 py-1.5 text-sm bg-error text-error rounded hover:bg-[#fee2e2]"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Quizzes Tab */}
          {activeTab === 'quizzes' && (
            <div className="p-6">
              {isNew && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800 mb-6">
                  <strong>Note:</strong> Please save the course first before adding quizzes.
                </div>
              )}
              
              {form.status === 'Published' && !isNew && (
                <div className="bg-info border border-[#2afeae] rounded-lg p-4 text-sm text-[#1b365d] mb-6">
                  <strong>Note:</strong> This course is published. Quizzes cannot be modified while the course is published. Published courses cannot be unpublished, but they can be archived or deleted.
                </div>
              )}
              
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Course Quizzes</h2>
                <button
                  onClick={() => navigate(`/admin/quiz/create/${courseId}`)}
                  disabled={isNew || form.status === 'Published'}
                  className={`px-4 py-2 rounded ${
                    isNew || form.status === 'Published'
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                      : 'bg-boxlms-primary-btn text-boxlms-primary-btn-txt hover:brightness-90 cursor-pointer'
                  }`}
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
                    disabled={isNew || form.status === 'Published'}
                    className={`px-4 py-2 rounded ${
                      isNew || form.status === 'Published'
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-boxlms-primary-btn text-boxlms-primary-btn-txt hover:brightness-90 cursor-pointer'
                    }`}
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
                            disabled={form.status === 'Published'}
                            className="px-3 py-1.5 text-sm bg-info text-[#1b365d] rounded hover:bg-[#d9e5f2] disabled:opacity-50 disabled:cursor-not-allowed"
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
                            disabled={form.status === 'Published'}
                            className="px-3 py-1.5 text-sm bg-error text-error rounded hover:bg-[#fee2e2] disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Video Lesson Modal */}
      {!isNew && courseId && (
        <VideoLessonModal
          isOpen={videoLessonModalOpen}
          onClose={() => {
            setVideoLessonModalOpen(false);
            setEditingVideoLesson(null);
          }}
          courseId={courseId}
          lesson={editingVideoLesson}
          onSave={handleVideoLessonSaved}
          captionOnly={form.status === 'Published'}
        />
      )}

      {/* PDF Lesson Modal */}
      {!isNew && courseId && (
        <PdfLessonModal
          isOpen={pdfLessonModalOpen}
          onClose={() => {
            setPdfLessonModalOpen(false);
            setEditingPdfLesson(null);
          }}
          courseId={courseId}
          lesson={editingPdfLesson}
          onSave={handlePdfLessonSaved}
        />
      )}

      {/* SCORM Lesson Modal */}
      {!isNew && courseId && (
        <ScormLessonModal
          isOpen={scormLessonModalOpen}
          onClose={() => {
            setScormLessonModalOpen(false);
            setEditingScormLesson(null);
          }}
          courseId={courseId}
          lesson={editingScormLesson}
          onSave={handleScormLessonSaved}
        />
      )}

      {/* HTML Lesson Modal */}
      {!isNew && courseId && (
        <HtmlLessonModal
          isOpen={htmlLessonModalOpen}
          onClose={() => {
            setHtmlLessonModalOpen(false);
            setEditingHtmlLesson(null);
          }}
          courseId={courseId}
          lesson={editingHtmlLesson}
          onSave={handleHtmlLessonSaved}
        />
      )}

      {/* Quiz Lesson Modal */}
      {!isNew && courseId && (
        <QuizLessonModal
          isOpen={quizLessonModalOpen}
          onClose={() => {
            setQuizLessonModalOpen(false);
            setEditingQuizLesson(null);
          }}
          courseId={courseId}
          lesson={editingQuizLesson}
          onSave={handleQuizLessonSaved}
        />
      )}

      {/* Practical (External) Lesson Modal */}
      {!isNew && courseId && (
        <ExternalLessonModal
          isOpen={externalLessonModalOpen}
          onClose={() => {
            setExternalLessonModalOpen(false);
            setEditingExternalLesson(null);
          }}
          courseId={courseId}
          lesson={editingExternalLesson}
          lessonsCount={lessons.length}
          onSave={handleExternalLessonSaved}
        />
      )}

      {!isNew && courseId && (
        <CourseResourceModal
          isOpen={resourceModalOpen}
          onClose={() => {
            setResourceModalOpen(false);
            setEditingResource(null);
          }}
          courseId={courseId}
          resource={editingResource}
          resourceType={resourceModalType}
          resourcesCount={resources.length}
          onSave={handleResourceSaved}
        />
      )}

      {/* Image Crop Modal for Course Banner */}
      <ImageCropModal
        isOpen={cropModalOpen}
        onClose={() => setCropModalOpen(false)}
        onCropComplete={handleBannerCrop}
        aspectRatio={16 / 9}  // 16:9 ratio for course cards (e.g., 1280x720)
      />
    </div>
  );
}

// Small helper components and functions
function ResourceTypeBadge({ type }) {
  const map = {
    video: 'bg-info text-[#1b365d]',
    pdf: 'bg-info text-[#1b365d]',
    html: 'bg-info text-[#1b365d]',
  };
  const label = formatResourceTypeLabel(type);
  return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${map[type] || 'bg-gray-100 text-gray-800'}`}>{label}</span>;
}

function AddResourceMenu({ onAdd, disabled = false }) {
  const [open, setOpen] = useState(false);

  const resourceTypes = [
    { value: 'pdf', label: 'PDF', icon: '📄' },
    { value: 'html', label: 'HTML', icon: '🌐' },
    { value: 'video', label: 'Video', icon: '🎥' },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={`px-4 py-2 rounded inline-flex items-center gap-2 ${
          disabled
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
            : 'bg-boxlms-primary-btn text-boxlms-primary-btn-txt hover:brightness-90 cursor-pointer'
        }`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Resource
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 bg-white border rounded shadow-lg z-10">
          {resourceTypes.map((t, index) => (
            <div key={t.value}>
              <button
                onClick={() => {
                  onAdd(t.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-gray-50${
                  index < resourceTypes.length - 1 ? ' border-b' : ''
                }`}
              >
                <span className="text-lg">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TypeBadge({ type }) {
  const map = {
    video: 'bg-info text-[#1b365d]',
    document: 'bg-info text-[#1b365d]',
    pdf: 'bg-info text-[#1b365d]',
    scorm: 'bg-success text-[#1b365d]',
    html: 'bg-info text-[#1b365d]',
    quiz: 'bg-warning text-[#1b365d]',
    external: 'bg-slate-100 text-slate-800',
    interactive: 'bg-purple-100 text-purple-800'
  };
  const labelMap = {
    document: 'PDF',
    pdf: 'PDF',
    scorm: 'SCORM',
    html: 'HTML',
    external: getLessonTypeMenuLabel('external'),
    interactive: 'Interactive'
  };
  const label = labelMap[type] || type.charAt(0).toUpperCase() + type.slice(1);
  return <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${map[type] || 'bg-gray-100 text-gray-800'}`}>{label}</span>;
}

function AddLessonMenu({ onAdd, disabled = false, hasPractical = false }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { courseId } = useParams();
  const practicalLimitMessage = 'Not more than one practical lesson is allowed in the course.';
  
  const lessonTypes = [
    { value: 'video', label: 'Video Lesson', icon: '🎥' },
    { value: 'pdf', label: 'PDF Lesson', icon: '📄' },
    { value: 'scorm', label: 'SCORM 1.2 or SCORM 2004 Package', icon: '📦' },
    { value: 'html', label: 'HTML Lesson', icon: '🌐' },
    { value: 'quiz', label: 'Quiz', icon: '📝' },
    { value: 'interactive', label: 'Interactive Lesson', icon: '🧩' },
    ...(SHOW_PRACTICAL_IN_ADD_MENU
      ? [{
          value: 'external',
          label: getLessonTypeMenuLabel('external'),
          icon: '↗️',
          disabled: hasPractical,
          title: hasPractical ? practicalLimitMessage : undefined,
        }]
      : []),
  ];
  
  const handleLibraryClick = () => {
    setOpen(false);
    const returnUrl = encodeURIComponent(`/admin/courses/${courseId}/edit`);
    navigate(`/admin/courses/${courseId}/library?returnUrl=${returnUrl}`);
  };
  
  return (
    <div className="relative">
      <button 
        onClick={() => !disabled && setOpen(v=>!v)} 
        disabled={disabled}
        className={`px-4 py-2 rounded inline-flex items-center gap-2 ${
          disabled 
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
            : 'bg-boxlms-primary-btn text-boxlms-primary-btn-txt hover:brightness-90 cursor-pointer'
        }`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Lesson
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white border rounded shadow-lg z-10">
          {lessonTypes.map((t, index) => {
            const itemClassName = `w-full text-left px-4 py-3 text-sm flex items-center gap-3${index < lessonTypes.length - 1 ? ' border-b' : ''} ${
              t.disabled
                ? 'text-gray-400 cursor-not-allowed'
                : 'hover:bg-gray-50'
            }`;
            const itemButton = (
              <button
                key={t.value}
                onClick={() => {
                  if (!t.disabled) {
                    onAdd(t.value);
                    setOpen(false);
                  }
                }}
                disabled={t.disabled}
                className={itemClassName}
              >
                <span className="text-lg">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );

            return t.disabled ? (
              <span key={t.value} title={t.title} className="block">
                {itemButton}
              </span>
            ) : (
              itemButton
            );
          })}
          {/* Separator */}
          <div className="border-t-2 border-gray-200"></div>
          {/* Library Option */}
          <button 
            onClick={handleLibraryClick}
            className="w-full text-left px-4 py-3 text-sm hover:bg-[#e8fdf6] flex items-center gap-3 text-[#1b365d] font-medium"
          >
            <span className="text-lg">📚</span>
            <span>Browse Byte Learning Library</span>
          </button>
        </div>
      )}
    </div>
  );
}

// Note: lesson handlers live inside the component scope above


