import { useState, useEffect, useRef } from 'react';
import { PencilIcon, EyeIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon } from '@heroicons/react/24/outline';

const HtmlLessonEditor = ({ initialContent = '', onContentChange, onUrlChange }) => {
  const [htmlContent, setHtmlContent] = useState(initialContent);
  const [isPreview, setIsPreview] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const iframeRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    setHtmlContent(initialContent);
  }, [initialContent]);

  const handleContentChange = (newContent) => {
    setHtmlContent(newContent);
    if (onContentChange) {
      onContentChange(newContent);
    }
  };

  // Update iframe when switching to preview mode
  useEffect(() => {
    if (isPreview && iframeRef.current) {
      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(htmlContent || '<p style="color: #999; text-align: center; padding: 50px;">No content to preview</p>');
      doc.close();
    }
  }, [isPreview, htmlContent]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!isFullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (container.mozRequestFullScreen) {
        container.mozRequestFullScreen();
      } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  };

  const handleUploadToBlob = async () => {
    if (!htmlContent.trim()) {
      alert('Please add HTML content before uploading');
      return;
    }

    setUploading(true);
    try {
      // Call parent component's upload handler
      if (onUrlChange) {
        await onUrlChange(htmlContent);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload HTML content');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div ref={containerRef} className="relative border border-gray-300 rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-100 border-b border-gray-300 px-4 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPreview(false)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded ${
              !isPreview ? 'bg-[#2afeae] text-[#1b365d]' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <PencilIcon className="h-4 w-4" />
            <span className="text-sm font-medium">Edit</span>
          </button>
          <button
            type="button"
            onClick={() => setIsPreview(true)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded ${
              isPreview ? 'bg-[#2afeae] text-[#1b365d]' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <EyeIcon className="h-4 w-4" />
            <span className="text-sm font-medium">Preview</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-700"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? (
              <ArrowsPointingInIcon className="h-5 w-5" />
            ) : (
              <ArrowsPointingOutIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="relative" style={{ height: isFullscreen ? 'calc(100vh - 56px)' : '500px' }}>
        {!isPreview ? (
          <textarea
            value={htmlContent}
            onChange={(e) => handleContentChange(e.target.value)}
            placeholder="Paste your HTML content here..."
            className="w-full h-full p-4 font-mono text-sm resize-none focus:outline-none"
            style={{ fontFamily: 'Monaco, Consolas, "Courier New", monospace' }}
          />
        ) : (
          <iframe
            ref={iframeRef}
            title="HTML Preview"
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
          />
        )}
      </div>

      {/* Helper Text */}
      {!isPreview && (
        <div className="bg-gray-50 border-t border-gray-300 px-4 py-2 text-xs text-gray-600">
          <p>
            <strong>Tip:</strong> Paste complete HTML documents or HTML snippets. Use Preview to test your content before saving.
          </p>
        </div>
      )}
    </div>
  );
};

export default HtmlLessonEditor;
