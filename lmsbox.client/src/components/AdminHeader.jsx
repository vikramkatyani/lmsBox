import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, NavLink } from 'react-router-dom';
import { useTheme } from '../theme/ThemeContext';
import { removeAuthToken, getUserName, getUserRole } from '../utils/auth';
import ProfileIcon from './ProfileIcon';
import ConfirmDialog from './ConfirmDialog';
import toast, { Toaster } from 'react-hot-toast';
import { API_BASE } from '../utils/apiBase';

export default function AdminHeader({ hideNavigation = false }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  
  const menuRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const profileButtonRef = useRef(null);

  useEffect(() => {
    setUserName(getUserName());
    setUserRole(getUserRole());
  }, []);

  // Handle click outside for menu and profile dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target) && 
          event.target.id !== 'toggleOpen') {
        setIsMobileMenuOpen(false);
      }
      
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target) && 
          !profileButtonRef.current?.contains(event.target)) {
        setShowProfileMenu(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      setShowLogoutDialog(false);
      
      const loadingToast = toast.loading('Logging out...');
      
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
      } catch (error) {
        console.error('Logout API error:', error);
      }

      removeAuthToken();
      localStorage.clear();
      sessionStorage.clear();

      toast.dismiss(loadingToast);
      toast.success('Logged out successfully');

      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout. Please try again.');
    }
  };

  const initiateLogout = () => {
    setShowProfileMenu(false);
    setShowLogoutDialog(true);
  };

  const handleSwitchRole = () => {
    // Switch to learner view
    navigate('/courses/all');
    setShowProfileMenu(false);
  };

  return (
    <>
      <header className="flex shadow-md py-3 px-4 sm:px-10 bg-boxlms-navbar min-h-[70px] tracking-wide relative z-50">
        <div className="flex flex-wrap items-center justify-between lg:gap-y-4 gap-y-6 gap-x-4 w-full">
          <Link to="/admin/dashboard">
            <img src={theme.logo} alt="Logo" className="h-8 w-auto" />
          </Link>

          {!hideNavigation && (
            <>
              {/* Mobile menu overlay backdrop */}
              {isMobileMenuOpen && (
                <div 
                  className="lg:hidden fixed inset-0 bg-gray-900 bg-opacity-50 z-40"
                  onClick={() => setIsMobileMenuOpen(false)} 
                />
              )}

              <div 
                ref={menuRef}
                className="lg:block">
                {/* Close button for mobile */}
                {isMobileMenuOpen && (
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="lg:hidden fixed top-3 right-3 z-[60] rounded-full bg-white w-10 h-10 flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 fill-gray-700" viewBox="0 0 320.591 320.591">
                      <path d="M30.391 318.583a30.37 30.37 0 0 1-21.56-7.288c-11.774-11.844-11.774-30.973 0-42.817L266.643 10.665c12.246-11.459 31.462-10.822 42.921 1.424 10.362 11.074 10.966 28.095 1.414 39.875L51.647 311.295a30.366 30.366 0 0 1-21.256 7.288z" />
                      <path d="M287.9 318.583a30.37 30.37 0 0 1-21.257-8.806L8.83 51.963C-2.078 39.225-.595 20.055 12.143 9.146c11.369-9.736 28.136-9.736 39.504 0l259.331 257.813c12.243 11.462 12.876 30.679 1.414 42.922-.456.487-.927.958-1.414 1.414a30.368 30.368 0 0 1-23.078 7.288z" />
                    </svg>
                  </button>
                )}

                <ul className={`
                  lg:flex lg:gap-x-10 
                  max-lg:fixed max-lg:top-0 max-lg:left-0 max-lg:h-full max-lg:w-72 max-lg:bg-boxlms-navbar 
                  max-lg:shadow-xl max-lg:overflow-y-auto max-lg:z-50 max-lg:p-6 max-lg:space-y-1
                  max-lg:transform max-lg:transition-transform max-lg:duration-300 max-lg:ease-in-out
                  ${isMobileMenuOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'}
                `}>
                  {/* Mobile menu header with logo */}
                  <li className="mb-8 pb-4 border-b border-boxlms-navbar-txt border-opacity-20 lg:hidden">
                    <NavLink to="/admin/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                      <img src={theme.logo} alt="Logo" className="h-8 w-auto" />
                    </NavLink>
                  </li>
                  
                  {[
                    { to: '/admin/dashboard', label: 'Dashboard' },
                    { to: '/admin/users', label: 'Users' },
                    { to: '/admin/courses', label: 'Courses' },
                    { to: '/admin/learning-pathways', label: 'Pathways' },
                    { to: '/admin/surveys', label: 'Surveys' },
                    { to: '/admin/reports', label: 'Reports' }
                  ].map((link) => (
                    <li key={link.to} className="nav-item relative group">
                      <NavLink
                        to={link.to}
                        className={({ isActive }) =>
                          `block text-[15px] font-medium relative transition-all duration-200
                          ${isActive 
                            ? 'text-boxlms-navbar-active' 
                            : 'text-boxlms-navbar-txt hover:text-boxlms-navbar-active'
                          }
                          max-lg:py-3 max-lg:px-3
                          lg:py-2 lg:px-1
                          lg:after:content-[""] lg:after:block lg:after:absolute lg:after:h-0.5 
                          lg:after:bg-boxlms-navbar-active lg:after:w-full lg:after:scale-x-0 lg:hover:after:scale-x-100 
                          lg:after:transition-transform lg:after:duration-300 lg:after:origin-left
                          ${isActive ? 'lg:after:scale-x-100' : ''}`
                        }
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        {link.label}
                      </NavLink>
                      <span className={`lg:hidden absolute left-0 top-0 w-1 h-full bg-boxlms-navbar-active rounded-r transition-transform duration-200 ${link.to === window.location.pathname ? 'scale-y-100' : 'scale-y-0 group-hover:scale-y-100'}`} />
                    </li>
                  ))}
                </ul>
              </div>

              <button
                id="toggleOpen"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden p-1 hover:bg-gray-100 hover:bg-opacity-10 rounded transition-colors">
                <svg className="w-7 h-7 fill-boxlms-navbar-txt" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </>
          )}

          <div className="flex items-center max-sm:ml-auto space-x-6">
            <div className="relative flex items-center space-x-3">
              <div className="hidden sm:block text-right">
                <div className="text-sm font-medium text-boxlms-navbar-txt">{userName}</div>
                {userRole && <div className="text-xs text-gray-500 capitalize">{userRole}</div>}
              </div>
              <button
                ref={profileButtonRef}
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="relative px-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" className="cursor-pointer hover:fill-boxlms-profile" viewBox="0 0 512 512">
                  <path d="M437.02 74.981C388.667 26.629 324.38 0 256 0S123.333 26.629 74.98 74.981C26.629 123.333 0 187.62 0 256s26.629 132.667 74.98 181.019C123.333 485.371 187.62 512 256 512s132.667-26.629 181.02-74.981C485.371 388.667 512 324.38 512 256s-26.629-132.667-74.98-181.019zM256 482c-66.869 0-127.037-29.202-168.452-75.511C113.223 338.422 178.948 290 256 290c-49.706 0-90-40.294-90-90s40.294-90 90-90 90 40.294 90 90-40.294 90-90 90c77.052 0 142.777 48.422 168.452 116.489C383.037 452.798 322.869 482 256 482z" />
                </svg>
              </button>

              {showProfileMenu && (
                <div 
                  ref={profileDropdownRef}
                  className="absolute right-0 top-12 bg-white shadow-xl rounded-lg py-6 px-6 sm:min-w-[320px] max-sm:min-w-[280px] max-sm:max-w-[calc(100vw-2rem)] z-[100] border border-gray-100">
                  <h6 className="font-semibold text-[15px]">Admin Account</h6>
                  <p className="text-sm text-gray-500 mt-1">Manage your admin settings</p>
                  <hr className="border-b-0 my-4 border-gray-300" />
                  <ul className="space-y-1.5">
                    <li><Link to="/admin/profile" className="text-sm text-gray-500 hover:text-slate-900" onClick={() => setShowProfileMenu(false)}>Profile Settings</Link></li>
                    <li><Link to="/admin/settings" className="text-sm text-gray-500 hover:text-slate-900" onClick={() => setShowProfileMenu(false)}>System Settings</Link></li>
                    <li><a href="http://www.lmsbox.co.uk/help-centre#admin-help" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 hover:text-slate-900" onClick={() => setShowProfileMenu(false)}>Help Center</a></li>
                  </ul>
                  <hr className="border-b-0 my-4 border-gray-300" />
                  <button
                    onClick={handleSwitchRole}
                    className="w-full bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded-md px-4 py-2.5 text-sm font-medium cursor-pointer hover:brightness-90 transition-all mb-2"
                  >
                    Switch to Learner View
                  </button>
                  <hr className="border-b-0 my-4 border-gray-300" />
                  <button
                    onClick={initiateLogout}
                    className="w-full bg-boxlms-primary-btn text-boxlms-primary-btn-txt rounded-md px-4 py-2.5 text-sm font-medium cursor-pointer hover:brightness-90 transition-all"
                  >
                    Logout
                  </button>
                  
                  <Toaster position="top-right" />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <ConfirmDialog
        isOpen={showLogoutDialog}
        onClose={() => setShowLogoutDialog(false)}
        onConfirm={handleLogout}
        title="Confirm Logout"
        message="Are you sure you want to logout?"
      />
    </>
  );
}
