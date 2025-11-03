import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { setAuthToken, getLastVisitedPage, getUserRole } from '../utils/auth';
import api from '../utils/api';
import lmsLogo from '../assets/lmsbox-logo.png';
import usePageTitle from '../hooks/usePageTitle';

export default function VerifyLogin() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error
  
  usePageTitle('Verify Login');
  
  useEffect(() => {
    const verifyToken = async () => {
      try {
        const token = searchParams.get('token');
        if (!token) {
          setStatus('error');
          return;
        }

        // Add timeout to the API call
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        try {
          const response = await api.post('/auth/verify-login-link', 
            { token },
            { 
              signal: controller.signal,
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );

          clearTimeout(timeout);

          if (response.data && response.data.token) {
            console.log('🎫 Login response received:', {
              hasToken: !!response.data.token,
              tokenLength: response.data.token?.length,
              tokenPreview: response.data.token?.substring(0, 20) + '...',
              expires: response.data.expires,
              expiresDate: response.data.expires ? new Date(response.data.expires).toISOString() : 'N/A'
            });
            
            // Store the JWT token using our auth utility
            setAuthToken(response.data.token, response.data.expires);
            
            // Verify storage immediately
            const storedToken = localStorage.getItem('token');
            const storedExpiration = localStorage.getItem('tokenExpiration');
            console.log('✅ Token stored, verification:', {
              tokenStored: !!storedToken,
              tokenLength: storedToken?.length,
              expirationStored: storedExpiration,
              expirationDate: storedExpiration ? new Date(parseInt(storedExpiration)).toISOString() : 'N/A'
            });
            
            setStatus('success');

            // Get user role from token
            const userRole = getUserRole();
            console.log('👤 User role:', userRole);
            
            // Redirect based on user role
            let redirectPath;
            if (userRole === 'admin' || userRole === 'OrgAdmin') {
              redirectPath = '/admin/dashboard';
            } else {
              redirectPath = getLastVisitedPage() || '/courses/all';
            }
            
            console.log('🔀 Redirecting to:', redirectPath);
            
            // Redirect after a brief delay
            setTimeout(() => {
              navigate(redirectPath);
            }, 2000);
          } else {
            throw new Error('Invalid response format');
          }
        } catch (apiError) {
          clearTimeout(timeout);
          throw apiError;
        }
      } catch (error) {
        console.error('Verification error:', error);
        setStatus('error');
      }
    };

    verifyToken();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-login-page-bg px-4">
      <div className="bg-login-box-bg p-8 rounded-lg shadow-lg max-w-md w-full mx-auto text-center">
        <img src={lmsLogo} alt="LMS Logo" className="h-12 mx-auto mb-4" />
        {status === 'verifying' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-login-btn-bg mx-auto"></div>
            <h2 className="text-xl font-semibold text-login-box-text mt-4">Verifying your login...</h2>
            <p className="text-login-box-text mt-2">Please wait while we verify your login link.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mt-4 text-green-600">Login Successful!</h2>
            <p className="text-login-box-text mt-2">Redirecting you to the courses...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mt-4 text-red-600">Invalid or Expired Link</h2>
            <p className="text-login-box-text mt-2">This login link is no longer valid. Please request a new one.</p>
            <button 
              onClick={() => navigate('/login')}
              className="mt-4 px-4 py-2 bg-login-btn-bg text-login-btn-text rounded-lg hover:brightness-90 transition-colors cursor-pointer"
            >
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}