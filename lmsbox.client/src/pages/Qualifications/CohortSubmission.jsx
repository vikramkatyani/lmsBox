import { useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, DocumentIcon, CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

/**
 * CohortSubmission - Page for submitting qualification documents for a cohort
 * Allows learner to:
 * 1. Upload a Word document
 * 2. Check for plagiarism
 * 3. Review results
 * 4. Confirm final submission
 */
export default function CohortSubmission() {
  const { cohortId } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();

  // Mock cohorts data matching CohortsList.jsx
  const mockCohorts = {
    'cohort-001': {
      id: 'cohort-001',
      name: 'Leadership & Management',
      description: 'Develop essential skills to inspire teams, drive strategic decisions, and lead with confidence in dynamic organizational environments.',
      startDate: new Date(2026, 0, 20),
      endDate: new Date(2026, 2, 20),
      status: 'active',
    },
    'cohort-002': {
      id: 'cohort-002',
      name: 'Management & Business',
      description: 'Gain practical knowledge and strategic insights to manage organizations effectively and drive sustainable business success.',
      startDate: new Date(2026, 1, 1),
      endDate: new Date(2026, 3, 1),
      status: 'upcoming',
    },
    'cohort-003': {
      id: 'cohort-003',
      name: 'ILM coaching and mentoring',
      description: 'Enhance your ability to guide, support, and empower others through effective coaching and mentoring practices.',
      startDate: new Date(2025, 8, 15),
      endDate: new Date(2025, 11, 15),
      status: 'completed',
    },
    'cohort-004': {
      id: 'cohort-004',
      name: 'Learn six sigma',
      description: 'Master the principles and methodologies of Six Sigma to improve business processes and quality management.',
      startDate: new Date(2026, 0, 27),
      endDate: new Date(2026, 3, 27),
      status: 'active',
    },
  };

  const cohort = state?.cohort || mockCohorts[cohortId] || {
    id: cohortId,
    name: 'Unknown Cohort',
    startDate: new Date(),
    description: 'Cohort not found',
  };

  // State management
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [plagiarismResult, setPlagiarismResult] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [stage, setStage] = useState('upload'); // upload, reviewing, results, submitted

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const validTypes = [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (!validTypes.includes(selectedFile.type)) {
      toast.error('Please select a valid Word document (.doc or .docx)');
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setFile(selectedFile);
    setFilePreview(`${selectedFile.name} (${(selectedFile.size / 1024).toFixed(2)} KB)`);
    setStage('upload');
  };

  const handleCheckPlagiarism = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    try {
      setIsChecking(true);
      setStage('reviewing');

      // TODO: Replace with actual API call
      // const formData = new FormData();
      // formData.append('file', file);
      // const response = await api.post(`/api/qualifications/cohorts/${cohortId}/check-plagiarism`, formData);
      // setPlagiarismResult(response.data);

      // Mock API delay
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Mock plagiarism result
      const mockResult = {
        documentId: 'doc-' + Date.now(),
        fileName: file.name,
        submissionTime: new Date(),
        overallScore: 23, // Percentage
        status: 'completed',
        sources: [
          {
            url: 'https://example-article.com/python-guide',
            matchPercentage: 8,
            matchedText: 'Python is a high-level programming language...',
          },
          {
            url: 'https://github.com/sample-repo/code',
            matchPercentage: 10,
            matchedText: 'def process_data(dataset):...',
          },
          {
            url: 'https://documentation.readthedocs.io/en/latest/',
            matchPercentage: 5,
            matchedText: 'The following methods are available...',
          },
        ],
        reportUrl: '/api/qualifications/reports/doc-' + Date.now(),
      };

      setPlagiarismResult(mockResult);
      setStage('results');
      toast.success('Plagiarism check completed');
    } catch (error) {
      console.error('Error checking plagiarism:', error);
      toast.error('Failed to check plagiarism');
      setStage('upload');
    } finally {
      setIsChecking(false);
    }
  };

  const handleDiscard = () => {
    setFile(null);
    setFilePreview(null);
    setPlagiarismResult(null);
    setStage('upload');
    toast.success('Submission discarded');
  };

  const handleFinalSubmit = async () => {
    if (!plagiarismResult) {
      toast.error('Please check plagiarism first');
      return;
    }

    try {
      setIsChecking(true);

      // TODO: Replace with actual API call
      // const response = await api.post(`/api/qualifications/cohorts/${cohortId}/submit`, {
      //   documentId: plagiarismResult.documentId,
      //   fileName: file.name,
      //   plagiarismScore: plagiarismResult.overallScore,
      // });

      // Mock delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      setSubmitted(true);
      setStage('submitted');
      toast.success('Qualification submitted successfully');

      // Redirect after 3 seconds
      setTimeout(() => {
        navigate('/qualifications');
      }, 3000);
    } catch (error) {
      console.error('Error submitting qualification:', error);
      toast.error('Failed to submit qualification');
    } finally {
      setIsChecking(false);
    }
  };

  const getSeverityColor = (score) => {
    if (score <= 10) return 'text-green-600';
    if (score <= 25) return 'text-yellow-600';
    if (score <= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getSeverityBg = (score) => {
    if (score <= 10) return 'bg-green-50 border-green-200';
    if (score <= 25) return 'bg-yellow-50 border-yellow-200';
    if (score <= 50) return 'bg-orange-50 border-orange-200';
    return 'bg-red-50 border-red-200';
  };

  const getSeverityLabel = (score) => {
    if (score <= 10) return 'Excellent';
    if (score <= 25) return 'Good';
    if (score <= 50) return 'Moderate';
    return 'High';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header with back button */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/qualifications')}
            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium mb-4"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Back to Qualifications
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Submit Qualification</h1>
        </div>

        {/* Cohort Info Card */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{cohort.name}</h2>
          <p className="text-gray-600 mb-4">{cohort.description}</p>
          <div className="flex items-center gap-2 text-gray-700">
            <span className="font-medium">Start Date:</span>
            <span>{formatDate(cohort.startDate)}</span>
          </div>
        </div>

        {/* Success Message - Submission Complete */}
        {stage === 'submitted' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-4">
              <CheckCircleIcon className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-green-900">Submission Successful</h3>
                <p className="mt-1 text-green-800">
                  Your qualification has been submitted successfully. You'll be redirected to the qualifications page.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Upload Section */}
        {stage === 'upload' && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload Document</h3>

            {/* File Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Word Document (.doc, .docx)
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-input"
                />
                <label
                  htmlFor="file-input"
                  className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-8 cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
                >
                  <DocumentIcon className="w-12 h-12 text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-700">Click to upload or drag and drop</span>
                  <span className="text-xs text-gray-500 mt-1">Word documents up to 10MB</span>
                </label>
              </div>
            </div>

            {/* File Preview */}
            {filePreview && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                <DocumentIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{filePreview}</p>
                  <button
                    onClick={() => {
                      setFile(null);
                      setFilePreview(null);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 mt-1"
                  >
                    Remove file
                  </button>
                </div>
              </div>
            )}

            {/* Check Plagiarism Button */}
            <button
              onClick={handleCheckPlagiarism}
              disabled={!file || isChecking}
              className={`w-full py-3 rounded-lg font-medium transition-colors ${
                !file || isChecking
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              {isChecking ? 'Checking plagiarism...' : 'Check for Plagiarism'}
            </button>
          </div>
        )}

        {/* Checking Progress */}
        {stage === 'reviewing' && (
          <div className="bg-white rounded-lg shadow p-8 mb-6 text-center">
            <div className="inline-block">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Checking for Plagiarism</h3>
            <p className="text-gray-600 mt-2">Please wait while we analyze your document...</p>
          </div>
        )}

        {/* Results Section */}
        {stage === 'results' && plagiarismResult && (
          <div className="space-y-6">
            {/* Overall Score */}
            <div className={`rounded-lg border-2 p-6 ${getSeverityBg(plagiarismResult.overallScore)}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Plagiarism Check Results</h3>
                  <p className="text-sm text-gray-600 mt-1">Analysis of: {plagiarismResult.fileName}</p>
                </div>
                <div className={`text-3xl font-bold ${getSeverityColor(plagiarismResult.overallScore)}`}>
                  {plagiarismResult.overallScore}%
                </div>
              </div>
              <p className={`text-sm font-medium ${getSeverityColor(plagiarismResult.overallScore)}`}>
                Severity: {getSeverityLabel(plagiarismResult.overallScore)}
              </p>
            </div>

            {/* Plagiarism Details */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Matched Sources</h3>

              {plagiarismResult.sources.length === 0 ? (
                <p className="text-gray-600">No matching sources detected.</p>
              ) : (
                <div className="space-y-4">
                  {plagiarismResult.sources.map((source, idx) => (
                    <div key={idx} className="p-4 border border-gray-200 rounded-lg hover:border-indigo-300">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{source.url}</p>
                          <p className="text-xs text-gray-600 mt-1">
                            Matched Text: "{source.matchedText.substring(0, 60)}..."
                          </p>
                        </div>
                        <div className="ml-4 text-right">
                          <p className="text-sm font-semibold text-orange-600">{source.matchPercentage}%</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <a
                href="#"
                className="mt-4 inline-block text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                View Full Report →
              </a>
            </div>

            {/* Information Message */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium">Important:</p>
                <p className="mt-1">
                  Review the plagiarism results carefully. A high similarity score may indicate significant plagiarism.
                  You can choose to discard this submission and upload a revised document.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={handleDiscard}
                disabled={isChecking}
                className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                  isChecking
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                }`}
              >
                Discard & Upload New
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={isChecking}
                className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                  isChecking
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isChecking ? 'Submitting...' : 'Confirm & Submit'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
