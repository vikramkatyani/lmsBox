import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  XMarkIcon, 
  DocumentCheckIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { listQuizzes } from '../services/quizzes';
import lessonsService from '../services/lessons';

export default function QuizLessonModal({ isOpen, onClose, courseId, lesson, onSave }) {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    ordinal: 1,
    type: 'quiz',
    quizId: '',
    isOptional: false,
  });

  const [quizSource, setQuizSource] = useState('existing'); // 'existing', 'new'
  const [availableQuizzes, setAvailableQuizzes] = useState([]);
  const [filteredQuizzes, setFilteredQuizzes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSourceSelector, setShowSourceSelector] = useState(false);

  useEffect(() => {
    if (lesson) {
      setFormData({
        title: lesson.title || '',
        content: lesson.content || '',
        ordinal: lesson.ordinal || 1,
        type: 'quiz',
        quizId: lesson.quizId || '',
        isOptional: lesson.isOptional || false,
      });
      
      if (lesson.quizId) {
        setQuizSource('existing');
        loadQuizDetails(lesson.quizId);
        // Don't show source selector if editing existing quiz
        setShowSourceSelector(false);
      } else {
        setShowSourceSelector(true);
      }
    } else {
      // New lesson - show source selector
      setShowSourceSelector(true);
    }
  }, [lesson]);

  useEffect(() => {
    if (isOpen && quizSource === 'existing') {
      loadAvailableQuizzes();
    }
  }, [isOpen, quizSource, courseId]);

  useEffect(() => {
    // Filter quizzes based on search query
    if (searchQuery.trim() === '') {
      setFilteredQuizzes(availableQuizzes);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = availableQuizzes.filter(quiz => 
        quiz.title?.toLowerCase().includes(query) ||
        quiz.description?.toLowerCase().includes(query)
      );
      setFilteredQuizzes(filtered);
    }
  }, [searchQuery, availableQuizzes]);

  const loadAvailableQuizzes = async () => {
    setIsLoadingQuizzes(true);
    try {
      const quizzes = await listQuizzes('');
      // Filter to show only quizzes from this course
      const courseQuizzes = quizzes.filter(q => q.courseId === courseId);
      setAvailableQuizzes(courseQuizzes);
      setFilteredQuizzes(courseQuizzes);
    } catch (error) {
      console.error('Error loading quizzes:', error);
    } finally {
      setIsLoadingQuizzes(false);
    }
  };

  const loadQuizDetails = async (quizId) => {
    try {
      const quizzes = await listQuizzes('');
      const quiz = quizzes.find(q => q.id === quizId);
      if (quiz) {
        setSelectedQuiz(quiz);
      }
    } catch (error) {
      console.error('Error loading quiz details:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleQuizSourceChange = (source) => {
    setQuizSource(source);
    setSelectedQuiz(null);
    setFormData(prev => ({ ...prev, quizId: '' }));
  };

  const handleQuizSelect = (quiz) => {
    setSelectedQuiz(quiz);
    setFormData(prev => ({
      ...prev,
      quizId: quiz.id,
      title: prev.title || quiz.title // Use quiz title if lesson title is empty
    }));
  };

  const handleCreateNewQuiz = () => {
    // Navigate to quiz creation page with courseId
    navigate(`/admin/quiz/create/${courseId}`);
    handleClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('Please enter a lesson title');
      return;
    }

    if (!formData.quizId) {
      alert('Please select a quiz');
      return;
    }

    setIsSaving(true);

    try {
      if (lesson) {
        await lessonsService.updateLesson(courseId, lesson.id, formData);
      } else {
        await lessonsService.createLesson(courseId, formData);
      }

      onSave?.();
      handleClose();
    } catch (error) {
      console.error('Error saving lesson:', error);
      alert(error.response?.data?.message || 'Failed to save lesson');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setFormData({
      title: '',
      content: '',
      ordinal: 1,
      type: 'quiz',
      quizId: '',
      isOptional: false,
    });
    setQuizSource('existing');
    setSelectedQuiz(null);
    setSearchQuery('');
    setAvailableQuizzes([]);
    setFilteredQuizzes([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" 
          onClick={handleClose}
          aria-hidden="true"
        ></div>

        {/* Center alignment trick */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        {/* Modal panel */}
        <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {/* Header */}
          <div className="bg-orange-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center">
              <DocumentCheckIcon className="h-6 w-6 text-white mr-2" />
              <h3 className="text-lg font-semibold text-white">
                {lesson ? 'Edit Quiz Lesson' : 'Create Quiz Lesson'}
              </h3>
            </div>
            <button
              onClick={handleClose}
              className="text-white hover:text-gray-200 transition"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-6 py-4 max-h-[70vh] overflow-y-auto">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lesson Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Enter lesson title"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    name="content"
                    value={formData.content}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Add a description or instructions for this quiz lesson"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isOptional"
                    checked={formData.isOptional}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    This lesson is optional
                  </label>
                </div>
              </div>

              {/* Quiz Selection */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quiz Selection *
                </label>

                {/* Show existing quiz with preview and change option */}
                {formData.quizId && selectedQuiz && !showSourceSelector && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                    <div className="flex items-center justify-center text-green-600 mb-3">
                      <CheckCircleIcon className="h-6 w-6 mr-2" />
                      <span className="text-sm font-medium">Quiz added to lesson</span>
                    </div>
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">Current Quiz:</p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">{selectedQuiz.title}</p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                            <span>📝 {selectedQuiz.questionCount || 0} questions</span>
                            {selectedQuiz.passingScore && (
                              <span>✅ {selectedQuiz.passingScore}% to pass</span>
                            )}
                            {selectedQuiz.isTimed && selectedQuiz.timeLimit && (
                              <span>⏱️ {selectedQuiz.timeLimit} min</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSourceSelector(true)}
                      className="mt-3 text-sm text-orange-600 hover:text-orange-800 font-medium"
                    >
                      Change quiz
                    </button>
                  </div>
                )}

                {/* Show source selector for new lessons or when changing */}
                {showSourceSelector && (
                  <>
                    <p className="text-xs text-gray-500 mb-3">Choose how to add a quiz to this lesson</p>

                    {/* Source tabs */}
                    <div className="flex border-b border-gray-200 mb-4">
                  <button
                    type="button"
                    onClick={() => handleQuizSourceChange('existing')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                      quizSource === 'existing'
                        ? 'border-orange-600 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <DocumentCheckIcon className="h-5 w-5 inline mr-1" />
                    Select Existing Quiz
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuizSourceChange('new')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                      quizSource === 'new'
                        ? 'border-orange-600 text-orange-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <PlusIcon className="h-5 w-5 inline mr-1" />
                    Create New Quiz
                  </button>
                </div>

                {/* Existing Quiz Selection */}
                {quizSource === 'existing' && (
                  <div>
                    {/* Search Box */}
                    <div className="mb-4">
                      <div className="relative">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search quizzes..."
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>

                    {isLoadingQuizzes ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
                        <p className="text-sm text-gray-600 mt-2">Loading quizzes...</p>
                      </div>
                    ) : filteredQuizzes.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <DocumentCheckIcon className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                        <p className="text-sm">
                          {searchQuery ? 'No quizzes found matching your search.' : 'No quizzes available for this course.'}
                        </p>
                        <p className="text-xs mt-1">Create a new quiz first.</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {filteredQuizzes.map((quiz) => (
                          <div
                            key={quiz.id}
                            onClick={() => handleQuizSelect(quiz)}
                            className={`border rounded-lg p-4 cursor-pointer transition ${
                              selectedQuiz?.id === quiz.id
                                ? 'border-orange-600 bg-orange-50'
                                : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center">
                                  <h4 className="text-sm font-medium text-gray-900">
                                    {quiz.title}
                                  </h4>
                                  {selectedQuiz?.id === quiz.id && (
                                    <CheckCircleIcon className="h-5 w-5 text-orange-600 ml-2" />
                                  )}
                                </div>
                                {quiz.description && (
                                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                    {quiz.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                  <span>📝 {quiz.questionCount || 0} questions</span>
                                  {quiz.passingScore && (
                                    <span>✅ {quiz.passingScore}% to pass</span>
                                  )}
                                  {quiz.isTimed && quiz.timeLimit && (
                                    <span>⏱️ {quiz.timeLimit} min</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Create New Quiz */}
                {quizSource === 'new' && (
                  <div className="text-center py-8 bg-orange-50 border-2 border-dashed border-orange-300 rounded-lg">
                    <PlusIcon className="h-12 w-12 mx-auto text-orange-600 mb-3" />
                    <p className="text-sm font-medium text-gray-900 mb-2">
                      Create a new quiz for this course
                    </p>
                    <p className="text-xs text-gray-600 mb-4">
                      You'll be redirected to the quiz builder. After creating the quiz,<br />
                      return here to add it as a lesson.
                    </p>
                    <button
                      type="button"
                      onClick={handleCreateNewQuiz}
                      className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition inline-flex items-center gap-2"
                    >
                      <PlusIcon className="h-5 w-5" />
                      Go to Quiz Builder
                    </button>
                  </div>
                )}
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
                disabled={isSaving || !formData.quizId || quizSource === 'new'}
              >
                {isSaving ? 'Saving...' : lesson ? 'Update Lesson' : 'Create Lesson'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
