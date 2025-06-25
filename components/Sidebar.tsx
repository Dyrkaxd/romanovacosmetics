import React from 'react';
import { NavLink } from 'react-router-dom';
import { NavItem } from '../types';
import { DashboardIcon, ProductsIcon, OrdersIcon, UsersIcon, SettingsIcon, XMarkIcon } from './Icons';

interface SidebarProps {
  isOpenOnMobile: boolean;
  toggleMobileSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpenOnMobile, toggleMobileSidebar }) => {
  const navItems: NavItem[] = [
    { name: 'Панель керування', path: '/', icon: DashboardIcon },
    { name: 'Товари', path: '/products', icon: ProductsIcon },
    { name: 'Замовлення', path: '/orders', icon: OrdersIcon },
    { name: 'Клієнти', path: '/customers', icon: UsersIcon },
  ];

  const bottomNavItems: NavItem[] = [
    { name: 'Налаштування', path: '/settings', icon: SettingsIcon },
  ];

  const NavLinkItem: React.FC<{ item: NavItem }> = ({ item }) => (
    <NavLink
      to={item.path}
      onClick={() => { if(isOpenOnMobile) toggleMobileSidebar();}} // Close sidebar on mobile nav click
      className={({ isActive }) =>
        `flex items-center px-4 py-3 text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors duration-150 ease-in-out ${
          isActive ? 'bg-indigo-600 text-white' : 'text-slate-200 hover:text-white'
        }`
      }
    >
      <item.icon className="w-5 h-5 mr-3" />
      {item.name}
    </NavLink>
  );

  return (
    <div 
      className={`w-64 bg-slate-800 text-white h-screen flex flex-col fixed inset-y-0 left-0 z-30
                  transform ${isOpenOnMobile ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 
                  transition-transform duration-300 ease-in-out shadow-lg md:relative`}
    >
      <div className="p-6 border-b border-slate-700 flex justify-between items-center">
        <h1 className="text-xl font-semibold text-white flex items-center">
          <span role="img" aria-label="Shop Icon" className="text-3xl">🛍️</span>
          <span className="hidden sm:inline ml-2">Менеджер магазину</span>
        </h1>
        <button 
          onClick={toggleMobileSidebar} 
          className="md:hidden text-slate-200 hover:text-white"
          aria-label="Закрити меню"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
      </div>
      <nav className="flex-grow p-4 space-y-2">
        {navItems.map((item) => (
          <NavLinkItem key={item.name} item={item} />
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700 space-y-2">
        {bottomNavItems.map((item) => (
           <NavLinkItem key={item.name} item={item} />
        ))}
      </div>
    </div>
  );
};

export default Sidebar;