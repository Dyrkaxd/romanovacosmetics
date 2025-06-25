
import React, { useState, useRef, useEffect } from 'react';
import { SearchIcon, BellIcon, ChevronDownIcon, XMarkIcon, Bars3Icon } from './Icons'; // Added Bars3Icon
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
    <header className="bg-white shadow-sm p-4 sticky top-0 z-20">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center">
          <button 
            onClick={onToggleMobileSidebar} 
            className="md:hidden text-slate-600 hover:text-indigo-600 mr-3 p-1"
            aria-label="Відкрити меню"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
          <h2 className="text-xl md:text-2xl font-semibold text-slate-800">{title}</h2>
        </div>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="relative">
            <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Пошук..."
              className="pl-10 pr-2 sm:pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition-colors w-32 sm:w-auto"
              aria-label="Пошук вмісту"
            />
          </div>
          <button className="text-slate-500 hover:text-indigo-600 relative p-1" aria-label="Сповіщення">
            <BellIcon className="w-6 h-6" />
            <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
          </button>
          
          {user && (
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={toggleDropdown} 
                className="flex items-center space-x-1 sm:space-x-2 text-slate-700 hover:text-indigo-600 focus:outline-none p-1"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
                aria-label="Меню користувача"
              >
                {user.picture ? (
                  <img src={user.picture} alt={user.name || 'Аватар користувача'} className="w-8 h-8 rounded-full" />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm">
                    {user.name ? user.name.charAt(0).toUpperCase() : '?'}
                  </span>
                )}
                <span className="hidden md:inline text-sm font-medium">{user.name || user.email}</span>
                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-30 ring-1 ring-black ring-opacity-5">
                  <div className="px-4 py-2 text-sm text-slate-700">
                    <p className="font-medium">{user.name || 'Користувач'}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                  <hr className="my-1 border-slate-200"/>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left block px-4 py-2 text-sm text-red-600 hover:bg-slate-100 hover:text-red-700"
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
