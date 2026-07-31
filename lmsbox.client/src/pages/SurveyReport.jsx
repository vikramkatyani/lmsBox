import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from 'chart.js';
import AdminHeader from '../components/AdminHeader';
import Pagination from '../components/Pagination';
import usePageTitle from '../hooks/usePageTitle';
import {
  getSurveyReportOverview,
  getSurveyReportSummary,
  getSurveyReportAnalytics,
  getSurveyReportResponses,
  exportToCSV
} from '../services/reports';
import { formatAppDateTime } from '../utils/dateFormat';
import toast from 'react-hot-toast';
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  ClipboardDocumentListIcon,
  UserGroupIcon,
  AcademicCapIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const QUESTION_TYPE_LABELS = {
  Rating: 'Rating',
  SingleChoice: 'Single choice',
  MultipleChoice: 'Multiple choice',
  YesNo: 'Yes / No',
  Text: 'Free text'
};

function formatAnswer(answer) {
  if (!answer) return '—';
  if (answer.ratingValue != null) return String(answer.ratingValue);
  if (answer.selectedOptions?.length) return answer.selectedOptions.join(', ');
  if (answer.answerText) return answer.answerText;
  return '—';
}

function DistributionBar({ label, count, percentage, color = 'bg-[#1b365d]' }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1 gap-3">
        <span className="text-gray-800 font-medium truncate">{label}</span>
        <span className="text-gray-500 shrink-0">{count} ({percentage}%)</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
      </div>
    </div>
  );
}

