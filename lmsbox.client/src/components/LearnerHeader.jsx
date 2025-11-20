import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { removeAuthToken, saveLastVisitedPage, getAuthToken, getUserRole, isAdmin } from '../utils/auth';
import toast, { Toaster } from 'react-hot-toast';
import ConfirmDialog from './ConfirmDialog';
import { useTheme } from '../theme/ThemeContext';
import { API_BASE } from '../utils/apiBase';

export default function LearnerHeader() {
  const theme = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [userName, setUserName] = useState('User');
  const [userRole, setUserRole] = useState('');
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Extract user name from token or localStorage
  useEffect(() => {
    try {
      const token = getAuthToken();
      if (token) {
        // Try to decode JWT to get user info
        const payload = JSON.parse(atob(token.split('.')[1]));
        const name = payload.name || payload.email?.split('@')[0] || 'User';
        setUserName(name);
        setUserRole(getUserRole());
        setIsUserAdmin(isAdmin());
      } else {
        // Fallback to localStorage if available
        const storedName = localStorage.getItem('userName');
        if (storedName) setUserName(storedName);
      }
    } catch (error) {
      console.error('Error extracting user name:', error);
      setUserName('User');
    }
  }, []);

  // Save last visited page whenever location changes
  useEffect(() => {
    saveLastVisitedPage(location.pathname);
  }, [location]);

  // Check token expiration periodically
  useEffect(() => {
    const checkToken = () => {
      const token = getAuthToken();
      if (!token && location.pathname !== '/login') {
        toast.error('Session expired. Please login again.');
        navigate('/login');
      }
    };

    const interval = setInterval(checkToken, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [navigate, location.pathname]);
  
  const menuRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const profileButtonRef = useRef(null);

  // Handle click outside for both menu and profile dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      // Handle mobile menu
      if (menuRef.current && !menuRef.current.contains(event.target) && 
          event.target.id !== 'toggleOpen') {
        setIsMenuOpen(false);
      }
      
      // Handle profile dropdown
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target) && 
          !profileButtonRef.current.contains(event.target)) {
        setIsProfileDropdownOpen(false);
      }
    }

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);
    
    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close menu when route changes
  useEffect(() => {
    setIsMenuOpen(false);
    setIsProfileDropdownOpen(false);
  }, [navigate]);

  const initiateLogout = (e) => {
    e.preventDefault(); // Prevent default button behavior
    e.stopPropagation(); // Prevent event from bubbling up
    setShowLogoutConfirm(true);
  };

  const handleLogout = async () => {
    try {
      setShowLogoutConfirm(false);
      
      // Show loading toast
      const loadingToast = toast.loading('Logging out...');
      
      // Call logout endpoint if you have one
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
      } catch (error) {
        console.error('Logout API error:', error);
        // Continue with local logout even if API call fails
      }

      // Clean up local state
      removeAuthToken();
      
      // Clear any other stored data
      localStorage.clear();
      sessionStorage.clear();

      // Dismiss loading toast and show success
      toast.dismiss(loadingToast);
      toast.success('Logged out successfully');

      // Navigate to login page
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout. Please try again.');
    }
  };

  return (
    <header className="flex shadow-md py-3 px-4 sm:px-10 bg-boxlms-navbar min-h-[70px] tracking-wide relative z-50">
      <div className="flex flex-wrap items-center justify-between lg:gap-y-4 gap-y-6 gap-x-4 w-full">
        <Link to="/courses/all" className="hidden lg:block">
          <img src={theme.logo} alt="Logo" className="h-8 w-auto" />
        </Link>

        <div 
          ref={menuRef}
          className={`${isMenuOpen ? 'block' : 'hidden'} lg:block fixed lg:relative inset-0 lg:inset-auto z-50`}>
          <div className={`${isMenuOpen ? 'block' : 'hidden'} lg:hidden fixed inset-0 bg-page-dark-bg bg-opacity-40`} onClick={() => setIsMenuOpen(false)} />
          <button
            onClick={() => setIsMenuOpen(false)}
            className="lg:hidden fixed top-2 right-4 z-50 rounded-full bg-white w-9 h-9 flex items-center justify-center border border-gray-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 fill-boxlms-profile" viewBox="0 0 320.591 320.591">
              <path d="M30.391 318.583a30.37 30.37 0 0 1-21.56-7.288c-11.774-11.844-11.774-30.973 0-42.817L266.643 10.665c12.246-11.459 31.462-10.822 42.921 1.424 10.362 11.074 10.966 28.095 1.414 39.875L51.647 311.295a30.366 30.366 0 0 1-21.256 7.288z" />
              <path d="M287.9 318.583a30.37 30.37 0 0 1-21.257-8.806L8.83 51.963C-2.078 39.225-.595 20.055 12.143 9.146c11.369-9.736 28.136-9.736 39.504 0l259.331 257.813c12.243 11.462 12.876 30.679 1.414 42.922-.456.487-.927.958-1.414 1.414a30.368 30.368 0 0 1-23.078 7.288z" />
            </svg>
          </button>

          <ul className="lg:flex lg:gap-x-10 max-lg:space-y-3 fixed lg:relative bg-white lg:bg-transparent w-2/3 lg:w-auto min-w-[300px] lg:min-w-0 top-0 left-0 h-full lg:h-auto p-4 lg:p-0 shadow-md lg:shadow-none overflow-auto lg:overflow-visible z-50">
            <li className="mb-6 hidden max-lg:block">
              <NavLink to="/courses/all">
                <img src={theme.logo} alt="Logo" className="h-8 w-auto" />
              </NavLink>
            </li>
            {/* {[
              { to: '/courses', label: 'My Courses' },
              { to: '/certificates', label: 'Certificates' }
            ].map((link) => (
              <li key={link.to} className="nav-item relative group">
                <NavLink
                  to={link.to}
                  className={({ isActive }) =>
                    `block text-[15px] font-medium relative py-2 px-1 transition-colors duration-200
                    ${isActive 
                      ? 'text-boxlms-navbar-active' 
                      : 'text-boxlms-navbar-txt hover:text-boxlms-navbar-active'
                    }
                    lg:after:content-[""] lg:after:block lg:after:absolute lg:after:h-0.5 
                    lg:after:bg-boxlms-navbar-active lg:after:w-full lg:after:scale-x-0 lg:hover:after:scale-x-100 
                    lg:after:transition-transform lg:after:duration-300 lg:after:origin-left
                    ${isActive ? 'lg:after:scale-x-100' : ''}`
                  }
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </NavLink>
                <span className="lg:hidden absolute left-0 w-1 h-full bg-blue-600 transform scale-y-0 group-hover:scale-y-100 transition-transform duration-200" />
              </li>
            ))} */}
          </ul>
        </div>

        <div className="flex items-center max-sm:ml-auto space-x-6">
          <div className="relative flex items-center space-x-3">
            <div className="hidden sm:block text-right">
              <div className="text-sm font-medium text-boxlms-navbar-txt">{userName}</div>
              {userRole && <div className="text-xs text-gray-500 capitalize">{userRole}</div>}
            </div>
            <button
              ref={profileButtonRef}
              onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              className="relative px-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" className="cursor-pointer hover:fill-boxlms-profile" viewBox="0 0 512 512">
                <path d="M437.02 74.981C388.667 26.629 324.38 0 256 0S123.333 26.629 74.98 74.981C26.629 123.333 0 187.62 0 256s26.629 132.667 74.98 181.019C123.333 485.371 187.62 512 256 512s132.667-26.629 181.02-74.981C485.371 388.667 512 324.38 512 256s-26.629-132.667-74.98-181.019zM256 482c-66.869 0-127.037-29.202-168.452-75.511C113.223 338.422 178.948 290 256 290c-49.706 0-90-40.294-90-90s40.294-90 90-90 90 40.294 90 90-40.294 90-90 90c77.052 0 142.777 48.422 168.452 116.489C383.037 452.798 322.869 482 256 482z" />
              </svg>
            </button>

            {isProfileDropdownOpen && (
              <div 
                ref={profileDropdownRef}
                className="absolute right-0 top-10 bg-white shadow-lg py-6 px-6 rounded-sm sm:min-w-[320px] max-sm:min-w-[250px] z-50">
                <h6 className="font-semibold text-[15px]">My Account</h6>
                <p className="text-sm text-gray-500 mt-1">Manage your account settings</p>
                <hr className="border-b-0 my-4 border-gray-300" />
                <ul className="space-y-1.5">
                  <li><Link to="/profile" className="text-sm text-gray-500 hover:text-slate-900">Profile Settings</Link></li>
                  <li><Link to="/notifications" className="text-sm text-gray-500 hover:text-slate-900">Notifications</Link></li>
                  <li><Link to="/grades" className="text-sm text-gray-500 hover:text-slate-900">My Grades</Link></li>
                  <li><Link to="/help" className="text-sm text-gray-500 hover:text-slate-900">Help Center</Link></li>
                </ul>
                {isUserAdmin && (
                  <>
                    <hr className="border-b-0 my-4 border-gray-300" />
                    <button
                      onClick={() => {
                        navigate('/admin/dashboard');
                        setIsProfileDropdownOpen(false);
                      }}
                      className="w-full bg-blue-600 text-white rounded-sm px-4 py-2 text-sm font-medium cursor-pointer hover:bg-blue-700 mb-2"
                    >
                      Switch to Admin View
                    </button>
                  </>
                )}
                <hr className="border-b-0 my-4 border-gray-300" />
                <button
                  onClick={initiateLogout}
                  className="w-full bg-logout-btn text-logout-btn-text hover:bg-logout-btn-text hover:text-white rounded-sm px-4 py-2 text-sm font-medium cursor-pointer"
                >
                  Logout
                </button>
                
                {/* Toaster for notifications */}
                <Toaster position="top-right" />
              </div>
            )}
            
            {/* Logout Confirmation Dialog - Moved outside dropdown */}
            <ConfirmDialog
              isOpen={showLogoutConfirm}
              onClose={() => setShowLogoutConfirm(false)}
              onConfirm={handleLogout}
              title="Confirm Logout"
              message="Are you sure you want to logout?"
            />
          </div>

          <button
            onClick={() => setIsMenuOpen(true)}
            className="lg:hidden cursor-pointer"
          >
            {/* <svg className="w-7 h-7" fill="#000" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"></path>
            </svg> */}
          </button>
        </div>
      </div>
    </header>
  );
}