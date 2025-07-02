
import React, { useState, useRef, useEffect } from 'react';
import { SearchIcon, BellIcon, ChevronDownIcon, XMarkIcon, Bars3Icon } from './Icons';
import { useAuth } from '../AuthContext'; 

interface HeaderProps {
  title: string;
  onToggleMobileSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ title, onToggleMobileSidebar }) => {
  const { user, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => setDropdownOpen(!dropdownOpen);

  const handleSignOut = () => {
    signOut();
    setDropdownOpen(false); 
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  return (
    <header className="bg-slate-50 p-4 sm:px-6 lg:px-8 sticky top-0 z-20 border-b border-slate-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button 
            onClick={onToggleMobileSidebar} 
            className="md:hidden text-slate-500 hover:text-rose-600 mr-4 p-1"
            aria-label="Відкрити меню"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{title}</h1>
        </div>
        <div className="flex items-center space-x-3 sm:space-x-5">
          <div className="relative hidden sm:block">
            <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Пошук..."
              className="pl-10 pr-4 py-2 text-sm border bg-white border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors w-40 lg:w-64"
              aria-label="Пошук вмісту"
            />
          </div>
          <button className="text-slate-500 hover:text-rose-600 relative p-2 rounded-full hover:bg-slate-100" aria-label="Сповіщення">
            <BellIcon className="w-6 h-6" />
            <span className="absolute top-1 right-1 block h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-slate-50" />
          </button>
          
          {user && (
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={toggleDropdown} 
                className="flex items-center space-x-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 rounded-full"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
                aria-label="Меню користувача"
              >
                {user.picture ? (
                  <img src={user.picture} alt={user.name || 'Аватар користувача'} className="w-9 h-9 rounded-full" />
                ) : (
                  <span className="w-9 h-9 rounded-full bg-rose-500 text-white flex items-center justify-center text-sm font-semibold">
                    {user.name ? user.name.charAt(0).toUpperCase() : '?'}
                  </span>
                )}
                <div className="hidden md:flex items-center">
                  <span className="text-sm font-semibold">{user.name || user.email}</span>
                  <ChevronDownIcon className={`w-5 h-5 text-slate-400 ml-1 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl py-1 z-30 ring-1 ring-black ring-opacity-5">
                  <div className="px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800">{user.name || 'Користувач'}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                  <hr className="border-slate-200"/>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                    role="menuitem"
                  >
                    Вийти
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;