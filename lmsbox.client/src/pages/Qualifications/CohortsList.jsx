import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarIcon, CheckCircleIcon, ClockIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

/**
 * CohortsList - Displays available cohorts for the learner
 * Shows cohort name, description, start/end dates, and status
 */
export default function CohortsList() {
  const navigate = useNavigate();
  const [cohorts, setCohorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, active, upcoming, completed

  // Mock data for development
  const mockCohorts = [
    {
      id: 'cohort-001',
      name: 'Leadership & Management',
      description: 'Develop essential skills to inspire teams, drive strategic decisions, and lead with confidence in dynamic organizational environments.',
      startDate: new Date(2026, 0, 20), // Jan 20, 2026
      endDate: new Date(2026, 2, 20), // Mar 20, 2026
      status: 'active',
      enrolledLearners: 24,
      submitted: 0,
    },
    {
      id: 'cohort-002',
      name: 'Management & Business',
      description: 'Gain practical knowledge and strategic insights to manage organizations effectively and drive sustainable business success.',
      startDate: new Date(2026, 1, 1), // Feb 1, 2026
      endDate: new Date(2026, 3, 1), // Apr 1, 2026
      status: 'upcoming',
      enrolledLearners: 18,
      submitted: 0,
    },
    {
      id: 'cohort-003',
      name: 'ILM coaching and mentoring',
      description: 'Enhance your ability to guide, support, and empower others through effective coaching and mentoring practices.',
      startDate: new Date(2025, 8, 15), // Sep 15, 2025
      endDate: new Date(2025, 11, 15), // Dec 15, 2025
      status: 'completed',
      enrolledLearners: 32,
      submitted: 28,
    },
    {
      id: 'cohort-004',
      name: 'Learn six sigma',
      description: 'Master the principles and methodologies of Six Sigma to improve business processes and quality management.',
      startDate: new Date(2026, 0, 27), // Jan 27, 2026
      endDate: new Date(2026, 3, 27), // Apr 27, 2026
      status: 'active',
      enrolledLearners: 15,
      submitted: 3,
    },
  ];

  useEffect(() => {
    // Simulate API call
    const fetchCohorts = async () => {
      try {
        setLoading(true);
        // TODO: Replace with actual API call
        // const response = await api.get('/api/learner/cohorts');
        // setCohorts(response.data);
        
        // Mock delay
        await new Promise(resolve => setTimeout(resolve, 800));
        setCohorts(mockCohorts);
      } catch (error) {
        console.error('Error fetching cohorts:', error);
        toast.error('Failed to load cohorts');
      } finally {
        setLoading(false);
      }
    };

    fetchCohorts();
  }, []);

  const getFilteredCohorts = () => {
    if (filter === 'all') return cohorts;
    return cohorts.filter(c => c.status === filter);
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        icon: CheckCircleIcon,
        label: 'Active',
      },
      upcoming: {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        icon: ClockIcon,
        label: 'Upcoming',
      },
      completed: {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        icon: CheckCircleIcon,
        label: 'Completed',
      },
    };

    const badge = badges[status] || badges.upcoming;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
        <Icon className="w-4 h-4" />
        {badge.label}
      </span>
    );
  };

  const handleViewCohort = (cohort) => {
    if (cohort.status === 'active') {
      navigate(`/qualifications/cohorts/${cohort.id}`, { state: { cohort } });
    } else {
      toast.error('You can only submit to active cohorts');
    }
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const filteredCohorts = getFilteredCohorts();

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Accredited Qualifications</h1>
          <p className="mt-2 text-gray-600">View and submit qualifications for available cohorts</p>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {['all', 'active', 'upcoming', 'completed'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:border-indigo-400'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Cohorts Grid */}
        {filteredCohorts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">No cohorts found in this category</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
            {filteredCohorts.map((cohort) => (
              <div
                key={cohort.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-gray-900">{cohort.name}</h2>
                      <p className="mt-2 text-gray-600 text-sm">{cohort.description}</p>
                    </div>
                    <div className="ml-4">
                      {getStatusBadge(cohort.status)}
                    </div>
                  </div>

                  {/* Dates and Info */}
                  <div className="grid grid-cols-3 gap-4 my-4 py-4 border-t border-b border-gray-200">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase">Start Date</p>
                      <p className="mt-1 text-sm text-gray-900 flex items-center gap-1">
                        <CalendarIcon className="w-4 h-4 text-gray-400" />
                        {formatDate(cohort.startDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase">End Date</p>
                      <p className="mt-1 text-sm text-gray-900 flex items-center gap-1">
                        <CalendarIcon className="w-4 h-4 text-gray-400" />
                        {formatDate(cohort.endDate)}
                      </p>
                    </div>
                    {/* <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase">Submissions</p>
                      <p className="mt-1 text-sm text-gray-900">
                        {cohort.submitted}/{cohort.enrolledLearners}
                      </p>
                    </div> */}
                  </div>

                  {/* Action Button */}
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => handleViewCohort(cohort)}
                      disabled={cohort.status !== 'active'}
                      className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                        cohort.status === 'active'
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {cohort.status === 'active' ? 'Submit Evidence' : 'View Details'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
