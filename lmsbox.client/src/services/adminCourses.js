import api from '../utils/api';

// Admin course management service
export const adminCourseService = {
  // Get courses for admin management
  async listCourses(params = {}) {
    const { 
      page = 1, 
      pageSize = 20, 
      search, 
      status, 
      category, 
      sortBy = 'updatedAt', 
      sortOrder = 'desc' 
    } = params;
    
    const queryParams = new URLSearchParams();
    
    queryParams.append('page', page);
    queryParams.append('pageSize', pageSize);
    if (search) queryParams.append('search', search);
    if (status && status !== 'all') queryParams.append('status', status);
    if (category && category !== 'all') queryParams.append('category', category);
    if (sortBy) queryParams.append('sortBy', sortBy);
    if (sortOrder) queryParams.append('sortOrder', sortOrder);

    const response = await api.get(`/api/admin/courses?${queryParams.toString()}`);
    return response.data;
  },

  // Get a specific course for editing
  async getCourse(courseId) {
    const response = await api.get(`/api/admin/courses/${courseId}`);
    return response.data;
  },

  // Create a new course
  async createCourse(courseData) {
    const response = await api.post('/api/admin/courses', courseData);
    return response.data;
  },

  // Update an existing course
  async updateCourse(courseId, courseData) {
    const response = await api.put(`/api/admin/courses/${courseId}`, courseData);
    return response.data;
  },

  // Delete a course
  async deleteCourse(courseId) {
    const response = await api.delete(`/api/admin/courses/${courseId}`);
    return response.data;
  },

  // Update course status (publish/unpublish/archive)
  async updateCourseStatus(courseId, status) {
    const response = await api.put(`/api/admin/courses/${courseId}/status`, { Status: status });
    return response.data;
  },

  // Duplicate a course
  async duplicateCourse(courseId) {
    const response = await api.post(`/api/admin/courses/${courseId}/duplicate`);
    return response.data;
  },

  // Upload course banner
  async uploadCourseBanner(file) {
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await api.post('/api/admin/courses/upload-banner', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Get all course categories
  async getCategories() {
    const response = await api.get('/api/course-categories');
    return response.data;
  },

  // Add a new category
  async addCategory(categoryName) {
    const response = await api.post('/api/course-categories', { name: categoryName });
    return response.data;
  },

  openCoursePreview(courseId, lessonId = null) {
    const params = new URLSearchParams();
    if (lessonId) {
      params.set('lessonId', lessonId);
    }
    const query = params.toString();
    window.open(`/admin/courses/${courseId}/preview${query ? `?${query}` : ''}`, '_blank');
  },
};

// Helper functions for course data transformation
export const courseHelpers = {
  // Transform form data to API request format
  transformCourseFormToRequest(formData) {
    return {
      title: formData.title,
      description: formData.longDescription || formData.description,
      shortDescription: formData.shortDescription,
      category: formData.category,
      tags: formData.tags || [],
      certificateEnabled: formData.certificateEnabled,
      bannerUrl: formData.bannerPreview || null,
      status: formData.status || 'Draft',
      preCourseSurveyId: formData.preCourseSurveyId || null,
      postCourseSurveyId: formData.postCourseSurveyId || null,
      isPreSurveyMandatory: formData.isPreSurveyMandatory || false,
      isPostSurveyMandatory: formData.isPostSurveyMandatory || false,
      requireSequentialLessons: formData.requireSequentialLessons || false,
      showLessonNavigation: formData.showLessonNavigation || false
    };
  },

  // Transform API response to form data format
  transformCourseResponseToForm(courseData) {
    return {
      title: courseData.title || '',
      shortDescription: courseData.shortDescription || '',
      longDescription: courseData.description || '',
      category: courseData.category || '',
      tags: courseData.tags || [],
      certificateEnabled: courseData.certificateEnabled ?? true,
      bannerFile: null,
      bannerPreview: courseData.bannerUrl || '',
      status: courseData.status || 'Draft',
      preCourseSurveyId: courseData.preCourseSurveyId || null,
      postCourseSurveyId: courseData.postCourseSurveyId || null,
      isPreSurveyMandatory: courseData.isPreSurveyMandatory || false,
      isPostSurveyMandatory: courseData.isPostSurveyMandatory || false,
      requireSequentialLessons: courseData.requireSequentialLessons || false,
      showLessonNavigation: courseData.showLessonNavigation || false
    };
  },

  // Get course status options
  getStatusOptions() {
    return [
      { value: 'Draft', label: 'Draft' },
      { value: 'Active', label: 'Active' },
      { value: 'Archived', label: 'Archived' }
    ];
  },

  // Get course categories (you can expand this based on your needs)
  getCategoryOptions() {
    return [
      { value: 'Security', label: 'Security' },
      { value: 'Soft Skills', label: 'Soft Skills' },
      { value: 'HR', label: 'HR' },
      { value: 'Compliance', label: 'Compliance' },
      { value: 'Technical', label: 'Technical' },
      { value: 'Management', label: 'Management' },
      { value: 'Other', label: 'Other' }
    ];
  },

  // Format course data for display in admin list
  formatCourseForDisplay(course) {
    return {
      ...course,
      updatedAt: course.updatedAt ? new Date(course.updatedAt).toLocaleDateString() : 
                  new Date(course.createdAt).toLocaleDateString(),
      createdAt: new Date(course.createdAt).toLocaleDateString(),
      tagsDisplay: course.tags?.join(', ') || '',
      statusDisplay: course.status || 'Draft',
      learners: 0 // TODO: Add learner count from backend
    };
  }
};