


import React from 'react';
import { NavLink } from 'react-router-dom';
import { NavItem } from '../types';
import { DashboardIcon, ProductsIcon, OrdersIcon, UsersIcon, SettingsIcon, XMarkIcon, ChartBarIcon, CreditCardIcon, ArchiveBoxIcon, InformationCircleIcon } from './Icons';
import { logoBase64 } from '../assets/logo';
import { useAuth } from '../AuthContext'; 

interface SidebarProps {
  isOpenOnMobile: boolean;
  toggleMobileSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpenOnMobile, toggleMobileSidebar }) => {
  const { user } = useAuth(); 
  const isAdmin = user?.role === 'admin';

  // Conditionally include nav items based on role
  const navItems: NavItem[] = [
    // Admin-only items
    isAdmin && { name: 'Панель керування', path: '/', icon: DashboardIcon },
    isAdmin && { name: 'Звіти', path: '/reports', icon: ChartBarIcon },
    isAdmin && { name: 'Звіт по менеджерах', path: '/reports/managers', icon: UsersIcon },
    isAdmin && { name: 'Витрати', path: '/expenses', icon: CreditCardIcon },
    isAdmin && { name: 'Товари', path: '/products', icon: ProductsIcon },
    isAdmin && { name: 'Склад', path: '/warehouse', icon: ArchiveBoxIcon },
    
    // Manager-only items
    !isAdmin && { name: 'Мій огляд', path: '/', icon: DashboardIcon },

    // Shared items
    { name: 'Замовлення', path: '/orders', icon: OrdersIcon },
    { name: 'Клієнти', path: '/customers', icon: UsersIcon },
  ].filter(Boolean) as NavItem[]; // Filter out falsy values (from isAdmin checks)

  const bottomNavItems: NavItem[] = [
    { name: 'Налаштування', path: '/settings', icon: SettingsIcon },
    { name: 'Довідка', path: '/help', icon: InformationCircleIcon },
  ];

  const NavLinkItem: React.FC<{ item: NavItem }> = ({ item }) => (
    <NavLink
      to={item.path}
      onClick={() => { if(isOpenOnMobile) toggleMobileSidebar();}} // Close sidebar on mobile nav click
      end={item.path === '/'} // Make sure only root path is matched exactly
      className={({ isActive }) =>
        `group flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors duration-150 ease-in-out ${
          isActive 
          ? 'active bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' 
          : 'text-slate-600 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-300 dark:hover:text-rose-500 dark:hover:bg-slate-700'
        }`
      }
    >
      <item.icon className="w-5 h-5 mr-3 transition-colors text-slate-400 group-hover:text-rose-600 dark:group-hover:text-rose-500 group-[.active]:text-rose-600 dark:group-[.active]:text-rose-400" />
      {item.name}
    </NavLink>
  );

  return (
    <div 
      className={`w-64 bg-white dark:bg-slate-800 h-screen flex flex-col fixed inset-y-0 left-0 z-30 border-r border-slate-200 dark:border-slate-700
                  transform ${isOpenOnMobile ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 
                  transition-transform duration-300 ease-in-out shadow-lg md:shadow-none`}
    >
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <img src={logoBase64} alt="Romanova Cosmetics Logo" className="h-10 w-10" />
          {isAdmin ? (
            <span className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">ROMANOVA</span>
          ) : (
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">ROMANOVA</span>
              <p className="text-[10px] font-bold tracking-widest text-rose-500 -mt-1">МЕНЕДЖЕР</p>
            </div>
          )}
        </div>
        <button 
          onClick={toggleMobileSidebar} 
          className="md:hidden text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          aria-label="Закрити меню"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
      </div>
      <nav className="flex-grow p-4 space-y-1.5">
        {navItems.map((item) => (
          <NavLinkItem key={item.name} item={item} />
        ))}
      </nav>
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-1.5">
        {bottomNavItems.map((item) => (
           <NavLinkItem key={item.name} item={item} />
        ))}
      </div>
    </div>
  );
};

export default Sidebar;