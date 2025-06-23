import React from 'react';
import { SearchIcon, BellIcon } from './Icons'; // Removed ChevronDownIcon, XMarkIcon
// import { useAuth } from '../AuthContext'; // Removed useAuth import

interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  // const { user, signOut } = useAuth(); // Removed auth logic
  // const [dropdownOpen, setDropdownOpen] = useState(false); // Removed dropdown state

  // const handleSignOut = () => { // Removed sign out handler
  //   signOut();
  // };

  return (
    <header className="bg-white shadow-sm p-4 sticky top-0 z-20">
      <div className="container mx-auto flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-800">{title}</h2>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Пошук..."
              className="pl-10 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              aria-label="Пошук вмісту"
            />
          </div>
          <button className="text-slate-500 hover:text-indigo-600 relative" aria-label="Сповіщення">
            <BellIcon className="w-6 h-6" />
            <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
          </button>
          
          {/* User profile dropdown removed */}
        </div>
      </div>
    </header>
  );
};

export default Header;