// Course Details service: fetch detailed course information with lessons
// Backend endpoint:
// GET /api/learner/courses/{courseId} -> CourseDetailDto

import api from '../utils/api';

export async function getCourseDetails(courseId, signal = null) {
  try {
    const res = await api.get(`/api/learner/courses/${courseId}`, {
      signal, // Pass abort signal to axios
    });
    return res.data;
  } catch (err) {
    // Check if the error is due to request cancellation
    if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
      // Request was cancelled, don't treat as error
      return null;
    }
    
    // For development, we could still fall back to mock data
    const useMocks = import.meta.env.DEV || import.meta.env.VITE_USE_MOCKS === 'true';
    if (!useMocks) {
      console.warn('Failed to fetch course details from API. Returning null (mocks disabled).', err.message);
      return null;
    }
    
    console.warn('Failed to fetch course details from API, using mock data:', err.message);
    
    // Mock fallback data - basic structure
    return {
      id: courseId,
      title: "Sample Course",
      description: "This is a sample course description.",
      banner: "/assets/default-course-banner.png",
      progress: 0,
      isCompleted: false,
      completedAt: null,
      lessons: [
        {
          id: "1",
          title: "Introduction",
          content: "Welcome to this course",
          type: "video",
          duration: "10:00",
          ordinal: 1,
          progress: 0,
          isCompleted: false,
          completedAt: null,
          url: "/assets/default-video.mp4"
        }
      ]
    };
  }
}