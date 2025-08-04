



import React, { useState, useRef, useEffect, useCallback, FC, SVGProps } from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchIcon, BellIcon, ChevronDownIcon, XMarkIcon, Bars3Icon, OrdersIcon } from './Icons';
import { useAuth } from '../AuthContext'; 
import { Notification, GlobalSearchResult } from '../types';
import { authenticatedFetch } from '../utils/api';
import GlobalSearchResults from './GlobalSearchResults';

interface HeaderProps {
  title: string;
  onToggleMobileSidebar: () => void;
}

const timeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return `${Math.floor(interval)} р. тому`;
    interval = seconds / 2592000;
    if (interval > 1) return `${Math.floor(interval)} міс. тому`;
    interval = seconds / 86400;
    if (interval > 1) return `${Math.floor(interval)} д. тому`;
    interval = seconds / 3600;
    if (interval > 1) return `${Math.floor(interval)} г. тому`;
    interval = seconds / 60;
    if (interval > 1) return `${Math.floor(interval)} хв. тому`;
    return `щойно`;
};

const NotificationIcon: FC<{ type: Notification['type'], props?: SVGProps<SVGSVGElement>}> = ({ type, ...props }) => {
    switch (type) {
        case 'NEW_ORDER':
            return <OrdersIcon className="w-5 h-5 text-rose-500" {...props} />;
        // Add other cases for future notification types
        default:
            return <BellIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" {...props} />;
    }
};

const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
};


const Header: React.FC<HeaderProps> = ({ title, onToggleMobileSidebar }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  
  // Global Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debouncedSearchQuery = useDebounce(searchQuery, 400);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
        const response = await authenticatedFetch('/api/notifications');
        if (response.ok) {
            const data: Notification[] = await response.json();
            setNotifications(data);
            setUnreadCount(data.filter(n => !n.is_read).length);
        }
    } catch (error) {
        console.error("Failed to fetch notifications:", error);
    }
  }, [user]);
  
  // Global Search Effect
  useEffect(() => {
    if (debouncedSearchQuery.length > 2) {
      const performSearch = async () => {
        setIsSearchLoading(true);
        try {
          const response = await authenticatedFetch(`/api/globalSearch?query=${encodeURIComponent(debouncedSearchQuery)}`);
          if (response.ok) {
            const data = await response.json();
            setSearchResults(data);
          } else {
            setSearchResults([]);
          }
        } catch (error) {
          console.error("Global search failed:", error);
          setSearchResults([]);
        } finally {
          setIsSearchLoading(false);
        }
      };
      performSearch();
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearchQuery]);


  useEffect(() => {
    fetchNotifications();
    const intervalId = setInterval(fetchNotifications, 60000); // Poll every 60 seconds
    return () => clearInterval(intervalId);
  }, [fetchNotifications]);

  const handleToggleNotifications = async () => {
    setNotificationsOpen(prev => {
        const isOpen = !prev;
        if(isOpen && unreadCount > 0){
            markAllAsRead();
        }
        return isOpen;
    });
  };

  const markAllAsRead = async () => {
    try {
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
        if (unreadIds.length === 0) return;

        const response = await authenticatedFetch('/api/notifications/mark-read', {
            method: 'POST',
            body: JSON.stringify({ ids: unreadIds })
        });
        if(response.ok){
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        }
    } catch (error) {
        console.error("Failed to mark notifications as read:", error);
    }
  };


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = () => {
    signOut();
    setDropdownOpen(false); 
  };
  
  const handleSearchResultClick = () => {
    setIsSearchFocused(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <header className="bg-white dark:bg-slate-900 p-4 sm:px-6 lg:px-8 sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button 
            onClick={onToggleMobileSidebar} 
            className="md:hidden text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-500 mr-4 p-1"
            aria-label="Відкрити меню"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">{title}</h1>
        </div>
        <div className="flex items-center space-x-3 sm:space-x-5">
          <div className="relative hidden sm:block" ref={searchRef}>
            <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="AI-пошук: замовлення, товари..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              className="pl-10 pr-4 py-2 text-sm border bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 dark:text-slate-200 dark:placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors w-40 lg:w-96"
              aria-label="Глобальний пошук"
            />
             {isSearchFocused && (searchQuery.length > 0 || isSearchLoading) && (
              <GlobalSearchResults 
                results={searchResults} 
                isLoading={isSearchLoading} 
                query={debouncedSearchQuery}
                onResultClick={handleSearchResultClick}
              />
            )}
          </div>
           <div className="relative" ref={notificationsRef}>
             <button onClick={handleToggleNotifications} className="text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-500 relative p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Сповіщення">
                <BellIcon className="w-6 h-6" />
                {unreadCount > 0 && <span className="absolute top-1 right-1 block h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />}
            </button>
             {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-850 rounded-lg shadow-xl z-30 ring-1 ring-black dark:ring-slate-700 ring-opacity-5">
                    <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Сповіщення</h4>
                    </div>
                    <ul className="py-1 max-h-96 overflow-y-auto">
                        {notifications.length > 0 ? (
                            notifications.map(notification => (
                                <li key={notification.id}
                                    className={`flex items-start p-3 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ${!notification.is_read ? 'bg-rose-50/50 dark:bg-rose-500/10' : ''}`}
                                    onClick={() => {
                                        if (notification.link) navigate(notification.link);
                                        setNotificationsOpen(false);
                                    }}
                                >
                                    <div className="flex-shrink-0 mr-3 mt-1">
                                       <NotificationIcon type={notification.type} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-slate-700 dark:text-slate-300">{notification.message}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">{timeAgo(notification.created_at)}</p>
                                    </div>
                                    {!notification.is_read && <div className="w-2 h-2 bg-rose-500 rounded-full mt-2 ml-2 flex-shrink-0"></div>}
                                </li>
                            ))
                        ) : (
                            <li className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                                У вас немає нових сповіщень.
                            </li>
                        )}
                    </ul>
                </div>
            )}
           </div>
          
          {user && (
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setDropdownOpen(!dropdownOpen)} 
                className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 dark:focus:ring-offset-slate-900 rounded-full"
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
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-850 rounded-lg shadow-xl py-1 z-30 ring-1 ring-black dark:ring-slate-700 ring-opacity-5">
                  <div className="px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{user.name || 'Користувач'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                  </div>
                  <hr className="border-slate-200 dark:border-slate-700"/>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 dark:text-red-400"
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