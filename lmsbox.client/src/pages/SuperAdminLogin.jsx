import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import usePageTitle from '../hooks/usePageTitle';
import { superAdminLogin } from '../services/superAdminApi';
import { setAuthToken } from '../utils/auth';
import {
  ShieldCheckIcon,
  EnvelopeIcon,
  LockClosedIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import lmsboxLogo from '../assets/lmsbox-logo.png';

export default function SuperAdminLogin() {
  usePageTitle('Super Admin Login');
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await superAdminLogin(formData.email, formData.password);

      // Store token using the auth utility (sets expiration automatically)
      setAuthToken(data.token);
      
      // Store user info
      localStorage.setItem('user', JSON.stringify({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role
      }));

      // Navigate to super admin dashboard
      navigate('/superadmin/dashboard');
    } catch (err) {
      setError(err.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#1b365d' }}>
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Header */}
        <div className="text-center">
          <div className="flex justify-center">
            <div className="p-6">
              <img src={lmsboxLogo} alt="LMS Box" className="h-16 w-auto mx-auto" />
            </div>
          </div>
          <h2 className="mt-6 text-4xl font-extrabold" style={{ fontFamily: 'Albert Sans, sans-serif', fontWeight: 800, letterSpacing: '-0.04em', color: '#FFFFFF' }}>
            Super Admin Portal
          </h2>
          <p className="mt-2 text-sm" style={{ fontFamily: 'Inter, sans-serif', color: '#E5E7EB', letterSpacing: '-0.02em' }}>
            Multi-Tenancy Management System
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
                <ExclamationCircleIcon className="h-5 w-5 text-red-600 mr-2 shrink-0 mt-0.5" />
                <span className="text-sm text-red-800">{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ fontFamily: 'Inter, sans-serif', color: '#36454F', letterSpacing: '-0.02em' }}>
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}
                  onFocus={(e) => e.target.style.borderColor = '#2afeae'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  placeholder="superadmin@lmsbox.system"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ fontFamily: 'Inter, sans-serif', color: '#36454F', letterSpacing: '-0.02em' }}>
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LockClosedIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
                  style={{ fontFamily: 'Inter, sans-serif', letterSpacing: '-0.02em' }}
                  onFocus={(e) => e.target.style.borderColor = '#2afeae'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ 
                backgroundColor: loading ? '#2afeae' : '#2afeae',
                color: '#1b365d',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 600,
                letterSpacing: '-0.02em'
              }}
              onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#25e89e')}
              onMouseLeave={(e) => !loading && (e.target.style.backgroundColor = '#2afeae')}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5" style={{ color: '#1b365d' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Authenticating...
                </>
              ) : (
                'Sign in to Super Admin'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-center text-gray-500">
              This portal is for authorized Super Administrators only.
              <br />
              All actions are logged and monitored.
            </p>
          </div>
        </div>

        {/* Regular Login Link */}
        <div className="text-center">
          <a
            href="/"
            className="text-sm font-medium text-indigo-200 hover:text-white transition-colors"
          >
            ← Back to regular login
          </a>
        </div>
      </div>
    </div>
  );
}
