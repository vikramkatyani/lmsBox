import { useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const theme = useTheme();
  const logoSrc = theme?.logo || lmsLogo;
  const tenantName = theme?.name || import.meta.env.VITE_APP_TITLE || 'LMS Box';
  const API_BASE = import.meta.env.VITE_API_BASE;
  
  usePageTitle('Login');

  // Compute redirect target (rendered in JSX to avoid conditional hooks)
  const role = getUserRole();
  const redirectTarget = isAuthenticated
    ? (role && (role === 'admin' || role === 'Admin' || role === 'OrgAdmin' || role === 'SuperAdmin')
        ? '/admin/dashboard'
        : '/courses/all')
    : null;

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = hashParams.get('token');
    const expires = hashParams.get('expires');
    const authError = hashParams.get('authError');

    if (token) {
      const expiresMs = Number(expires);
      setAuthToken(token, Number.isFinite(expiresMs) ? expiresMs : undefined);
      setStatus('success');
      setMessage('Successfully signed in. Redirecting...');

      window.history.replaceState({}, document.title, '/login');
      setTimeout(() => {
        const userRole = getUserRole();
        if (userRole && (userRole === 'admin' || userRole === 'Admin' || userRole === 'OrgAdmin' || userRole === 'SuperAdmin')) {
          navigate('/admin/dashboard');
          return;
        }

        navigate('/courses/all');
      }, 700);
      return;
    }

    if (authError) {
      if (authError === 'not_registered') {
        window.history.replaceState({}, document.title, '/login');
        navigate('/auth/email-not-registered', { replace: true });
        return;
      }

      const errorMessages = {
        email_missing: 'Your identity provider did not return an email address. Please use your work account email.',
        external_denied: 'External login was cancelled or denied. Please try again.',
        external_failed: 'External login failed. Please try again.'
      };

      setStatus('error');
      setMessage(errorMessages[authError] || 'Unable to sign in with external provider. Please try again.');
      window.history.replaceState({}, document.title, '/login');
    }
  }, [navigate]);

  const startExternalLogin = (provider) => {
    const endpoint = API_BASE
      ? `${API_BASE}/api/auth/external/${provider}`
      : `/api/auth/external/${provider}`;
    window.location.href = endpoint;
  };

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
            <div className="login-logo-frame inline-flex mx-auto mb-4">
              <img src={logoSrc} alt={`${tenantName} Logo`} className="h-12 w-auto" />
            </div>
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
              className={`w-full cursor-pointer py-2.5 rounded-lg font-medium transition-colors text-login-btn-text ${
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

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-login-input-border"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-login-box-bg px-3 text-xs text-login-box-text/80">or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => startExternalLogin('google')}
                disabled={status === 'loading'}
                className="w-full cursor-pointer rounded-lg border border-white/60 bg-transparent px-4 py-2.5 text-sm font-medium text-white transition hover:border-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M21.805 12.23c0-.75-.067-1.47-.19-2.16H12v4.09h5.49a4.7 4.7 0 0 1-2.04 3.08v2.56h3.3c1.93-1.77 3.055-4.38 3.055-7.57z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 22c2.7 0 4.96-.89 6.62-2.41l-3.3-2.56c-.91.61-2.08.98-3.32.98-2.55 0-4.7-1.72-5.46-4.03H3.13v2.63A10 10 0 0 0 12 22z"
                      fill="#34A853"
                    />
                    <path
                      d="M6.54 13.98A6.01 6.01 0 0 1 6.23 12c0-.69.12-1.35.31-1.98V7.39H3.13A10 10 0 0 0 2 12c0 1.61.39 3.13 1.13 4.61l3.41-2.63z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.99c1.47 0 2.78.51 3.81 1.5l2.86-2.86A9.98 9.98 0 0 0 12 2a10 10 0 0 0-8.87 5.39l3.41 2.63c.76-2.31 2.91-4.03 5.46-4.03z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span>Google</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => startExternalLogin('microsoft')}
                disabled={status === 'loading'}
                className="w-full cursor-pointer rounded-lg border border-white/60 bg-transparent px-4 py-2.5 text-sm font-medium text-white transition hover:border-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="2" y="2" width="9" height="9" fill="#F25022" />
                    <rect x="13" y="2" width="9" height="9" fill="#7FBA00" />
                    <rect x="2" y="13" width="9" height="9" fill="#00A4EF" />
                    <rect x="13" y="13" width="9" height="9" fill="#FFB900" />
                  </svg>
                  <span>Microsoft</span>
                </span>
              </button>
            </div>

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
                  className="w-full cursor-pointer py-2 px-4 bg-[#2afeae] text-[#1b365d] text-sm rounded hover:bg-[#25e89e] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Login as Learner (19vaibhav90@gmail.com)
                </button>
                <button
                  onClick={() => devLogin('admin@dev.local')}
                  disabled={status === 'loading'}
                  className="w-full cursor-pointer py-2 px-4 bg-[#2afeae] text-[#1b365d] text-sm rounded hover:bg-[#25e89e] disabled:cursor-not-allowed disabled:opacity-50"
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