function QuestionAnalysisCard({ question, index, responsesAreAnonymous = false }) {
  const { questionText, questionType, analysis, isRequired } = question;
  if (!analysis) return null;

  const typeLabel = QUESTION_TYPE_LABELS[questionType] || questionType;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b bg-gray-50 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#1b365d]">Question {index + 1}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">{typeLabel}</span>
            {isRequired && <span className="text-xs text-red-600">Required</span>}
          </div>
          <h3 className="text-base font-semibold text-gray-900">{questionText}</h3>
        </div>
        <div className="text-sm text-gray-500 shrink-0">
          {analysis.totalResponses ?? 0} response{(analysis.totalResponses ?? 0) === 1 ? '' : 's'}
        </div>
      </div>

      <div className="p-5">
        {questionType === 'Rating' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Average rating: <span className="font-semibold text-gray-900">{analysis.averageRating}</span>
                {analysis.minRating != null && analysis.maxRating != null && (
                  <span className="text-gray-400"> (scale {analysis.minRating}–{analysis.maxRating})</span>
                )}
              </p>
              {(analysis.distribution || []).map((item) => (
                <DistributionBar key={item.rating} label={`Rating ${item.rating}`} count={item.count} percentage={item.percentage} />
              ))}
            </div>
            {(analysis.distribution || []).length > 0 && (
              <div className="h-52">
                <Bar
                  data={{
                    labels: analysis.distribution.map((d) => String(d.rating)),
                    datasets: [{ label: 'Responses', data: analysis.distribution.map((d) => d.count), backgroundColor: '#1b365d', borderRadius: 4 }]
                  }}
                  options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }}
                />
              </div>
            )}
          </div>
        )}

        {(questionType === 'SingleChoice' || questionType === 'MultipleChoice') && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              {(analysis.optionDistribution || []).map((item, idx) => (
                <DistributionBar
                  key={item.option}
                  label={item.option}
                  count={item.count}
                  percentage={item.percentage}
                  color={['bg-[#1b365d]', 'bg-[#36454F]', 'bg-teal-600', 'bg-indigo-500', 'bg-amber-500', 'bg-rose-500'][idx % 6]}
                />
              ))}
            </div>
            {(analysis.optionDistribution || []).length > 0 && (
              <div className="h-52 max-w-sm mx-auto">
                <Doughnut
                  data={{
                    labels: analysis.optionDistribution.map((d) => d.option),
                    datasets: [{ data: analysis.optionDistribution.map((d) => d.count), backgroundColor: ['#1b365d', '#36454F', '#0d9488', '#6366f1', '#f59e0b', '#ef4444'] }]
                  }}
                  options={{ responsive: true, maintainAspectRatio: false }}
                />
              </div>
            )}
          </div>
        )}

        {questionType === 'YesNo' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-3">
              <DistributionBar label="Yes" count={analysis.yesCount || 0} percentage={analysis.yesPercentage || 0} color="bg-green-600" />
              <DistributionBar label="No" count={analysis.noCount || 0} percentage={analysis.noPercentage || 0} color="bg-red-600" />
            </div>
            <div className="h-44 max-w-xs mx-auto">
              <Doughnut
                data={{
                  labels: ['Yes', 'No'],
                  datasets: [{ data: [analysis.yesCount || 0, analysis.noCount || 0], backgroundColor: ['#16a34a', '#dc2626'] }]
                }}
                options={{ responsive: true, maintainAspectRatio: false }}
              />
            </div>
          </div>
        )}

        {questionType === 'Text' && (
          <div>
            {(analysis.textAnswers || []).length > 0 ? (
              <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {analysis.textAnswers.map((entry, idx) => (
                  <li key={idx} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{entry.text}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {!responsesAreAnonymous && (
                        <>
                          {entry.userName}
                          {entry.userEmail ? ` · ${entry.userEmail}` : ''}
                          {' · '}
                        </>
                      )}
                      {formatAppDateTime(entry.submittedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No text responses for this question yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SurveyReportList() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('courseTitle');
  const [sortDirection, setSortDirection] = useState('asc');

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSurveyReportOverview({
        search: appliedSearch || undefined,
        pageNumber: page,
        pageSize,
        sortBy,
        sortDirection
      });
      setOverview(data);
    } catch (error) {
      console.error('Failed to load survey overview:', error);
      toast.error('Failed to load survey report');
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, page, pageSize, sortBy, sortDirection]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleSearch = () => {
    setAppliedSearch(searchTerm.trim());
    setPage(1);
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDirection('asc');
    }
    setPage(1);
  };

  const summary = overview?.summary;
  const items = overview?.items || [];
  const pagination = overview?.pagination || { pageNumber: 1, pageSize: 25, totalItems: 0, totalPages: 1 };

  const sortIndicator = (column) => {
    if (sortBy !== column) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Linked surveys', value: summary?.linkedSurveys ?? 0, icon: ClipboardDocumentListIcon, color: 'text-[#1b365d]' },
          { label: 'Courses', value: summary?.coursesWithSurveys ?? 0, icon: AcademicCapIcon, color: 'text-indigo-600' },
          { label: 'Total attempts', value: summary?.totalResponses ?? 0, icon: ChartBarIcon, color: 'text-teal-600' },
          { label: 'Unique learners', value: summary?.uniqueRespondents ?? 0, icon: UserGroupIcon, color: 'text-purple-600' },
          { label: 'Pre / Post', value: `${summary?.preCourseSurveys ?? 0} / ${summary?.postCourseSurveys ?? 0}`, icon: ClipboardDocumentListIcon, color: 'text-amber-600' }
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <Icon className={`h-4 w-4 ${card.color}`} />
                {card.label}
              </div>
              <div className="text-2xl font-semibold text-gray-900">{card.value}</div>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b flex flex-wrap gap-3 items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">All course surveys</h2>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search course or survey…"
                className="border border-gray-300 rounded-md pl-3 pr-9 py-2 text-sm w-56"
              />
              <MagnifyingGlassIcon className="h-4 w-4 text-gray-400 absolute right-3 top-2.5" />
            </div>
            <button type="button" onClick={handleSearch} className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50">
              Search
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <button type="button" onClick={() => handleSort('courseTitle')} className="text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-800">
                    Course {sortIndicator('courseTitle')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left">
                  <button type="button" onClick={() => handleSort('surveyType')} className="text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-800">
                    Type {sortIndicator('surveyType')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left">
                  <button type="button" onClick={() => handleSort('surveyTitle')} className="text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-800">
                    Survey {sortIndicator('surveyTitle')}
                  </button>
                </th>
                <th className="px-6 py-3 text-left">
                  <button type="button" onClick={() => handleSort('responseCount')} className="text-xs font-medium text-gray-500 uppercase tracking-wider hover:text-gray-800">
                    Attempts {sortIndicator('responseCount')}
                  </button>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">Loading surveys…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No course surveys found.</td></tr>
              ) : (
                items.map((row) => (
                  <tr key={`${row.courseId}-${row.surveyId}-${row.surveyType}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{row.courseTitle}</div>
                      {row.courseCategory && <div className="text-xs text-gray-500">{row.courseCategory}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-[#1b365d]/10 text-[#1b365d]">
                        {row.typeLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{row.surveyTitle}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.responseCount}</td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/admin/reports/surveys?courseId=${encodeURIComponent(row.courseId)}&surveyId=${row.surveyId}&surveyType=${encodeURIComponent(row.surveyType)}`}
                        className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        <EyeIcon className="h-4 w-4 mr-1" />
                        View details
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={pagination.pageNumber}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          totalCount={pagination.totalItems}
          onPageChange={setPage}
          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
        />
      </div>
    </>
  );
}

function SurveyReportDetail({ courseId, surveyId, surveyType }) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [responses, setResponses] = useState([]);
  const [pagination, setPagination] = useState({ pageNumber: 1, pageSize: 25, totalResponses: 0, totalPages: 1 });
  const [expandedResponseId, setExpandedResponseId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [responseSearch, setResponseSearch] = useState('');
  const [appliedResponseSearch, setAppliedResponseSearch] = useState('');

  const reportParams = useCallback((extra = {}) => ({
    courseId,
    surveyType,
    ...extra
  }), [courseId, surveyType]);

  const loadDetail = useCallback(async (pageNumber = 1, search = appliedResponseSearch) => {
    try {
      setLoading(true);
      const params = reportParams();
      const [summaryData, analyticsData, responsesData] = await Promise.all([
        getSurveyReportSummary(surveyId, params),
        getSurveyReportAnalytics(surveyId, params),
        getSurveyReportResponses(surveyId, {
          ...params,
          pageNumber,
          pageSize: pagination.pageSize,
          search: search || undefined
        })
      ]);
      setSummary(summaryData);
      setAnalytics(analyticsData);
      setResponses(responsesData.responses || []);
      setPagination(responsesData.pagination || pagination);
    } catch (error) {
      console.error('Failed to load survey detail:', error);
      toast.error('Failed to load survey details');
    } finally {
      setLoading(false);
    }
  }, [appliedResponseSearch, pagination.pageSize, reportParams, surveyId]);

  useEffect(() => {
    loadDetail(1, '');
    setAppliedResponseSearch('');
    setResponseSearch('');
    setExpandedResponseId(null);
  }, [courseId, surveyId, surveyType]); // eslint-disable-line react-hooks/exhaustive-deps

  const questionAnalytics = analytics?.questionAnalytics || [];
  const responsesAreAnonymous = Boolean(
    summary?.responsesAreAnonymous ?? analytics?.responsesAreAnonymous
  );

  const handleExportCsv = () => {
    if (!responses.length) return;
    const rows = responses.map((r) => {
      const row = {
        Course: summary?.courseTitle || '',
        Survey: summary?.surveyTitle || '',
        'Survey Type': summary?.surveyTypeLabel || '',
        ...(responsesAreAnonymous
          ? {}
          : {
              User: r.userName,
              Email: r.userEmail || ''
            }),
        'Submitted At': formatAppDateTime(r.submittedAt)
      };
      (r.answers || []).forEach((a, idx) => {
        row[`Q${idx + 1}: ${a.questionText}`] = formatAnswer(a);
      });
      return row;
    });
    exportToCSV(rows, 'survey-report-detail');
  };

  if (loading && !summary) {
    return <div className="text-center py-16 text-gray-500">Loading survey analytics…</div>;
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('/admin/reports/surveys')}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to survey list
        </button>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={!responses.length}
          className="inline-flex items-center px-3 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          <ArrowDownTrayIcon className="h-4 w-4 mr-1.5" />
          Export submissions
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Survey details</p>
            <h2 className="text-xl font-semibold text-gray-900">{summary?.courseTitle}</h2>
            <p className="text-sm text-gray-600 mt-1">
              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-[#1b365d]/10 text-[#1b365d] mr-2">
                {summary?.surveyTypeLabel}
              </span>
              {summary?.surveyTitle}
            </p>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Attempts</div>
              <div className="text-2xl font-semibold text-gray-900">{summary?.summary?.totalResponses ?? 0}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Learners</div>
              <div className="text-2xl font-semibold text-gray-900">{summary?.summary?.uniqueRespondents ?? 0}</div>
            </div>
          </div>
        </div>
      </div>

      {responsesAreAnonymous && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-900">
          Survey responses are anonymous. Learner names and email addresses are not shown in this report.
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Responses by question</h2>
        {questionAnalytics.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">
            No responses recorded for this survey yet.
          </div>
        ) : (
          questionAnalytics.map((q, idx) => (
            <QuestionAnalysisCard
              key={q.questionId}
              question={q}
              index={idx}
              responsesAreAnonymous={responsesAreAnonymous}
            />
          ))
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-lg">
        <div className="px-6 py-4 border-b flex flex-wrap gap-3 items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Individual submissions</h2>
          {!responsesAreAnonymous && (
            <div className="flex gap-2">
              <input
                value={responseSearch}
                onChange={(e) => setResponseSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const term = responseSearch.trim();
                    setAppliedResponseSearch(term);
                    loadDetail(1, term);
                  }
                }}
                placeholder="Search learner name or email"
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const term = responseSearch.trim();
                  setAppliedResponseSearch(term);
                  loadDetail(1, term);
                }}
                className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50"
              >
                Search
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  {responsesAreAnonymous ? 'Submission' : 'Learner'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Answers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">Loading…</td></tr>
              ) : responses.length === 0 ? (
                <tr><td colSpan={3} className="px-6 py-8 text-center text-gray-500">No submissions found.</td></tr>
              ) : (
                responses.map((response) => (
                  <Fragment key={response.responseId}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {responsesAreAnonymous ? 'Anonymous' : response.userName}
                        </div>
                        {!responsesAreAnonymous && response.userEmail && (
                          <div className="text-xs text-gray-500">{response.userEmail}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatAppDateTime(response.submittedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedResponseId(expandedResponseId === response.responseId ? null : response.responseId)}
                          className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-800"
                        >
                          {expandedResponseId === response.responseId ? (
                            <>Hide <ChevronUpIcon className="h-4 w-4 ml-1" /></>
                          ) : (
                            <>View <ChevronDownIcon className="h-4 w-4 ml-1" /></>
                          )}
                        </button>
                      </td>
                    </tr>
                    {expandedResponseId === response.responseId && (
                      <tr>
                        <td colSpan={3} className="px-4 py-3 bg-gray-50">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {(response.answers || []).map((answer, idx) => (
                              <div key={answer.questionId} className="rounded border border-gray-200 bg-white p-3">
                                <p className="text-xs text-gray-500 mb-1">Q{idx + 1}</p>
                                <p className="text-sm font-medium text-gray-900 mb-1">{answer.questionText}</p>
                                <p className="text-sm text-gray-700">{formatAnswer(answer)}</p>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={pagination.pageNumber}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          totalCount={pagination.totalResponses}
          onPageChange={(p) => loadDetail(p, appliedResponseSearch)}
          onPageSizeChange={(size) => {
            setPagination((prev) => ({ ...prev, pageSize: size }));
            getSurveyReportResponses(surveyId, reportParams({
              pageNumber: 1,
              pageSize: size,
              search: appliedResponseSearch || undefined
            })).then((data) => {
              setResponses(data.responses || []);
              setPagination(data.pagination);
            });
          }}
        />
      </section>
    </>
  );
}

export default function SurveyReport() {
  usePageTitle('Survey Report');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const courseId = searchParams.get('courseId') || '';
  const surveyId = searchParams.get('surveyId') || '';
  const surveyType = searchParams.get('surveyType') || '';
  const isDetailView = Boolean(courseId && surveyId && surveyType);

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          {!isDetailView && (
            <button
              type="button"
              onClick={() => navigate('/admin/reports')}
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-3"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Back to Reports
            </button>
          )}
          <h1 className="text-3xl font-bold text-gray-900">Survey Report</h1>
          <p className="mt-1 text-sm text-gray-600">
            {isDetailView
              ? 'Detailed question-level analytics for the selected course survey.'
              : 'Overview of all course-linked surveys. Open any row to analyse learner responses.'}
          </p>
        </div>

        {isDetailView ? (
          <SurveyReportDetail
            courseId={courseId}
            surveyId={Number(surveyId)}
            surveyType={surveyType}
          />
        ) : (
          <SurveyReportList />
        )}
      </div>
    </div>
  );
}
