import { useState } from 'react';
import { Sparkles, X, MessageSquare, FileText, HelpCircle, Wand2 } from 'lucide-react';
import { aiAssistant } from '../services/aiAssistant';

const AIAssistant = ({ context = '', onApplyContent = null, mode = 'floating', isOpen: externalIsOpen = false, onClose = null, defaultTab = 'chat' }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Use external control if provided (for slide-in mode)
  const isVisible = mode === 'slideIn' ? externalIsOpen : isOpen;
  const handleClose = () => {
    if (mode === 'slideIn' && onClose) {
      onClose();
    } else {
      setIsOpen(false);
    }
  };
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  // Course outline state
  const [courseTopic, setCourseTopic] = useState('');
  const [courseLevel, setCourseLevel] = useState('');
  const [courseDuration, setCourseDuration] = useState('');
  const [courseOutline, setCourseOutline] = useState('');

  // Lesson content state
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonContext, setLessonContext] = useState('');
  const [lessonContent, setLessonContent] = useState('');

  // Quiz questions state
  const [quizTopic, setQuizTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState('Medium');
  const [quizQuestions, setQuizQuestions] = useState('');

  const handleChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = { role: 'user', content: chatInput };
    setChatMessages([...chatMessages, userMessage]);
    setChatInput('');
    setLoading(true);
    setError('');

    try {
      const result = await aiAssistant.chat(chatInput, context);
      const aiMessage = { role: 'assistant', content: result.response };
      setChatMessages([...chatMessages, userMessage, aiMessage]);
    } catch (err) {
      setError('Failed to get AI response. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCourseOutline = async (e) => {
    e.preventDefault();
    if (!courseTopic.trim()) return;

    setLoading(true);
    setError('');

    try {
      const result = await aiAssistant.generateCourseOutline(
        courseTopic,
        courseLevel || null,
        courseDuration || null
      );
      setCourseOutline(result.content);
    } catch (err) {
      setError('Failed to generate course outline. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateLessonContent = async (e) => {
    e.preventDefault();
    if (!lessonTitle.trim()) return;

    setLoading(true);
    setError('');

    try {
      const result = await aiAssistant.generateLessonContent(
        lessonTitle,
        lessonContext || context || null
      );
      setLessonContent(result.content);
    } catch (err) {
      setError('Failed to generate lesson content. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQuizQuestions = async (e) => {
    e.preventDefault();
    if (!quizTopic.trim()) return;

    setLoading(true);
    setError('');

    try {
      const result = await aiAssistant.generateQuizQuestions(
        quizTopic,
        questionCount,
        difficulty
      );
      setQuizQuestions(result.content);
    } catch (err) {
      setError('Failed to generate quiz questions. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = (content, shouldClose = true) => {
    if (onApplyContent) {
      onApplyContent(content);
      if (shouldClose) {
        handleClose();
      }
    }
  };

  return (
    <>
      {/* Floating Button - only show in floating mode */}
      {mode === 'floating' && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-50 flex items-center gap-2 group"
          title="AI Assistant"
        >
          <Sparkles className="w-6 h-6" />
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap">
            AI Assistant
          </span>
        </button>
      )}

      {/* Modal (floating mode) or Slide-in */}
      {isVisible && (
        <>
          {mode === 'floating' ? (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-t-lg">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    <h2 className="text-xl font-semibold">AI Assistant</h2>
                  </div>
                  <button
                    onClick={handleClose}
                    className="hover:bg-white/20 p-2 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

            {/* Tabs */}
            <div className="flex border-b bg-gray-50">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                  activeTab === 'chat'
                    ? 'border-b-2 border-purple-600 text-purple-600 bg-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                Chat
              </button>
              <button
                onClick={() => setActiveTab('course')}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                  activeTab === 'course'
                    ? 'border-b-2 border-purple-600 text-purple-600 bg-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <FileText className="w-4 h-4" />
                Course Outline
              </button>
              <button
                onClick={() => setActiveTab('lesson')}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                  activeTab === 'lesson'
                    ? 'border-b-2 border-purple-600 text-purple-600 bg-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Wand2 className="w-4 h-4" />
                Lesson Content
              </button>
              <button
                onClick={() => setActiveTab('quiz')}
                className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                  activeTab === 'quiz'
                    ? 'border-b-2 border-purple-600 text-purple-600 bg-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                Quiz Questions
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                  {error}
                </div>
              )}

              {/* Chat Tab */}
              {activeTab === 'chat' && (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                    {chatMessages.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>Ask me anything about creating courses, lessons, or quizzes!</p>
                      </div>
                    ) : (
                      chatMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] p-3 rounded-lg ${
                              msg.role === 'user'
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-100 text-gray-900'
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      ))
                    )}
                    {loading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 p-3 rounded-lg">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <form onSubmit={handleChat} className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                      disabled={loading}
                    />
                    <button
                      type="submit"
                      disabled={loading || !chatInput.trim()}
                      className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Send
                    </button>
                  </form>
                </div>
              )}

              {/* Course Outline Tab */}
              {activeTab === 'course' && (
                <div className="space-y-4">
                  <form onSubmit={handleGenerateCourseOutline} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Course Topic *
                      </label>
                      <input
                        type="text"
                        value={courseTopic}
                        onChange={(e) => setCourseTopic(e.target.value)}
                        placeholder="e.g., Fire Safety Training"
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                        disabled={loading}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Level (optional)
                        </label>
                        <select
                          value={courseLevel}
                          onChange={(e) => setCourseLevel(e.target.value)}
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                          disabled={loading}
                        >
                          <option value="">Select level</option>
                          <option value="Beginner">Beginner</option>
                          <option value="Intermediate">Intermediate</option>
                          <option value="Advanced">Advanced</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Duration (optional)
                        </label>
                        <input
                          type="text"
                          value={courseDuration}
                          onChange={(e) => setCourseDuration(e.target.value)}
                          placeholder="e.g., 4 weeks"
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                          disabled={loading}
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !courseTopic.trim()}
                      className="w-full px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Generate Course Outline
                        </>
                      )}
                    </button>
                  </form>

                  {courseOutline && (
                    <div className="mt-4 p-4 bg-gray-50 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900">Generated Outline</h3>
                        {onApplyContent && (
                          <button
                            onClick={() => handleApply(courseOutline)}
                            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Apply to Course
                          </button>
                        )}
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        {(() => {
                          try {
                            let cleanContent = courseOutline.trim();
                            if (cleanContent.startsWith('```')) {
                              cleanContent = cleanContent.replace(/^```json\n/, '').replace(/^```\n/, '').replace(/\n```$/, '');
                            }
                            const outline = JSON.parse(cleanContent);
                            return (
                              <div className="space-y-4">
                                <div>
                                  <h4 className="font-semibold text-lg text-gray-900">{outline.title}</h4>
                                  {outline.shortDescription && (
                                    <p className="text-sm text-gray-600 mt-1">{outline.shortDescription}</p>
                                  )}
                                  {outline.longDescription && (
                                    <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{outline.longDescription}</p>
                                  )}
                                </div>
                                
                                {outline.lessons && outline.lessons.length > 0 && (
                                  <div>
                                    <h5 className="font-semibold text-gray-900 mb-2">Lessons ({outline.lessons.length})</h5>
                                    <div className="space-y-2">
                                      {outline.lessons.map((lesson, idx) => (
                                        <div key={idx} className="bg-white p-3 rounded border">
                                          <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                              <p className="font-medium text-gray-900">
                                                {idx + 1}. {lesson.title}
                                              </p>
                                              {lesson.description && (
                                                <p className="text-sm text-gray-600 mt-1">{lesson.description}</p>
                                              )}
                                            </div>
                                            {lesson.duration && (
                                              <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                                                {lesson.duration}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          } catch (e) {
                            return (
                              <pre className="whitespace-pre-wrap text-sm text-gray-700">
                                {courseOutline}
                              </pre>
                            );
                          }
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Lesson Content Tab */}
              {activeTab === 'lesson' && (
                <div className="space-y-4">
                  <form onSubmit={handleGenerateLessonContent} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Lesson Title *
                      </label>
                      <input
                        type="text"
                        value={lessonTitle}
                        onChange={(e) => setLessonTitle(e.target.value)}
                        placeholder="e.g., Variables and Data Types"
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Additional Context (optional)
                      </label>
                      <textarea
                        value={lessonContext}
                        onChange={(e) => setLessonContext(e.target.value)}
                        placeholder="Provide any additional context or requirements..."
                        rows={3}
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                        disabled={loading}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !lessonTitle.trim()}
                      className="w-full px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Generate Lesson Content
                        </>
                      )}
                    </button>
                  </form>

                  {lessonContent && (
                    <div className="mt-4 p-4 bg-gray-50 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900">Generated Content</h3>
                        {onApplyContent && (
                          <button
                            onClick={() => handleApply(lessonContent, false)}
                            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Apply
                          </button>
                        )}
                      </div>
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 max-h-96 overflow-y-auto font-sans">
                        {lessonContent}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* Quiz Questions Tab */}
              {activeTab === 'quiz' && (
                <div className="space-y-4">
                  <form onSubmit={handleGenerateQuizQuestions} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quiz Topic *
                      </label>
                      <input
                        type="text"
                        value={quizTopic}
                        onChange={(e) => setQuizTopic(e.target.value)}
                        placeholder="e.g., Fire safety basics, GDPR compliance"
                        className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                        disabled={loading}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Number of Questions
                        </label>
                        <input
                          type="number"
                          value={questionCount}
                          onChange={(e) => setQuestionCount(parseInt(e.target.value) || 5)}
                          min="1"
                          max="20"
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                          disabled={loading}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Difficulty
                        </label>
                        <select
                          value={difficulty}
                          onChange={(e) => setDifficulty(e.target.value)}
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                          disabled={loading}
                        >
                          <option value="Easy">Easy</option>
                          <option value="Medium">Medium</option>
                          <option value="Hard">Hard</option>
                        </select>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading || !quizTopic.trim()}
                      className="w-full px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Generate Quiz Questions
                        </>
                      )}
                    </button>
                  </form>

                  {quizQuestions && (
                    <div className="mt-4 p-4 bg-gray-50 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-gray-900">Generated Questions</h3>
                        {onApplyContent && (
                          <button
                            onClick={() => handleApply(quizQuestions)}
                            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Apply
                          </button>
                        )}
                      </div>
                      <pre className="whitespace-pre-wrap text-sm text-gray-700 max-h-96 overflow-y-auto">
                        {quizQuestions}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
              </div>
            </div>
          ) : (
            /* Slide-in Panel */
            <div className="fixed inset-y-0 right-0 w-full md:w-2/5 bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  <h2 className="text-xl font-semibold">AI Assistant</h2>
                </div>
                <button
                  onClick={handleClose}
                  className="hover:bg-white/20 p-2 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs - only show if not quiz-only mode */}
              {defaultTab !== 'quiz' && defaultTab !== 'course' && (
                <div className="flex border-b bg-gray-50">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                      activeTab === 'chat'
                        ? 'border-b-2 border-purple-600 text-purple-600 bg-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" />
                    Chat
                  </button>
                  <button
                    onClick={() => setActiveTab('course')}
                    className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                      activeTab === 'course'
                        ? 'border-b-2 border-purple-600 text-purple-600 bg-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Course Outline
                  </button>
                  <button
                    onClick={() => setActiveTab('lesson')}
                    className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                      activeTab === 'lesson'
                        ? 'border-b-2 border-purple-600 text-purple-600 bg-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Wand2 className="w-4 h-4" />
                    Lesson Content
                  </button>
                  <button
                    onClick={() => setActiveTab('quiz')}
                    className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                      activeTab === 'quiz'
                        ? 'border-b-2 border-purple-600 text-purple-600 bg-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <HelpCircle className="w-4 h-4" />
                    Quiz Questions
                  </button>
                </div>
              )}
              
              {/* Tabs for course mode - show only course and lesson */}
              {defaultTab === 'course' && (
                <div className="flex border-b bg-gray-50">
                  <button
                    onClick={() => setActiveTab('course')}
                    className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                      activeTab === 'course'
                        ? 'border-b-2 border-purple-600 text-purple-600 bg-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    Course Outline
                  </button>
                  <button
                    onClick={() => setActiveTab('lesson')}
                    className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
                      activeTab === 'lesson'
                        ? 'border-b-2 border-purple-600 text-purple-600 bg-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Wand2 className="w-4 h-4" />
                    Lesson Content
                  </button>
                </div>
              )}

              {/* Content - Reuse the same content div */}
              <div className="flex-1 overflow-y-auto p-6">
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                    {error}
                  </div>
                )}

                {/* All tab content goes here - same as modal */}
                {activeTab === 'chat' && (
                  <div className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                      {chatMessages.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                          <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>Ask me anything about creating courses, lessons, or quizzes!</p>
                        </div>
                      ) : (
                        chatMessages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] p-3 rounded-lg ${
                                msg.role === 'user'
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-gray-100 text-gray-900'
                              }`}
                            >
                              {msg.content}
                            </div>
                          </div>
                        ))
                      )}
                      {loading && (
                        <div className="flex justify-start">
                          <div className="bg-gray-100 p-3 rounded-lg">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <form onSubmit={handleChat} className="flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                        disabled={loading}
                      />
                      <button
                        type="submit"
                        disabled={loading || !chatInput.trim()}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Send
                      </button>
                    </form>
                  </div>
                )}

                {/* Course Outline Tab */}
                {activeTab === 'course' && (
                  <div className="space-y-4">
                    <form onSubmit={handleGenerateCourseOutline} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Course Topic *
                        </label>
                        <input
                          type="text"
                          value={courseTopic}
                          onChange={(e) => setCourseTopic(e.target.value)}
                          placeholder="e.g., Fire Safety Training"
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                          disabled={loading}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Level (optional)
                          </label>
                          <select
                            value={courseLevel}
                            onChange={(e) => setCourseLevel(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                            disabled={loading}
                          >
                            <option value="">Select level</option>
                            <option value="Beginner">Beginner</option>
                            <option value="Intermediate">Intermediate</option>
                            <option value="Advanced">Advanced</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Duration (optional)
                          </label>
                          <input
                            type="text"
                            value={courseDuration}
                            onChange={(e) => setCourseDuration(e.target.value)}
                            placeholder="e.g., 4 weeks"
                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                            disabled={loading}
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={loading || !courseTopic.trim()}
                        className="w-full px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Generate Course Outline
                          </>
                        )}
                      </button>
                    </form>

                    {courseOutline && (
                      <div className="mt-4 p-4 bg-gray-50 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium text-gray-900">Generated Outline</h3>
                          {onApplyContent && (
                            <button
                              onClick={() => handleApply(courseOutline)}
                              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Apply to Course
                            </button>
                          )}
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                          {(() => {
                            try {
                              let cleanContent = courseOutline.trim();
                              if (cleanContent.startsWith('```')) {
                                cleanContent = cleanContent.replace(/^```json\n/, '').replace(/^```\n/, '').replace(/\n```$/, '');
                              }
                              const outline = JSON.parse(cleanContent);
                              return (
                                <div className="space-y-4">
                                  <div>
                                    <h4 className="font-semibold text-lg text-gray-900">{outline.title}</h4>
                                    {outline.shortDescription && (
                                      <p className="text-sm text-gray-600 mt-1">{outline.shortDescription}</p>
                                    )}
                                    {outline.longDescription && (
                                      <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{outline.longDescription}</p>
                                    )}
                                  </div>
                                  
                                  {outline.lessons && outline.lessons.length > 0 && (
                                    <div>
                                      <h5 className="font-semibold text-gray-900 mb-2">Lessons ({outline.lessons.length})</h5>
                                      <div className="space-y-2">
                                        {outline.lessons.map((lesson, idx) => (
                                          <div key={idx} className="bg-white p-3 rounded border">
                                            <div className="flex items-start justify-between">
                                              <div className="flex-1">
                                                <p className="font-medium text-gray-900">
                                                  {idx + 1}. {lesson.title}
                                                </p>
                                                {lesson.description && (
                                                  <p className="text-sm text-gray-600 mt-1">{lesson.description}</p>
                                                )}
                                              </div>
                                              {lesson.duration && (
                                                <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                                                  {lesson.duration}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            } catch (e) {
                              return (
                                <pre className="whitespace-pre-wrap text-sm text-gray-700">
                                  {courseOutline}
                                </pre>
                              );
                            }
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Lesson Content Tab */}
                {activeTab === 'lesson' && (
                  <div className="space-y-4">
                    <form onSubmit={handleGenerateLessonContent} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Lesson Title *
                        </label>
                        <input
                          type="text"
                          value={lessonTitle}
                          onChange={(e) => setLessonTitle(e.target.value)}
                          placeholder="e.g., Variables and Data Types"
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                          disabled={loading}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Additional Context (optional)
                        </label>
                        <textarea
                          value={lessonContext}
                          onChange={(e) => setLessonContext(e.target.value)}
                          placeholder="Provide any additional context or requirements..."
                          rows={3}
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                          disabled={loading}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading || !lessonTitle.trim()}
                        className="w-full px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Generate Lesson Content
                          </>
                        )}
                      </button>
                    </form>

                    {lessonContent && (
                      <div className="mt-4 p-4 bg-gray-50 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium text-gray-900">Generated Content</h3>
                          {onApplyContent && (
                            <button
                              onClick={() => handleApply(lessonContent, false)}
                              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Copy to Clipboard
                            </button>
                          )}
                        </div>
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 max-h-96 overflow-y-auto font-sans">
                          {lessonContent}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* Quiz Questions Tab */}
                {activeTab === 'quiz' && (
                  <div className="space-y-4">
                    <form onSubmit={handleGenerateQuizQuestions} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Quiz Topic *
                        </label>
                        <input
                          type="text"
                          value={quizTopic}
                          onChange={(e) => setQuizTopic(e.target.value)}
                        placeholder="e.g., Fire safety basics, GDPR compliance"
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                          disabled={loading}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Number of Questions
                          </label>
                          <input
                            type="number"
                            value={questionCount}
                            onChange={(e) => setQuestionCount(parseInt(e.target.value) || 5)}
                            min="1"
                            max="20"
                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                            disabled={loading}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Difficulty
                          </label>
                          <select
                            value={difficulty}
                            onChange={(e) => setDifficulty(e.target.value)}
                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                            disabled={loading}
                          >
                            <option value="Easy">Easy</option>
                            <option value="Medium">Medium</option>
                            <option value="Hard">Hard</option>
                          </select>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={loading || !quizTopic.trim()}
                        className="w-full px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            Generate Quiz Questions
                          </>
                        )}
                      </button>
                    </form>

                    {quizQuestions && (
                      <div className="mt-4 p-4 bg-gray-50 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium text-gray-900">Generated Questions</h3>
                          {onApplyContent && (
                            <button
                              onClick={() => handleApply(quizQuestions)}
                              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Apply
                            </button>
                          )}
                        </div>
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 max-h-96 overflow-y-auto">
                          {quizQuestions}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
};

export default AIAssistant;
