
import React from 'react';
import { NavLink } from 'react-router-dom';
import { NavItem } from '../types';
import { DashboardIcon, ProductsIcon, OrdersIcon, UsersIcon, SettingsIcon } from './Icons';

const Sidebar: React.FC = () => {
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
      className={({ isActive }) =>
        `flex items-center px-4 py-3 text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors duration-150 ease-in-out ${
          isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
        }`
      }
    >
      <item.icon className="w-5 h-5 mr-3" />
      {item.name}
    </NavLink>
  );

  return (
    <div className="w-64 bg-slate-800 text-white h-screen flex flex-col fixed top-0 left-0 shadow-lg">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-semibold text-white flex items-center">
          🛍️ Менеджер магазину
        </h1>
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