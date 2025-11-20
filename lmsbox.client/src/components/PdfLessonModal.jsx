import { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  DocumentTextIcon, 
  CloudArrowUpIcon, 
  FolderIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import lessonsService from '../services/lessons';

export default function PdfLessonModal({ isOpen, onClose, courseId, lesson, onSave }) {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    ordinal: 1,
    type: 'document',
    documentUrl: '',
    isOptional: false,
  });

  const [pdfSource, setPdfSource] = useState('upload'); // 'upload', 'library'
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [libraryPdfs, setLibraryPdfs] = useState([]);
  const [selectedLibraryPdf, setSelectedLibraryPdf] = useState(null);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [showSourceSelector, setShowSourceSelector] = useState(false);

  // Fetch fresh lesson data with SAS token when editing
  useEffect(() => {
    const fetchLessonWithToken = async () => {
      if (lesson && lesson.id && courseId) {
        try {
          const freshLesson = await lessonsService.getLesson(courseId, lesson.id);
          setPreviewUrl(freshLesson.documentUrl || '');
        } catch (error) {
          console.error('Error fetching lesson with token:', error);
          setPreviewUrl(lesson.documentUrl || '');
        }
      }
    };

    fetchLessonWithToken();
  }, [lesson, courseId]);

  useEffect(() => {
    if (lesson) {
      setFormData({
        title: lesson.title || '',
        content: lesson.content || '',
        ordinal: lesson.ordinal || 1,
        type: 'document',
        documentUrl: lesson.documentUrl || '',
        isOptional: lesson.isOptional || false,
      });
      
      // Don't show source selector if editing existing document
      setShowSourceSelector(!lesson.documentUrl);
    } else {
      // New lesson - show source selector
      setShowSourceSelector(true);
    }
  }, [lesson]);

  useEffect(() => {
    if (isOpen && pdfSource === 'library') {
      loadLibraryPdfs();
    }
  }, [isOpen, pdfSource, courseId]);

  const loadLibraryPdfs = async () => {
    setIsLoadingLibrary(true);
    try {
      const pdfs = await lessonsService.listSharedLibraryPdfs(courseId);
      setLibraryPdfs(pdfs);
    } catch (error) {
      console.error('Error loading library PDFs:', error);
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePdfSourceChange = (source) => {
    setPdfSource(source);
    setUploadError(null);
    setUploadProgress(0);
    setSelectedLibraryPdf(null);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/pdf') {
      setUploadError('Invalid file format. Please upload PDF files only.');
      return;
    }

    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      setUploadError('File size exceeds 100MB limit.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    try {
      const response = await lessonsService.uploadPdf(
        courseId,
        file,
        (progress) => setUploadProgress(progress)
      );

      setFormData(prev => ({
        ...prev,
        documentUrl: response.documentUrl
      }));

    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error.response?.data?.message || 'Failed to upload PDF. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleLibraryPdfSelect = (pdf) => {
    setSelectedLibraryPdf(pdf);
    setFormData(prev => ({
      ...prev,
      documentUrl: pdf.url
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('Please enter a lesson title');
      return;
    }

    if (!formData.documentUrl) {
      alert('Please provide a PDF document');
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
      type: 'document',
      documentUrl: '',
      isOptional: false,
    });
    setPdfSource('upload');
    setUploadProgress(0);
    setIsUploading(false);
    setUploadError(null);
    setLibraryPdfs([]);
    setSelectedLibraryPdf(null);
    onClose();
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
          <div className="bg-purple-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center">
              <DocumentTextIcon className="h-6 w-6 text-white mr-2" />
              <h3 className="text-lg font-semibold text-white">
                {lesson ? 'Edit PDF Lesson' : 'Create PDF Lesson'}
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Add a description or instructions for this PDF lesson"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isOptional"
                    checked={formData.isOptional}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700">
                    This lesson is optional
                  </label>
                </div>
              </div>

              {/* PDF Source Selection */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PDF Source *
                </label>

                {/* Show existing PDF with preview and change option */}
                {formData.documentUrl && !showSourceSelector && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                    <div className="flex items-center justify-center text-green-600 mb-3">
                      <CheckCircleIcon className="h-6 w-6 mr-2" />
                      <span className="text-sm font-medium">PDF added to lesson</span>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">Current PDF:</p>
                          <p className="text-xs text-gray-600 mt-1 break-all">
                            {formData.documentUrl.split('?')[0].split('/').pop()}
                          </p>
                        </div>
                        <a 
                          href={previewUrl || formData.documentUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="ml-3 inline-flex items-center px-3 py-1.5 text-sm font-medium text-purple-600 bg-white border border-purple-300 rounded-md hover:bg-purple-50 transition shrink-0"
                        >
                          <DocumentTextIcon className="h-4 w-4 mr-1" />
                          Preview
                        </a>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSourceSelector(true)}
                      className="mt-3 text-sm text-purple-600 hover:text-purple-800 font-medium"
                    >
                      Change PDF
                    </button>
                  </div>
                )}

                {/* Show source selector for new lessons or when changing */}
                {showSourceSelector && (
                  <>
                    <p className="text-xs text-gray-500 mb-3">Select how you want to add the PDF to this lesson</p>

                    {/* Source cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <button
                    type="button"
                    onClick={() => handlePdfSourceChange('upload')}
                    className={`p-4 rounded-lg border-2 text-left transition ${
                      pdfSource === 'upload'
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start">
                      <CloudArrowUpIcon className={`h-6 w-6 mr-3 shrink-0 ${
                        pdfSource === 'upload' ? 'text-purple-600' : 'text-gray-400'
                      }`} />
                      <div className="flex-1">
                        <div className={`font-medium ${
                          pdfSource === 'upload' ? 'text-purple-900' : 'text-gray-900'
                        }`}>
                          Upload New File
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Upload a PDF from your computer
                        </div>
                      </div>
                      {pdfSource === 'upload' && (
                        <CheckCircleIcon className="h-5 w-5 text-purple-600 ml-2 shrink-0" />
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePdfSourceChange('library')}
                    className={`p-4 rounded-lg border-2 text-left transition ${
                      pdfSource === 'library'
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start">
                      <FolderIcon className={`h-6 w-6 mr-3 shrink-0 ${
                        pdfSource === 'library' ? 'text-purple-600' : 'text-gray-400'
                      }`} />
                      <div className="flex-1">
                        <div className={`font-medium ${
                          pdfSource === 'library' ? 'text-purple-900' : 'text-gray-900'
                        }`}>
                          LMS Library
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Choose from previously uploaded PDFs
                        </div>
                      </div>
                      {pdfSource === 'library' && (
                        <CheckCircleIcon className="h-5 w-5 text-purple-600 ml-2 shrink-0" />
                      )}
                    </div>
                  </button>
                </div>

                {/* Upload File */}
                {pdfSource === 'upload' && (
                  <div>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <DocumentTextIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                      
                      {!formData.documentUrl && !isUploading && (
                        <>
                          <label className="cursor-pointer">
                            <span className="mt-2 block text-sm font-medium text-gray-900">
                              Click to upload or drag and drop
                            </span>
                            <span className="mt-1 block text-xs text-gray-500">
                              PDF files only (Max 100MB)
                            </span>
                            <input
                              type="file"
                              accept="application/pdf"
                              onChange={handleFileUpload}
                              className="hidden"
                            />
                          </label>
                        </>
                      )}

                      {isUploading && (
                        <div className="mt-4">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-purple-600 h-2 rounded-full transition-all"
                              style={{ width: `${uploadProgress}%` }}
                            ></div>
                          </div>
                          <p className="text-sm text-gray-600 mt-2">
                            Uploading... {uploadProgress}%
                          </p>
                        </div>
                      )}

                      {formData.documentUrl && !isUploading && (
                        <div className="flex items-center justify-center text-green-600 mt-4">
                          <CheckCircleIcon className="h-6 w-6 mr-2" />
                          <span className="text-sm font-medium">PDF uploaded successfully</span>
                        </div>
                      )}

                      {uploadError && (
                        <div className="flex items-center justify-center text-red-600 mt-4">
                          <ExclamationCircleIcon className="h-6 w-6 mr-2" />
                          <span className="text-sm">{uploadError}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Library */}
                {pdfSource === 'library' && (
                  <div>
                    {isLoadingLibrary ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                        <p className="text-sm text-gray-600 mt-2">Loading library...</p>
                      </div>
                    ) : libraryPdfs.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <FolderIcon className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                        <p className="text-sm">No PDFs in the LMS shared library yet.</p>
                        <p className="text-xs mt-1">Contact your administrator to add PDFs to the shared library.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                        {libraryPdfs.map((pdf, index) => (
                          <div
                            key={index}
                            onClick={() => handleLibraryPdfSelect(pdf)}
                            className={`border rounded-lg p-3 cursor-pointer transition ${
                              selectedLibraryPdf?.url === pdf.url
                                ? 'border-purple-600 bg-purple-50'
                                : 'border-gray-200 hover:border-purple-300'
                            }`}
                          >
                            <div className="flex items-start">
                              <DocumentTextIcon className="h-5 w-5 text-gray-400 mr-2 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {pdf.name}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {formatFileSize(pdf.size)}
                                </p>
                                {pdf.lastModified && (
                                  <p className="text-xs text-gray-400 mt-0.5">
                                    {new Date(pdf.lastModified).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                disabled={isSaving || isUploading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
                disabled={isSaving || isUploading || !formData.documentUrl}
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
