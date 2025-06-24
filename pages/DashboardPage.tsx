import React from 'react';
import { DashboardStat } from '../types';
import { OrdersIcon, ProductsIcon, UsersIcon, DashboardIcon } from '../components/Icons'; // Import UsersIcon

const DashboardCard: React.FC<DashboardStat> = ({ title, value, icon: Icon, color, percentageChange, isPositive }) => {
  const percentageColor = isPositive ? 'text-green-500' : 'text-red-500';
  return (
    <div className={`bg-white p-6 rounded-xl shadow-lg flex items-center space-x-4 border-l-4 ${color}`}>
      <div className={`p-3 rounded-full bg-opacity-20 ${color.replace('border', 'bg').replace('-500', '-100')}`}>
        <Icon className={`w-8 h-8 ${color.replace('border', 'text')}`} />
      </div>
      <div>
        <p className="text-sm text-slate-600 font-medium">{title}</p>
        <p className="text-2xl font-semibold text-slate-800">{value}</p>
        {percentageChange && (
           <p className={`text-xs ${percentageColor}`}>
            {isPositive ? '↑' : '↓'} {percentageChange} проти минулого місяця
           </p>
        )}
      </div>
    </div>
  );
};


const DashboardPage: React.FC = () => {
  const stats: DashboardStat[] = [
    { title: 'Загальні продажі', value: '$12,345', icon: DashboardIcon, color: 'border-indigo-500', percentageChange: '12.5%', isPositive: true },
    { title: 'Нові замовлення', value: '150', icon: OrdersIcon, color: 'border-green-500', percentageChange: '5.2%', isPositive: true },
    { title: 'Всього товарів', value: '872', icon: ProductsIcon, color: 'border-amber-500', percentageChange: '1.0%', isPositive: false },
    { title: 'Активні клієнти', value: '1,230', icon: UsersIcon, color: 'border-sky-500', percentageChange: '2.8%', isPositive: true }, // Use UsersIcon
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <DashboardCard key={stat.title} {...stat} />
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-xl font-semibold text-slate-700 mb-4">Огляд продажів</h3>
          <img src="https://picsum.photos/seed/saleschart/800/400" alt="Заповнювач діаграми продажів" className="w-full h-auto rounded-md"/>
          <p className="text-sm text-slate-600 mt-2">Заповнювач для діаграми продажів (напр., з Recharts).</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-xl font-semibold text-slate-700 mb-4">Останні дії</h3>
          <ul className="space-y-3">
            {[
              {user: 'Аліса', action: 'розмістила нове замовлення #ORD001.'},
              {user: 'Богдан', action: 'оновив товар "Бездротова миша".'},
              {user: 'Чарлі', action: 'переглянув "Ігрова клавіатура".'},
              {user: 'Давид', action: 'скасував замовлення #ORD004.'},
              {user: 'Єва', action: 'зареєструвала новий обліковий запис.'},
            ].map((activity, index) => (
              <li key={index} className="flex items-start text-sm">
                <img src={`https://picsum.photos/seed/user${index}/32/32`} alt={activity.user} className="w-8 h-8 rounded-full mr-3"/>
                <div>
                  <span className="font-medium text-slate-700">{activity.user}</span>
                  <span className="text-slate-600 ml-1">{activity.action}</span>
                  <p className="text-xs text-slate-500">{(index + 1) * 5} хвилин тому</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;