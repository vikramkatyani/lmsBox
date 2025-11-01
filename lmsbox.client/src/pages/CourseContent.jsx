import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LearnerHeader from '../components/LearnerHeader';
import { getCourseDetails } from '../services/courseDetails';
import toast from 'react-hot-toast';
import video1 from '../assets/video1.mp4';
import pdf2 from '../assets/pdf2.pdf';

function LessonItem({ lesson, isActive, onClick }) {
  const getIcon = (type) => {
    switch (type) {
      case 'video':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12 0a2 2 0 012-2h2a2 2 0 012 2v8a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
          </svg>
        );
      case 'pdf':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
      case 'quiz':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
        );
      case 'scorm':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div
      onClick={onClick}
      className={`flex items-center space-x-3 p-3 rounded cursor-pointer transition ${
        isActive ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-gray-50'
      }`}
    >
      <div className={`${lesson.isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
        {lesson.isCompleted ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ) : (
          <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center space-x-2">
          <div className="text-gray-500">{getIcon(lesson.type)}</div>
          <p className={`text-sm font-medium ${isActive ? 'text-blue-600' : 'text-gray-900'}`}>
            {lesson.title}
          </p>
        </div>
        {lesson.duration && lesson.duration !== "15:00" && (
          <p className="text-xs text-gray-500 ml-6">{lesson.duration}</p>
        )}
        {lesson.questions && (
          <p className="text-xs text-gray-500 ml-6">{lesson.questions} questions</p>
        )}
      </div>
    </div>
  );
}

function ContentPanel({ lesson }) {
  if (!lesson) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Select a lesson to start learning
      </div>
    );
  }

  const renderContent = () => {
    switch (lesson.type) {
      case 'video':
        return (
          <div className="w-full h-full bg-black">
            {lesson.url ? (
              <video 
                controls 
                className="w-full h-full"
                src={lesson.url}
              >
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="flex items-center justify-center h-full text-white text-center">
                <div>
                  <svg className="w-20 h-20 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                  </svg>
                  <p>Video Player</p>
                  <p className="text-sm text-gray-400 mt-2">{lesson.duration}</p>
                </div>
              </div>
            )}
          </div>
        );
      case 'pdf':
        return (
          <div className="w-full h-full bg-gray-100">
            {lesson.url ? (
              <iframe 
                src={lesson.url}
                className="w-full h-full"
                title="PDF Viewer"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-600 text-center">
                  <svg className="w-20 h-20 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  </svg>
                  <p>PDF Viewer</p>
                  <p className="text-sm text-gray-500 mt-2">Document content will load here</p>
                </div>
              </div>
            )}
          </div>
        );
      case 'quiz':
        return (
          <div className="w-full h-full bg-white p-8 overflow-auto">
            <div className="max-w-2xl mx-auto">
              <h3 className="text-xl font-semibold mb-6">Knowledge Check Quiz</h3>
              <div className="space-y-4">
                <div className="p-4 border rounded">
                  <p className="font-medium mb-3">Question 1 of {lesson.questions}</p>
                  <p className="text-gray-700 mb-4">What is Node.js primarily used for?</p>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="radio" name="q1" className="text-blue-600" />
                      <span>Frontend development</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="radio" name="q1" className="text-blue-600" />
                      <span>Backend development</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="radio" name="q1" className="text-blue-600" />
                      <span>Mobile app development</span>
                    </label>
                  </div>
                </div>
              </div>
              <button className="mt-6 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700">
                Submit Answer
              </button>
            </div>
          </div>
        );
      case 'scorm':
        return (
          <div className="w-full h-full bg-gray-50">
            {lesson.url ? (
              <iframe 
                src={`/scorm-player.html?url=${encodeURIComponent(lesson.url)}`}
                className="w-full h-full border-0"
                title="SCORM Content Player"
                allow="autoplay; fullscreen"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-600 text-center">
                  <svg className="w-20 h-20 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                  </svg>
                  <p>SCORM Content Player</p>
                  <p className="text-sm text-gray-500 mt-2">Interactive content will load here</p>
                </div>
              </div>
            )}
          </div>
        );
      default:
        return <div>Unknown content type</div>;
    }
  };

  return <div className="h-full">{renderContent()}</div>;
}

export default function CourseContent() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Create an AbortController for this request
    const abortController = new AbortController();
    
    const loadCourseDetails = async () => {
      setLoading(true);
      try {
        const courseData = await getCourseDetails(courseId, abortController.signal);
        
        if (!courseData && !abortController.signal.aborted) {
          toast.error('Course not found or access denied');
          navigate('/courses/all');
          return;
        }
        
        if (!abortController.signal.aborted) {
          setCourse(courseData);
          // Set first lesson as active by default
          if (courseData.lessons && courseData.lessons.length > 0) {
            setActiveLesson(courseData.lessons[0]);
          }
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          console.error('Error loading course details:', error);
          toast.error('Failed to load course details');
          navigate('/courses/all');
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    if (courseId) {
      loadCourseDetails();
    } else {
      navigate('/courses/all');
    }

    // Cleanup function to abort the request if component unmounts or courseId changes
    return () => {
      abortController.abort();
    };
  }, [courseId, navigate]);

  useEffect(() => {
    if (course) {
      document.title = `${course.title} - Course Content`;
    }
  }, [course]);

  if (loading || !course) {
    return (
      <div className="min-h-screen bg-page-bg">
        <LearnerHeader />
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">{loading ? 'Loading course...' : 'Course not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page-bg flex flex-col">
      <LearnerHeader />
      
      {/* Mobile overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile hamburger button */}
      <div className="lg:hidden bg-white border-b px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          className="flex items-center text-gray-700 hover:text-gray-900"
        >
          <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="font-medium">Course Lessons</span>
        </button>
        <button
          onClick={() => navigate('/courses/all')}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          Back to Courses
        </button>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        {/* Panel 1: Lessons Sidebar */}
        <div className={`
          fixed lg:relative inset-y-0 left-0 z-50
          w-80 bg-white border-r overflow-y-auto
          transform transition-transform duration-300 ease-in-out
          ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}>
          <div className="p-4 border-b">
            <button
              onClick={() => {
                navigate('/courses/all');
                setIsMobileSidebarOpen(false);
              }}
              className="flex items-center text-sm text-gray-600 hover:text-gray-900 mb-3"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to courses
            </button>
            <h2 className="text-lg font-semibold text-gray-900">{course.title}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {course.lessons.filter(l => l.isCompleted).length} of {course.lessons.length} completed
            </p>
          </div>
          <div className="p-4 space-y-2">
            {course.lessons.map((lesson) => (
              <LessonItem
                key={lesson.id}
                lesson={lesson}
                isActive={activeLesson?.id === lesson.id}
                onClick={() => {
                  setActiveLesson(lesson);
                  setIsMobileSidebarOpen(false); // Close sidebar on mobile after selecting
                }}
              />
            ))}
          </div>
        </div>

        {/* Panels 2 & 3: Content and Description */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Panel 2: Content Display */}
          <div className="flex-1 bg-gray-900 overflow-hidden min-h-[300px] lg:min-h-0">
            <ContentPanel lesson={activeLesson} />
          </div>

          {/* Panel 3: Course Info and Certificate */}
          <div className="lg:h-48 bg-white border-t overflow-y-auto">
            <div className="p-4 lg:p-6">
              {activeLesson && (
                <>
                  <h3 className="text-lg lg:text-xl font-semibold text-gray-900 mb-1">
                    {activeLesson.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">{course.title}</p>
                  
                  {/* Certificates Section */}
                  <div className="mb-4 pb-4 border-b">
                    <h4 className="text-base font-semibold text-gray-900 mb-2">Certificates</h4>
                    <p className="text-sm text-gray-600 mb-3">Get certificate by completing entire course</p>
                    <button 
                      disabled={!course.isCompleted}
                      className={`px-6 py-2 rounded border transition-colors ${
                        course.isCompleted
                          ? 'border-purple-500 text-purple-600 hover:bg-purple-50'
                          : 'border-gray-300 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      Certificate
                    </button>
                  </div>

                  {/* Description Section */}
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">Description</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {course.description}
                    </p>
                  </div>
                </>
              )}
              {!activeLesson && (
                <p className="text-gray-500">Choose a lesson from the sidebar to begin learning.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
