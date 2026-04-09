import { useNavigate } from 'react-router-dom';
import { useTheme } from '../theme/ThemeContext';
import lmsLogo from '../assets/lmsbox-logo.png';
import usePageTitle from '../hooks/usePageTitle';

export default function EmailNotRegistered() {
  const navigate = useNavigate();
  const theme = useTheme();
  const logoSrc = theme?.logo || lmsLogo;
  const tenantName = theme?.name || import.meta.env.VITE_APP_TITLE || 'LMS Box';

  usePageTitle('Email Not Registered');

  return (
    <div className="min-h-screen flex items-center justify-center bg-login-page-bg px-4">
      <div className="bg-login-box-bg p-8 rounded-xl shadow-xl max-w-md w-full mx-auto text-center border border-white/10">
        <img src={logoSrc} alt={`${tenantName} Logo`} className="h-12 mx-auto mb-6" />

        <div className="h-14 w-14 rounded-full bg-amber-400/15 text-amber-300 border border-amber-300/40 flex items-center justify-center mx-auto">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v4m0 4h.01M4.93 19h14.14c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.2 16c-.77 1.33.19 3 1.73 3z" />
          </svg>
        </div>

        <h1 className="text-3xl font-semibold text-white mt-5 tracking-tight">Email Not Registered</h1>

        <p className="text-white text-base mt-4 leading-relaxed">
          Your email is not registered in this system. Please contact your administrator.
        </p>

        <div className="mt-7">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full cursor-pointer py-2.5 rounded-lg font-medium bg-login-btn-bg text-login-btn-text hover:brightness-90 transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
