import React, { useState, useRef, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
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
        <div className="flex items-center justify-between p-4 border-b bg-boxlms-navbar text-boxlms-navbar-txt">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <div>
              <h2 className="text-xl font-semibold">AI Assistant</h2>
              <p className="text-sm text-white/80 truncate max-w-[200px]">
                {currentLessonTitle || courseTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-white/20 p-2 rounded-lg transition-colors"
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
              <Sparkles className="w-12 h-12 mx-auto mb-3 text-boxlms-navbar-active" />
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
                      className="w-full text-left px-3 py-2 bg-white hover:bg-boxlms-primary-btn/10 rounded-lg text-xs text-gray-700 transition-colors border border-gray-200"
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
                        ? 'bg-boxlms-primary-btn text-boxlms-primary-btn-txt'
                        : 'bg-white text-gray-900 border border-gray-200'
                    }`}
                  >
                    <div className="flex items-start space-x-2">
                      {message.type === 'ai' && (
                        <Sparkles className="w-4 h-4 text-boxlms-navbar-active mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1">
                        <div className="text-xs leading-relaxed" 
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
                  <Sparkles className="w-4 h-4 text-boxlms-navbar-active animate-pulse" />
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
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-boxlms-primary-btn resize-none text-sm"
                rows="2"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !question.trim()}
                className="px-4 py-2 bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded-lg hover:brightness-90 focus:outline-none focus:ring-2 focus:ring-boxlms-primary-btn disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
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
