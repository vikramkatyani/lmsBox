import React, { useState, useRef, useEffect } from 'react';
import { learnerAIService } from '../services/learnerAI';
import toast from 'react-hot-toast';

// Helper function to strip HTML tags and get plain text
const stripHtml = (html) => {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

export default function LearnerAIAssistant({ courseTitle, currentLessonTitle = null, currentLessonContent = null, isOpen, onClose }) {
  const [question, setQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!question.trim()) {
      toast.error('Please enter a question');
      return;
    }

    const userMessage = {
      type: 'user',
      content: question,
      timestamp: new Date()
    };

    setChatHistory(prev => [...prev, userMessage]);
    setQuestion('');
    setIsLoading(true);

    try {
      // Strip HTML tags from lesson content to get plain text
      const plainTextContent = currentLessonContent ? stripHtml(currentLessonContent) : null;
      
      // Log for debugging
      console.log('Sending to AI:', {
        question,
        courseTitle,
        currentLessonTitle,
        contentLength: plainTextContent?.length || 0,
        contentPreview: plainTextContent?.substring(0, 100)
      });
      
      const response = await learnerAIService.askQuestion(
        question,
        courseTitle,
        currentLessonTitle,
        plainTextContent // Pass the plain text lesson content
      );

      const aiMessage = {
        type: 'ai',
        content: response.response,
        timestamp: new Date()
      };

      setChatHistory(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      // Check if it's a 503 error (service unavailable)
      if (error.response?.status === 503) {
        toast.error('AI Assistant is currently unavailable. Please try again later.');
      } else {
        toast.error('Failed to get response. Please try again.');
      }
      
      // Remove the user message if request failed
      setChatHistory(prev => prev.slice(0, -1));
      setQuestion(userMessage.content); // Restore the question
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setChatHistory([]);
    setQuestion('');
  };

  const suggestedQuestions = [
    "Can you explain the key concepts from this lesson?",
    "What are the main points I should focus on?",
    "Can you provide an example based on this lesson content?",
    "How does this lesson relate to the overall course?"
  ];

  const handleSuggestedQuestion = (suggested) => {
    setQuestion(suggested);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - Semi-transparent to show content behind */}
      <div 
        className="fixed inset-0 bg-opacity-30 z-40 transition-opacity backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Slide-in Panel */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-96 md:w-28rem bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-blue-50">
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">AI Assistant</h3>
              <p className="text-xs text-gray-600 truncate max-w-[200px]">
                {currentLessonTitle || courseTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Chat History */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
          {chatHistory.length === 0 ? (
            <div className="text-center py-6">
              <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Ask about course content</h4>
              <p className="text-xs text-gray-600 mb-4 px-4">
                I'll answer questions about your lessons.
              </p>
              
              {/* Suggested Questions */}
              <div className="px-2">
                <p className="text-xs text-gray-500 mb-2 text-left">Try asking:</p>
                <div className="space-y-2">
                  {suggestedQuestions.map((suggested, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestedQuestion(suggested)}
                      className="w-full text-left px-3 py-2 bg-white hover:bg-blue-50 rounded-lg text-xs text-gray-700 transition-colors border border-gray-200"
                    >
                      {suggested}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {chatHistory.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 ${
                      message.type === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-900 border border-gray-200'
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      {message.type === 'ai' && (
                        <svg className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      )}
                      <div className="flex-1">
                        <div className="text-xs leading-relaxed" 
                             style={{ color: message.type === 'user' ? 'white' : 'inherit' }}
                             dangerouslySetInnerHTML={{ 
                               __html: message.content.replace(/\n/g, '<br/>') 
                             }} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </>
          )}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                <div className="flex items-center space-x-2">
                  <svg className="w-4 h-4 text-blue-600 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Form */}
        <div className="p-3 border-t border-gray-200 bg-white">
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex space-x-2">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask about this course..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                rows="2"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !question.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            
            {chatHistory.length > 0 && (
              <button
                type="button"
                onClick={handleClearChat}
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                Clear conversation
              </button>
            )}
          </form>
          
          <div className="mt-2 space-y-1">
            <p className="text-xs text-gray-500">
              💡 I can only answer questions about this course content.
            </p>
            <p className="text-xs text-gray-400 italic">
              ⚠️ AI can make mistakes. Please verify important information.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
