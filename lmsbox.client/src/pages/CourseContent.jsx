import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LearnerHeader from '../components/LearnerHeader';
import QuizPlayer from '../components/QuizPlayer';
import SurveyPlayer from '../components/SurveyPlayer';
import { getCourseDetails } from '../services/courseDetails';
import { learnerSurveyService } from '../services/surveys';
import toast from 'react-hot-toast';
import usePageTitle from '../hooks/usePageTitle';
import { API_BASE } from '../utils/apiBase';

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
      case 'document':
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
      case 'content':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
        );
      case 'survey':
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
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

function ContentPanel({ lesson, courseId: _courseId, onProgressUpdate }) {
  const videoRef = React.useRef(null);
  const [hasStarted, setHasStarted] = React.useState(false);
  const sessionStartTimeRef = React.useRef(null);
  const timeTrackingIntervalRef = React.useRef(null);

  // Track session time for the current lesson
  React.useEffect(() => {
    if (!lesson) return;

    // Start tracking time for this lesson
    sessionStartTimeRef.current = Date.now();

    // Send time update every 30 seconds
    timeTrackingIntervalRef.current = setInterval(() => {
      if (sessionStartTimeRef.current) {
        const timeSpentSeconds = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
        
        if (timeSpentSeconds > 0) {
          // Send time update
          onProgressUpdate?.(lesson.id, {
            progressPercent: lesson.progress || 0,
            videoTimestamp: lesson.videoTimestamp,
            completed: lesson.isCompleted,
            timeSpentSeconds: timeSpentSeconds
          });
          
          // Reset the start time for next interval
          sessionStartTimeRef.current = Date.now();
        }
      }
    }, 30000); // Every 30 seconds

    // Cleanup on lesson change or unmount
    return () => {
      if (timeTrackingIntervalRef.current) {
        clearInterval(timeTrackingIntervalRef.current);
      }
      
      // Send final time update when leaving the lesson
      if (sessionStartTimeRef.current) {
        const timeSpentSeconds = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
        if (timeSpentSeconds > 0) {
          onProgressUpdate?.(lesson.id, {
            progressPercent: lesson.progress || 0,
            videoTimestamp: lesson.videoTimestamp,
            completed: lesson.isCompleted,
            timeSpentSeconds: timeSpentSeconds
          });
        }
      }
    };
  }, [lesson, onProgressUpdate]);

  // Resume video from saved timestamp
  React.useEffect(() => {
    if (lesson && lesson.type === 'video' && lesson.videoTimestamp && videoRef.current && !hasStarted) {
      videoRef.current.currentTime = lesson.videoTimestamp;
      setHasStarted(true);
    }
  }, [lesson, hasStarted]);

  // Listen for SCORM completion messages
  React.useEffect(() => {
    if (!lesson || lesson.type !== 'scorm') return;

    const handleScormMessage = (event) => {
      // Accept messages from the SCORM player
      if (event.data && event.data.type === 'scorm') {
        const { status, score: _score } = event.data;
        
        // SCORM statuses: completed, incomplete, passed, failed
        if (status === 'completed' || status === 'passed') {
          onProgressUpdate?.(lesson.id, {
            progressPercent: 100,
            videoTimestamp: null,
            completed: true
          });
          toast.success('SCORM lesson completed!');
        }
      }
    };

    window.addEventListener('message', handleScormMessage);
    return () => window.removeEventListener('message', handleScormMessage);
  }, [lesson, onProgressUpdate]);

  // Save progress periodically
  const handleTimeUpdate = React.useCallback((e) => {
    if (!lesson || lesson.type !== 'video') return;
    
    const video = e.target;
    const currentTime = Math.floor(video.currentTime);
    const duration = video.duration;
    
    if (duration > 0) {
      const progressPercent = Math.floor((currentTime / duration) * 100);
      
      // Save progress every 5 seconds
      if (currentTime % 5 === 0) {
        onProgressUpdate?.(lesson.id, {
          progressPercent,
          videoTimestamp: currentTime,
          completed: false // Don't mark complete until video ends
        });
      }
    }
  }, [lesson, onProgressUpdate]);

  // Handle video end - mark as complete
  const handleVideoEnded = React.useCallback((e) => {
    if (!lesson || lesson.type !== 'video') return;
    
    const video = e.target;
    const duration = video.duration;
    
    onProgressUpdate?.(lesson.id, {
      progressPercent: 100,
      videoTimestamp: Math.floor(duration),
      completed: true
    });
    
    toast.success('Video lesson completed!');
  }, [lesson, onProgressUpdate]);

  // Save timestamp when video pauses (but don't mark complete)
  const handlePause = React.useCallback((e) => {
    if (!lesson || lesson.type !== 'video') return;
    
    const video = e.target;
    const currentTime = Math.floor(video.currentTime);
    const duration = video.duration;
    const progressPercent = duration > 0 ? Math.floor((currentTime / duration) * 100) : 0;
    
    // Only save timestamp, don't mark complete unless video actually ended
    onProgressUpdate?.(lesson.id, {
      progressPercent,
      videoTimestamp: currentTime,
      completed: false
    });
  }, [lesson, onProgressUpdate]);

  if (!lesson) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Select a lesson to start learning
      </div>
    );
  }

  const renderContent = () => {
    switch (lesson.type) {
      case 'video': {
        // Check if it's a YouTube or Vimeo embed URL
        const isYouTube = lesson.url && (lesson.url.includes('youtube.com') || lesson.url.includes('youtu.be'));
        const isVimeo = lesson.url && lesson.url.includes('vimeo.com');
        
        // Convert YouTube URLs to embed format
        let embedUrl = lesson.url;
        if (isYouTube) {
          const youtubeId = lesson.url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)?.[1];
          if (youtubeId) {
            embedUrl = `https://www.youtube.com/embed/${youtubeId}`;
          }
        } else if (isVimeo) {
          const vimeoId = lesson.url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1];
          if (vimeoId) {
            embedUrl = `https://player.vimeo.com/video/${vimeoId}`;
          }
        }
        
        return (
          <div className="w-full h-full bg-black">
            {lesson.url ? (
              isYouTube || isVimeo ? (
                <iframe
                  src={embedUrl}
                  className="w-full h-full"
                  title="Video Player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video 
                  ref={videoRef}
                  controls 
                  className="w-full h-full"
                  src={lesson.url}
                  controlsList="nodownload"
                  onTimeUpdate={handleTimeUpdate}
                  onPause={handlePause}
                  onEnded={handleVideoEnded}
                  onError={(e) => {
                    console.error('Video load error:', e);
                    console.error('Video URL:', lesson.url);
                    console.error('Error details:', e.target.error);
                    toast.error('Failed to load video. Please check the video URL or file format.');
                  }}
                  crossOrigin="anonymous"
                >
                  <source src={lesson.url} type="video/mp4" />
                  <source src={lesson.url} type="video/webm" />
                  <source src={lesson.url} type="video/ogg" />
                  Your browser does not support the video tag.
                </video>
              )
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
      }
      case 'pdf':
      case 'document': {
        return (
          <div className="w-full h-full bg-gray-100 relative">
            {lesson.url ? (
              <>
                <object 
                  data={lesson.url}
                  type="application/pdf"
                  className="w-full h-full"
                  title="PDF Viewer"
                >
                  <div className="flex flex-col items-center justify-center h-full p-8">
                    <svg className="w-20 h-20 mb-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    <p className="text-gray-600 mb-4">Unable to display PDF in browser</p>
                    <a 
                      href={lesson.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors inline-flex items-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>Open PDF in New Tab</span>
                    </a>
                  </div>
                </object>
                {!lesson.isCompleted && (
                  <div className="absolute bottom-4 right-4 z-10">
                    <button
                      onClick={() => {
                        onProgressUpdate?.(lesson.id, {
                          progressPercent: 100,
                          videoTimestamp: null,
                          completed: true
                        });
                        toast.success('Lesson marked as complete!');
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg shadow-lg font-medium transition-colors flex items-center space-x-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Mark as Complete</span>
                    </button>
                  </div>
                )}
              </>
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
      }
      case 'quiz':
        return lesson.quizId ? (
          <QuizPlayer 
            quizId={lesson.quizId}
            onComplete={(_score) => {
              // Mark lesson as complete when quiz is passed
              onProgressUpdate?.(lesson.id, {
                progressPercent: 100,
                videoTimestamp: null,
                completed: true
              });
            }}
            onProgressUpdate={onProgressUpdate}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Quiz not configured</p>
          </div>
        );
      case 'scorm': {
        // Use proxy endpoint to avoid CORS issues with SCORM content
        const proxyUrl = lesson.url ? `${API_BASE}/api/scorm-proxy?url=${encodeURIComponent(lesson.url)}` : null;
        return (
          <div className="w-full h-full bg-gray-50 relative">
            {proxyUrl ? (
              <iframe 
                src={`/scorm-player.html?url=${encodeURIComponent(proxyUrl)}`}
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
      }
      case 'content':
        return (
          <div className="w-full h-full bg-white p-8 overflow-auto">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold mb-4">{lesson.title}</h2>
              <div 
                className="prose prose-lg max-w-none"
                dangerouslySetInnerHTML={{ __html: lesson.content || '<p>No content available</p>' }}
              />
              {!lesson.isCompleted && (
                <div className="mt-8">
                  <button
                    onClick={() => {
                      onProgressUpdate?.(lesson.id, {
                        progressPercent: 100,
                        videoTimestamp: null,
                        completed: true
                      });
                      toast.success('Lesson marked as complete!');
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg shadow font-medium transition-colors flex items-center space-x-2"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Mark as Complete</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-600 text-center">
              <svg className="w-20 h-20 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-lg font-medium">Unknown content type: {lesson.type}</p>
              <p className="text-sm text-gray-500 mt-2">This lesson type is not supported yet</p>
            </div>
          </div>
        );
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
  
  // Survey states
  const [surveyItems, setSurveyItems] = useState([]);
  const [activeSurvey, setActiveSurvey] = useState(null);
  const [surveyLoading, setSurveyLoading] = useState(false);

  usePageTitle(course ? `${course.title} - Course Content` : 'Course Content');

  const handleProgressUpdate = async (lessonId, progressData) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE}/api/learner/courses/${courseId}/lessons/${lessonId}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(progressData)
      });
      
      // Only update the local state when lesson is marked as completed
      // This prevents interrupting video playback and avoids full page reload
      if (progressData.completed) {
        // Update the lesson in the course state to show completion status
        setCourse(prevCourse => {
          if (!prevCourse) return prevCourse;
          
          const updatedCourse = {
            ...prevCourse,
            lessons: prevCourse.lessons.map(lesson => 
              lesson.id === lessonId 
                ? { ...lesson, isCompleted: true, progressPercent: 100 }
                : lesson
            )
          };
          
          // Check if all lessons are now completed
          const allLessonsComplete = updatedCourse.lessons.every(l => l.isCompleted);
          if (allLessonsComplete && updatedCourse.hasPostSurvey && !updatedCourse.postSurveyCompleted) {
            // Load post-survey if not already loaded
            if (!surveyItems.find(s => s.surveyType === 'post')) {
              loadPostSurvey();
            }
          }
          
          return updatedCourse;
        });
        
        // Update active lesson if it's the completed one
        if (activeLesson?.id === lessonId) {
          setActiveLesson(prev => prev ? { ...prev, isCompleted: true, progressPercent: 100 } : prev);
        }
      }
    } catch (error) {
      console.error('Error updating progress:', error);
      // Don't show error to user, it's background sync
    }
  };

  const trackLessonAccess = async (lessonId) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE}/api/learner/courses/${courseId}/lessons/${lessonId}/access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Error tracking lesson access:', error);
    }
  };

  const loadPreSurvey = async () => {
    try {
      const surveyData = await learnerSurveyService.getPreCourseSurvey(courseId);
      if (surveyData.alreadyCompleted) {
        // Add as completed survey item
        setSurveyItems(prev => [{
          id: 'pre-survey',
          title: surveyData.title || 'Pre-Course Survey',
          type: 'survey',
          isCompleted: true,
          surveyType: 'pre',
          order: -1 // Show before lessons
        }, ...prev]);
        return null; // Return null to indicate completed
      }
      // Add as active survey item
      const preSurveyItem = {
        id: 'pre-survey',
        title: surveyData.title || 'Pre-Course Survey',
        type: 'survey',
        isCompleted: false,
        isMandatory: surveyData.isMandatory,
        surveyType: 'pre',
        surveyData: surveyData,
        order: -1
      };
      setSurveyItems(prev => [preSurveyItem, ...prev]);
      return preSurveyItem; // Return the survey item to set as active
    } catch (error) {
      console.log('No pre-survey configured or error loading:', error);
      return null;
    }
  };

  const loadPostSurvey = async () => {
    try {
      const surveyData = await learnerSurveyService.getPostCourseSurvey(courseId);
      if (surveyData.alreadyCompleted) {
        // Add as completed survey item
        setSurveyItems(prev => [...prev, {
          id: 'post-survey',
          title: surveyData.title || 'Post-Course Survey',
          type: 'survey',
          isCompleted: true,
          surveyType: 'post',
          order: 9999 // Show after lessons
        }]);
        return;
      }
      // Add as active survey item
      setSurveyItems(prev => [...prev, {
        id: 'post-survey',
        title: surveyData.title || 'Post-Course Survey',
        type: 'survey',
        isCompleted: false,
        isMandatory: surveyData.isMandatory,
        surveyType: 'post',
        surveyData: surveyData,
        order: 9999
      }]);
    } catch (error) {
      console.log('No post-survey configured or error loading:', error);
    }
  };

  const handleSurveySubmit = async (answers, surveyType) => {
    setSurveyLoading(true);
    try {
      if (surveyType === 'pre') {
        await learnerSurveyService.submitPreCourseSurvey(courseId, answers);
      } else {
        await learnerSurveyService.submitPostCourseSurvey(courseId, answers);
      }
      toast.success('Survey submitted successfully!');
      
      // Mark survey as completed
      setSurveyItems(prev => prev.map(item => 
        item.surveyType === surveyType ? { ...item, isCompleted: true } : item
      ));
      setActiveSurvey(null);
      
      // Reload course to update overall completion status
      await loadCourseDetails();
    } catch (error) {
      console.error('Error submitting survey:', error);
      toast.error('Failed to submit survey');
    } finally {
      setSurveyLoading(false);
    }
  };



  const loadCourseDetails = async (signal = null) => {
    setLoading(true);
    try {
      const courseData = await getCourseDetails(courseId, signal);
      
      if (!courseData && (!signal || !signal.aborted)) {
        toast.error('Course not found or access denied');
        navigate('/courses/all');
        return;
      }
      
      if (!signal || !signal.aborted) {
        setCourse(courseData);
        
        // Check for pre-survey and load it (both completed and incomplete)
        let preSurveyItem = null;
        if (courseData.hasPreSurvey) {
          preSurveyItem = await loadPreSurvey();
        }
        
        // Load post-survey if it exists
        if (courseData.hasPostSurvey) {
          await loadPostSurvey();
        }
        
        // Set active content: pre-survey first (if exists and not completed), otherwise lesson
        if (preSurveyItem && !courseData.preSurveyCompleted) {
          // Show pre-survey as the first active item if not completed
          setActiveSurvey(preSurveyItem);
          setActiveLesson(null);
        } else if (courseData.lessons && courseData.lessons.length > 0) {
          // Set active lesson based on last accessed or first lesson
          let lessonToShow = courseData.lessons[0]; // Default to first lesson
          
          // If there's a last accessed lesson, use that instead
          if (courseData.lastAccessedLessonId) {
            const lastLesson = courseData.lessons.find(
              lesson => lesson.id === courseData.lastAccessedLessonId
            );
            if (lastLesson) {
              lessonToShow = lastLesson;
            }
          }
          
          setActiveLesson(lessonToShow);
          setActiveSurvey(null);
        }
      }
    } catch (error) {
      if (!signal || !signal.aborted) {
        console.error('Error loading course details:', error);
        toast.error('Failed to load course details');
        navigate('/courses/all');
      }
    } finally {
      if (!signal || !signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // Create an AbortController for this request
    const abortController = new AbortController();

    if (courseId) {
      loadCourseDetails(abortController.signal);
    } else {
      navigate('/courses/all');
    }

    // Cleanup function to abort the request if component unmounts or courseId changes
    return () => {
      abortController.abort();
    };
  }, [courseId, navigate]);

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
              {course.lessons.filter(l => l.isCompleted).length + surveyItems.filter(s => s.isCompleted).length} of {course.lessons.length + surveyItems.length} completed
            </p>
          </div>
          <div className="p-4 space-y-2">
            {/* Combine lessons and surveys, sorted by order */}
            {[...surveyItems, ...course.lessons.map((l, idx) => ({ ...l, order: idx }))]
              .sort((a, b) => a.order - b.order)
              .map((item) => {
                const isLocked = item.type !== 'survey' && 
                  surveyItems.some(s => s.surveyType === 'pre' && s.isMandatory && !s.isCompleted);
                
                const isActive = item.type === 'survey' 
                  ? activeSurvey?.id === item.id
                  : activeLesson?.id === item.id;
                
                return (
                  <div key={item.id} className="relative">
                    {isLocked && (
                      <div className="absolute inset-0 bg-gray-100 bg-opacity-70 rounded-lg flex items-center justify-center z-10">
                        <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    <LessonItem
                      lesson={item}
                      isActive={isActive}
                      onClick={() => {
                        if (isLocked) {
                          toast('Please complete the pre-course survey first', { icon: '🔒' });
                          return;
                        }
                        
                        if (item.type === 'survey') {
                          setActiveSurvey(item);
                          setActiveLesson(null);
                        } else {
                          setActiveLesson(item);
                          setActiveSurvey(null);
                          trackLessonAccess(item.id);
                        }
                        setIsMobileSidebarOpen(false);
                      }}
                    />
                  </div>
                );
              })}
          </div>
        </div>

        {/* Panels 2 & 3: Content and Description */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Panel 2: Content Display */}
          <div className="flex-1 bg-gray-900 overflow-hidden min-h-[300px] lg:min-h-0">
            {activeSurvey ? (
              <div className="h-full overflow-y-auto bg-gray-50">
                <SurveyPlayer
                  survey={activeSurvey.surveyData}
                  onSubmit={(answers) => handleSurveySubmit(answers, activeSurvey.surveyType)}
                  onCancel={null}
                  surveyType={activeSurvey.surveyType}
                />
              </div>
            ) : (
              <ContentPanel 
                lesson={activeLesson} 
                courseId={courseId}
                onProgressUpdate={handleProgressUpdate}
              />
            )}
          </div>

          {/* Panel 3: Course Info and Certificate */}
          <div className="lg:h-48 bg-white border-t overflow-y-auto">
            <div className="p-4 lg:p-6">
              {(activeLesson || activeSurvey) && (
                <>
                  <h3 className="text-lg lg:text-xl font-semibold text-gray-900 mb-1">
                    {activeLesson?.title || activeSurvey?.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">{course.title}</p>
                  
                  {/* Certificates Section - only show for lessons, not surveys */}
                  {activeLesson && (
                    <div className="mb-4 pb-4 border-b">
                      <h4 className="text-base font-semibold text-gray-900 mb-2">Certificates</h4>
                      <p className="text-sm text-gray-600 mb-3">Get certificate by completing entire course</p>
                      {course.isCompleted ? (
                        <button
                          onClick={async () => {
                            try {
                              toast.loading('Generating certificate...', { id: 'cert-gen' });
                              const response = await fetch(`/api/learner/courses/${course.id}/certificate`, {
                                headers: {
                                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                                }
                              });
                            
                            if (response.ok) {
                              const data = await response.json();
                              toast.dismiss('cert-gen');
                              if (data.certificateUrl) {
                                toast.success('Certificate ready! Opening...');
                                window.open(data.certificateUrl, '_blank');
                              } else {
                                toast.error('Certificate URL not found');
                              }
                            } else {
                              const errorData = await response.json().catch(() => ({}));
                              toast.dismiss('cert-gen');
                              console.error('Certificate error response:', errorData);
                              console.error('Response status:', response.status);
                              toast.error(errorData.message || 'Failed to generate certificate. Please try again.');
                            }
                          } catch (error) {
                            toast.dismiss('cert-gen');
                            console.error('Error fetching certificate:', error);
                            toast.error('Network error. Please check your connection and try again.');
                          }
                        }}
                        className="px-6 py-2 rounded border border-purple-500 bg-purple-500 text-white transition-colors hover:bg-purple-600"
                      >
                        View Certificate
                      </button>
                      ) : (
                        <button 
                          disabled
                          className="px-6 py-2 rounded border border-gray-300 text-gray-400 cursor-not-allowed"
                        >
                          Complete Course to Get Certificate
                        </button>
                      )}
                    </div>
                  )}

                  {/* Description Section */}
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 mb-2">Description</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {activeSurvey?.surveyData?.description || course.description}
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
