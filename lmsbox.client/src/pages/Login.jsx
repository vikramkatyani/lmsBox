import { useForm } from 'react-hook-form';
import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { getUserRole, setAuthToken } from '../utils/auth';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../theme/ThemeContext';
import lmsLogo from '../assets/lmsbox-logo.png'; 
import loginIllustration from '../assets/login-image.png';
import api from '../utils/api';
import { RecaptchaComponent, executeRecaptcha } from '../utils/recaptcha';
import usePageTitle from '../hooks/usePageTitle';

export default function Login() {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [status, setStatus] = useState('idle'); // idle, loading, success, error
  const [message, setMessage] = useState('');
  const { isAuthenticated } = useAuth();
  const theme = useTheme();
  const logoSrc = theme?.logo || lmsLogo;
  const tenantName = theme?.name || import.meta.env.VITE_APP_TITLE || 'LMS Box';
  
  usePageTitle('Login');

  // Compute redirect target (rendered in JSX to avoid conditional hooks)
  const role = getUserRole();
  const redirectTarget = isAuthenticated
    ? (role && (role === 'admin' || role === 'Admin' || role === 'OrgAdmin' || role === 'SuperAdmin')
        ? '/admin/dashboard'
        : '/courses/all')
    : null;

  const onSubmit = async (data) => {
    try {
      setStatus('loading');
      setMessage('');

      // Execute invisible reCAPTCHA
      const recaptchaToken = await executeRecaptcha();
      if (!recaptchaToken) {
        throw new Error('reCAPTCHA verification failed');
      }

      // Send request with recaptcha token
      await api.post('/api/auth/login', {
        email: data.email,
        recaptchaToken
      });

      setStatus('success');
      setMessage('Login link sent! Please check your email to continue.');
    } catch (error) {
      setStatus('error');
      if (error.message === 'reCAPTCHA verification failed') {
        setMessage('Security check failed. Please try again.');
      } else {
        setMessage(error.response?.data?.message || 'Failed to send Login link. Please try again.');
      }
    }
  };

  // Development login function (bypasses email verification)
  const devLogin = async (email) => {
    try {
      setStatus('loading');
      setMessage('');

      const response = await api.post('/api/auth/dev-login', { email });
      
      if (response.data.token) {
        setAuthToken(response.data.token);
        setStatus('success');
        setMessage('Successfully logged in!');
        try {
          // Check profile completeness
          const me = await api.get('/api/profile/me');
          const firstEmpty = !me.data?.firstName || me.data.firstName.trim().length === 0;
          const lastEmpty = !me.data?.lastName || me.data.lastName.trim().length === 0;
          if (firstEmpty && lastEmpty) {
            window.location.href = '/profile/complete';
            return;
          }
        } catch (_e) { /* ignore */ }

        // Redirect after a short delay
        setTimeout(() => {
          const role = response.data.user?.roles?.[0];
          if (role && (role === 'admin' || role === 'Admin' || role === 'OrgAdmin' || role === 'SuperAdmin')) {
            window.location.href = '/admin/dashboard';
          } else {
            window.location.href = '/courses/all';
          }
        }, 1000);
      }
    } catch (error) {
      setStatus('error');
      setMessage(error.response?.data?.message || 'Development login failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-login-page-bg px-4">
      <div className="grid lg:grid-cols-2 gap-8 max-w-6xl w-full items-center">
        {redirectTarget && <Navigate to={redirectTarget} replace />}
        
        {/* Left: Login Form */}
        <div className="bg-login-box-bg p-8 rounded-lg shadow-lg max-w-md w-full mx-auto">
          <div className="mb-8 text-center">
            <img src={logoSrc} alt={`${tenantName} Logo`} className="h-12 mx-auto mb-4" />
            <h1 className="text-3xl font-semibold text-login-box-text">Sign in</h1>
            <p className="text-login-box-text text-sm mt-2">
              Enter your email address to receive a Login link for instant access.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-login-box-text mb-2">Email address</label>
              <input
                {...register('email', { 
                  required: 'Email is required',
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: "Invalid email address"
                  }
                })}
                type="email"
                placeholder="Enter your email"
                className="w-full border border-login-input-border rounded-lg px-4 py-3 text-sm text-login-box-text focus:ring-2 focus:ring-(--tenant-primary)"
                disabled={status === 'loading' || status === 'success'}
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>

            {message && (
              <p className={`text-sm ${status === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                {message}
              </p>
            )}

            <button 
              type="submit" 
              className={`w-full py-2.5 rounded-lg font-medium transition-colors text-login-btn-text ${
                status === 'loading'
                  ? 'bg-login-btn-bg/60 cursor-not-allowed'
                  : status === 'success'
                  ? 'bg-login-btn-bg cursor-not-allowed'
                  : 'bg-login-btn-bg hover:brightness-90'
              }`}
              disabled={status === 'loading' || status === 'success'}
            >
              {status === 'loading' ? 'Sending Login link...' : 
               status === 'success' ? 'Check your email' : 
               'Send Login link'}
            </button>

            {/* <p className="text-sm text-center text-login-box-text mt-6">
              Don't have an account?
              <a href="#" className="text-login-box-link-text font-medium hover:underline ml-1">Register here</a>
            </p> */}
          </form>

          {/* Development Login Section */}
          {import.meta.env.DEV && (
            <div className="mt-8 pt-6 border-t border-gray-300">
              <h3 className="text-sm font-medium text-gray-600 mb-4 text-center">Development Login (Skip Email)</h3>
              <div className="space-y-2">
                <button
                  onClick={() => devLogin('19vaibhav90@gmail.com')}
                  disabled={status === 'loading'}
                  className="w-full py-2 px-4 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Login as Learner (19vaibhav90@gmail.com)
                </button>
                <button
                  onClick={() => devLogin('admin@dev.local')}
                  disabled={status === 'loading'}
                  className="w-full py-2 px-4 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Login as Admin (admin@dev.local)
                </button>
              </div>
            </div>
          )}

          <RecaptchaComponent />
        </div>

        {/* Right: Illustration */}
        <div className="hidden lg:block">
          <img
            src={loginIllustration}
            alt="Login Illustration"
            className="w-full max-w-lg mx-auto object-cover"
          />
        </div>
      </div>
    </div>
  );
}