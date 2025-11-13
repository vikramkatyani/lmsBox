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
    const response = await api.put(`/api/admin/courses/${courseId}/status`, { status });
    return response.data;
  },

  // Duplicate a course
  async duplicateCourse(courseId) {
    const response = await api.post(`/api/admin/courses/${courseId}/duplicate`);
    return response.data;
  }
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
      status: formData.status || 'Draft'
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
      status: courseData.status || 'Draft'
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