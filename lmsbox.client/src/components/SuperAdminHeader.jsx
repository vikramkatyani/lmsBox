import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, NavLink } from 'react-router-dom';
import { useTheme } from '../theme/ThemeContext';
import { removeAuthToken, getUserName, getUserRole } from '../utils/auth';
import ConfirmDialog from './ConfirmDialog';
import toast, { Toaster } from 'react-hot-toast';
import lmsboxLogo from '../assets/lmsbox-logo.png';

export default function SuperAdminHeader() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userName, setUserName] = useState('');
  
  const menuRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const profileButtonRef = useRef(null);

  useEffect(() => {
    setUserName(getUserName());
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

      removeAuthToken();
      localStorage.clear();
      sessionStorage.clear();

      toast.dismiss(loadingToast);
      toast.success('Logged out successfully');

      navigate('/superadmin/login');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout. Please try again.');
    }
  };

  const initiateLogout = () => {
    setShowProfileMenu(false);
    setShowLogoutDialog(true);
  };

  return (
    <>
      <header className="flex shadow-md py-3 px-4 sm:px-10 min-h-[70px] tracking-wide relative z-50" style={{ backgroundColor: '#1b365d' }}>
        <div className="flex flex-wrap items-center justify-between lg:gap-y-4 gap-y-6 gap-x-4 w-full">
          <Link to="/superadmin/dashboard" className="flex items-center space-x-3">
            <img src={lmsboxLogo} alt="LMS Box" className="h-10 w-auto" />
            <span className="text-xl font-bold text-white" style={{ fontFamily: 'Albert Sans, sans-serif', fontWeight: 800, letterSpacing: '-0.04em' }}>Super Admin Portal</span>
          </Link>

          <div 
            ref={menuRef}
            className={`${isMobileMenuOpen ? 'block' : 'hidden'} lg:block fixed lg:relative inset-0 lg:inset-auto z-50`}>
            <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} lg:hidden fixed inset-0 bg-gray-900 bg-opacity-40`} onClick={() => setIsMobileMenuOpen(false)} />
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="lg:hidden fixed top-2 right-4 z-50 rounded-full bg-white w-9 h-9 flex items-center justify-center border border-gray-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 fill-gray-800" viewBox="0 0 320.591 320.591">
                <path d="M30.391 318.583a30.37 30.37 0 0 1-21.56-7.288c-11.774-11.844-11.774-30.973 0-42.817L266.643 10.665c12.246-11.459 31.462-10.822 42.921 1.424 10.362 11.074 10.966 28.095 1.414 39.875L51.647 311.295a30.366 30.366 0 0 1-21.256 7.288z" />
                <path d="M287.9 318.583a30.37 30.37 0 0 1-21.257-8.806L8.83 51.963C-2.078 39.225-.595 20.055 12.143 9.146c11.369-9.736 28.136-9.736 39.504 0l259.331 257.813c12.243 11.462 12.876 30.679 1.414 42.922-.456.487-.927.958-1.414 1.414a30.368 30.368 0 0 1-23.078 7.288z" />
              </svg>
            </button>

            <ul className="lg:flex lg:gap-x-10 max-lg:space-y-3 fixed lg:relative bg-white lg:bg-transparent w-2/3 lg:w-auto min-w-[300px] lg:min-w-0 top-0 left-0 h-full lg:h-auto p-4 lg:p-0 shadow-md lg:shadow-none overflow-auto lg:overflow-visible z-50">
              <li className="mb-6 hidden max-lg:block">
                <NavLink to="/superadmin/dashboard" className="flex items-center space-x-2">
                  <img src={lmsboxLogo} alt="LMS Box" className="h-8 w-auto" />
                  <span className="text-lg font-bold" style={{ color: '#1b365d', fontFamily: 'Albert Sans, sans-serif', fontWeight: 800, letterSpacing: '-0.04em' }}>Super Admin</span>
                </NavLink>
              </li>
              {[
                { to: '/superadmin/dashboard', label: 'Dashboard' },
                { to: '/superadmin/organisations', label: 'Organisations' },
                { to: '/superadmin/library', label: 'Library' },
                { to: '/superadmin/reports', label: 'Reports' }
              ].map((link) => (
                <li key={link.to} className="nav-item relative group">
                  <NavLink
                    to={link.to}
                    className={({ isActive }) =>
                      `block text-[15px] font-medium relative py-2 px-1 transition-colors duration-200
                      ${isActive 
                        ? 'text-white lg:text-white' 
                        : 'text-white lg:text-white max-lg:text-gray-700 hover:text-white lg:hover:text-white max-lg:hover:text-indigo-600'
                      }
                      lg:after:content-[""] lg:after:block lg:after:absolute lg:after:h-0.5 
                      lg:after:w-full lg:after:scale-x-0 lg:hover:after:scale-x-100 
                      lg:after:transition-transform lg:after:duration-300 lg:after:origin-left
                      ${isActive ? 'lg:after:scale-x-100 lg:after:bg-[#2afeae]' : 'lg:after:bg-[#2afeae]'}`
                    }
                    style={{ fontFamily: 'Inter, sans-serif', fontWeight: 500, letterSpacing: '-0.02em' }}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </NavLink>
                  <span className="lg:hidden absolute left-0 w-1 h-full transform scale-y-0 group-hover:scale-y-100 transition-transform duration-200" style={{ backgroundColor: '#2afeae' }} />
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center max-sm:ml-auto space-x-6">
            <div className="relative flex items-center space-x-3">
              <div className="hidden sm:block text-right">
                <div className="text-sm font-medium text-white">{userName}</div>
                <div className="text-xs text-gray-300">Super Admin</div>
              </div>
              <button
                ref={profileButtonRef}
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="relative px-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" className="cursor-pointer fill-white hover:fill-[#2afeae]" viewBox="0 0 512 512">
                  <path d="M437.02 74.981C388.667 26.629 324.38 0 256 0S123.333 26.629 74.98 74.981C26.629 123.333 0 187.62 0 256s26.629 132.667 74.98 181.019C123.333 485.371 187.62 512 256 512s132.667-26.629 181.02-74.981C485.371 388.667 512 324.38 512 256s-26.629-132.667-74.98-181.019zM256 482c-66.869 0-127.037-29.202-168.452-75.511C113.223 338.422 178.948 290 256 290c-49.706 0-90-40.294-90-90s40.294-90 90-90 90 40.294 90 90-40.294 90-90 90c77.052 0 142.777 48.422 168.452 116.489C383.037 452.798 322.869 482 256 482z" />
                </svg>
              </button>

              {showProfileMenu && (
                <div 
                  ref={profileDropdownRef}
                  className="absolute right-0 top-10 bg-white shadow-lg py-6 px-6 rounded-sm sm:min-w-[320px] max-sm:min-w-[250px] z-50">
                  <h6 className="font-semibold text-[15px]" style={{ fontFamily: 'Albert Sans, sans-serif', fontWeight: 800, letterSpacing: '-0.04em', color: '#1b365d' }}>Super Admin Account</h6>
                  <p className="text-sm mt-1" style={{ color: '#36454F' }}>System Administrator</p>
                  <hr className="border-b-0 my-4 border-gray-300" />
                  <ul className="space-y-1.5">
                    <li><Link to="/superadmin/profile" className="text-sm hover:text-slate-900" style={{ color: '#36454F' }} onClick={() => setShowProfileMenu(false)}>Profile Settings</Link></li>
                    <li><Link to="/superadmin/settings" className="text-sm hover:text-slate-900" style={{ color: '#36454F' }} onClick={() => setShowProfileMenu(false)}>System Settings</Link></li>
                  </ul>
                  <hr className="border-b-0 my-4 border-gray-300" />
                  <button
                    onClick={initiateLogout}
                    className="w-full rounded-sm px-4 py-2 text-sm font-medium cursor-pointer transition-colors"
                    style={{ backgroundColor: '#2afeae', color: '#1b365d', fontFamily: 'Inter, sans-serif', fontWeight: 600, letterSpacing: '-0.02em' }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = '#25e89e'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = '#2afeae'}
                  >
                    Logout
                  </button>
                  
                  <Toaster position="top-right" />
                </div>
              )}
            </div>

            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden cursor-pointer"
              id="toggleOpen"
            >
              <svg className="w-7 h-7" fill="white" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"></path>
              </svg>
            </button>
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
