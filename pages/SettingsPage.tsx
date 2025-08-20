import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import { ManagedUser } from '../types';
import { Database } from '../types/supabase';
import { PlusIcon, TrashIcon, UsersIcon, PencilIcon, XMarkIcon, CurrencyDollarIcon, SunIcon, MoonIcon } from '../components/Icons';
import { authenticatedFetch } from '../utils/api';

const API_BASE_URL = '/api';
type ManagedUserRow = Database['public']['Tables']['managed_users']['Row'];
type AdminRow = Database['public']['Tables']['admins']['Row'];

const productGroups = ['BDR', 'LA', 'АГ', 'АБ', 'АР', 'без сокращений', 'АФ', 'ДС', 'м8', 'JDA', 'Faith', 'AB', 'ГФ', 'ЕС', 'ГП', 'СД', 'ATA', 'W', 'Гуаша'];

const ThemeSwitcher: React.FC = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg flex justify-between items-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Поточна тема: <span className="font-semibold text-rose-600 dark:text-rose-400">{theme === 'dark' ? 'Темна' : 'Світла'}</span></p>
            <button
                onClick={toggleTheme}
                aria-label={`Переключити на ${theme === 'dark' ? 'світлу' : 'темну'} тему`}
                className="relative inline-flex items-center h-8 w-14 rounded-full bg-slate-200 dark:bg-slate-600 transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 dark:focus:ring-offset-slate-800"
            >
                <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-300 ease-in-out ${theme === 'dark' ? 'translate-x-7' : 'translate-x-1'}`}>
                   {theme === 'dark' 
                     ? <MoonIcon className="h-4 w-4 text-indigo-500 m-1"/> 
                     : <SunIcon className="h-4 w-4 text-amber-500 m-1"/>
                   }
                </span>
            </button>
        </div>
    );
};


const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // State for Manager Management
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [isLoadingManagers, setIsLoadingManagers] = useState(false);
  const [newManagerName, setNewManagerName] = useState('');
  const [newManagerEmail, setNewManagerEmail] = useState('');
  const [newManagerNotes, setNewManagerNotes] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingManager, setEditingManager] = useState<ManagedUser | null>(null);
  const [currentEditName, setCurrentEditName] = useState('');
  const [currentEditNotes, setCurrentEditNotes] = useState('');

  // State for Admin Management
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // State for Exchange Rate Management
  const [globalRate, setGlobalRate] = useState('');
  const [groupRates, setGroupRates] = useState<Record<string, string>>({});
  const [isRateLoading, setIsRateLoading] = useState<Record<string, boolean>>({});

  // Common State for feedback
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchManagedUsers = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingManagers(true);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/managedUsers`);
      if (!response.ok) throw new Error((await response.json()).message || 'Failed to fetch managed users.');
      const usersFromDb: ManagedUserRow[] = await response.json();
      setManagedUsers(usersFromDb.map(u => ({
        id: u.id, name: u.name, email: u.email,
        notes: u.notes || undefined, dateAdded: u.created_at || new Date().toISOString()
      })));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingManagers(false);
    }
  }, [isAdmin]);

  const fetchAdmins = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingAdmins(true);
    try {
        const response = await authenticatedFetch(`${API_BASE_URL}/admins`);
        if (!response.ok) throw new Error((await response.json()).message || 'Failed to fetch admins.');
        setAdmins(await response.json());
    } catch (err: any) {
        setError(err.message);
    } finally {
        setIsLoadingAdmins(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchManagedUsers();
      fetchAdmins();
    }
  }, [isAdmin, fetchManagedUsers, fetchAdmins]);

  const showSuccessMessage = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  const handleAddManager = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!newManagerName.trim() || !newManagerEmail.trim()) {
      setError("Ім'я та email менеджера є обов'язковими."); return;
    }
    setIsLoadingManagers(true);
    try {
      const payload = { name: newManagerName.trim(), email: newManagerEmail.trim().toLowerCase(), notes: newManagerNotes.trim() };
      const response = await authenticatedFetch(`${API_BASE_URL}/managedUsers`, { method: 'POST', body: JSON.stringify(payload) });
      if (!response.ok) throw new Error((await response.json()).message || 'Failed to add manager.');
      showSuccessMessage(`Менеджера "${payload.name}" успішно додано.`);
      setNewManagerName(''); setNewManagerEmail(''); setNewManagerNotes('');
      fetchManagedUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingManagers(false);
    }
  };

  const handleRemoveManager = async (managerId: string) => {
    if (window.confirm("Ви впевнені, що хочете видалити цього менеджера?")) {
      setError(null);
      setIsLoadingManagers(true);
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/managedUsers/${managerId}`, { method: 'DELETE' });
        if (response.status !== 204) throw new Error((await response.json()).message || 'Failed to delete manager.');
        showSuccessMessage("Менеджера успішно видалено.");
        fetchManagedUsers();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoadingManagers(false);
      }
    }
  };

  const openEditModal = (manager: ManagedUser) => {
    setEditingManager(manager);
    setCurrentEditName(manager.name);
    setCurrentEditNotes(manager.notes || '');
    setIsEditModalOpen(true);
    setError(null);
  };

  const closeEditModal = () => { setIsEditModalOpen(false); setEditingManager(null); };

  const handleUpdateManager = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!editingManager || !currentEditName.trim()) { setError("Ім'я не може бути порожнім."); return; }
    setIsLoadingManagers(true);
    try {
      const payload = { name: currentEditName.trim(), notes: currentEditNotes.trim() };
      const response = await authenticatedFetch(`${API_BASE_URL}/managedUsers/${editingManager.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      if (!response.ok) throw new Error((await response.json()).message || 'Failed to update manager.');
      showSuccessMessage(`Дані менеджера "${payload.name}" успішно оновлено.`);
      closeEditModal();
      fetchManagedUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingManagers(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!newAdminEmail.trim() || !/\S+@\S+\.\S+/.test(newAdminEmail)) {
        setError("Будь ласка, введіть дійсну адресу електронної пошти."); return;
      }
      setIsLoadingAdmins(true);
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/admins`, { method: 'POST', body: JSON.stringify({ email: newAdminEmail }) });
        if (!response.ok) throw new Error((await response.json()).message || 'Failed to add admin.');
        showSuccessMessage(`Адміністратора ${newAdminEmail} успішно додано.`);
        setNewAdminEmail('');
        fetchAdmins();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoadingAdmins(false);
      }
  };

  const handleRemoveAdmin = async (emailToRemove: string) => {
    if (window.confirm(`Ви впевнені, що хочете видалити адміністратора ${emailToRemove}?`)) {
      setError(null);
      setIsLoadingAdmins(true);
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/admins`, { method: 'DELETE', body: JSON.stringify({ email: emailToRemove }) });
        if (response.status !== 204) throw new Error((await response.json()).message || 'Failed to delete admin.');
        showSuccessMessage(`Адміністратора ${emailToRemove} успішно видалено.`);
        fetchAdmins();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoadingAdmins(false);
      }
    }
  };

  const handleExchangeRateUpdate = async (groupName?: string) => {
    setError(null);
    const rateToUpdate = groupName ? groupRates[groupName] : globalRate;
    if (!rateToUpdate || parseFloat(rateToUpdate) <= 0) {
      setError('Курс повинен бути позитивним числом.'); return;
    }

    const loadingKey = groupName || 'global';
    setIsRateLoading(prev => ({ ...prev, [loadingKey]: true }));
    try {
      const payload = { newRate: parseFloat(rateToUpdate), ...(groupName && { group: groupName }) };
      const response = await authenticatedFetch(`${API_BASE_URL}/exchangeRates`, { method: 'POST', body: JSON.stringify(payload) });
      if (!response.ok) throw new Error((await response.json()).message || 'Не вдалося оновити курс.');
      const { updatedCount } = await response.json();
      showSuccessMessage(`Курс успішно оновлено для ${updatedCount} товарів.`);
      if(groupName) setGroupRates(prev => ({...prev, [groupName]: ''})); else setGlobalRate('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRateLoading(prev => ({ ...prev, [loadingKey]: false }));
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Налаштування</h2>
      {error && <div role="alert" className="my-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">{error}</div>}
      {successMessage && <div role="alert" className="my-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm">{successMessage}</div>}
      
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Тема оформлення</h3>
         <ThemeSwitcher />
      </div>
      
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">Інформація про мій обліковий запис</h3>
          {user && (
              <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 space-y-2">
                  <p className="text-sm text-slate-800 dark:text-slate-200"><span className="font-semibold w-20 inline-block text-slate-500 dark:text-slate-400">Ім'я:</span> {user.name}</p>
                  <p className="text-sm text-slate-800 dark:text-slate-200"><span className="font-semibold w-20 inline-block text-slate-500 dark:text-slate-400">Email:</span> {user.email}</p>
                  <p className="text-sm text-slate-800 dark:text-slate-200"><span className="font-semibold w-20 inline-block text-slate-500 dark:text-slate-400">Роль:</span> <span className='font-medium text-rose-600 dark:text-rose-400'>{user.role === 'admin' ? 'Адміністратор' : 'Менеджер'}</span></p>
              </div>
          )}
      </div>

      {isAdmin && (
        <>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
           <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center"><CurrencyDollarIcon className="w-6 h-6 mr-2 text-green-600"/>Керування курсом валют</h3>
           <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Встановіть курс UAH/$ для всіх товарів або для окремих груп.</p>
           <div className="space-y-4 mb-8 pb-6 border-b border-slate-200 dark:border-slate-700">
              <h4 className="text-md font-semibold text-slate-700 dark:text-slate-200">Глобальне оновлення</h4>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input type="number" placeholder="Наприклад, 40.55" value={globalRate} onChange={(e) => setGlobalRate(e.target.value)} min="0" step="0.01" className="block w-full sm:max-w-xs border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" disabled={isRateLoading.global}/>
                <button onClick={() => handleExchangeRateUpdate()} disabled={isRateLoading.global || !globalRate} className="bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-colors disabled:opacity-50">
                  {isRateLoading.global ? 'Оновлення...' : 'Зберегти для всіх'}
                </button>
              </div>
           </div>
           <h4 className="text-md font-semibold text-slate-700 dark:text-slate-200 mb-4">Індивідуальне оновлення по групах</h4>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {productGroups.map(group => (
               <div key={group} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                  <label htmlFor={`rate-${group}`} className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">{group}</label>
                  <div className="flex items-center space-x-2">
                    <input type="number" id={`rate-${group}`} placeholder="Новий курс" value={groupRates[group] || ''} onChange={(e) => setGroupRates(prev => ({...prev, [group]: e.target.value}))} min="0" step="0.01" className="block w-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/50 text-slate-900 dark:text-slate-200 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2" disabled={isRateLoading[group]}/>
                    <button onClick={() => handleExchangeRateUpdate(group)} disabled={isRateLoading[group] || !groupRates[group]} className="bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold py-2 px-3 rounded-md shadow-sm transition-colors disabled:opacity-50 flex-shrink-0">
                       {isRateLoading[group] ? '...' : 'Зберегти'}
                    </button>
                  </div>
               </div>
             ))}
           </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center"><UsersIcon className="w-6 h-6 mr-2 text-rose-500"/>Керування адміністраторами</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Додавайте та видаляйте користувачів з правами адміністратора.</p>
          <form onSubmit={handleAddAdmin} className="flex flex-col sm:flex-row sm:items-end gap-2 mb-8 pb-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex-grow">
                <label htmlFor="adminEmail" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email нового адміністратора</label>
                <input type="email" id="adminEmail" value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} className="block w-full border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" placeholder="admin@example.com" required disabled={isLoadingAdmins}/>
              </div>
              <button type="submit" className="flex-shrink-0 w-full sm:w-auto flex items-center justify-center bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-colors disabled:opacity-50" disabled={isLoadingAdmins || !newAdminEmail}>
                <PlusIcon className="w-5 h-5 mr-2" /> Додати
              </button>
          </form>
          <h4 className="text-md font-semibold text-slate-700 dark:text-slate-200 mb-4">Список адміністраторів ({admins.length}):</h4>
          {isLoadingAdmins ? <p>Завантаження...</p> : (
            <ul className="space-y-2">
              {admins.map(admin => (
                <li key={admin.email} className="flex flex-col sm:flex-row justify-between sm:items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600 gap-2">
                  <div>
                    <p className="font-medium text-slate-800 dark:text-slate-200 break-all">{admin.email}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Додано: {new Date(admin.created_at).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => handleRemoveAdmin(admin.email)} disabled={isLoadingAdmins || admin.email === user?.email} className="self-end sm:self-center p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:text-slate-400 dark:hover:text-red-400 dark:hover:bg-red-500/10 rounded-md disabled:opacity-50 disabled:cursor-not-allowed" title={admin.email === user?.email ? "Ви не можете видалити себе" : "Видалити адміністратора"}>
                      <TrashIcon className="w-5 h-5"/>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center"><UsersIcon className="w-6 h-6 mr-2 text-indigo-500"/>Керування менеджерами</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Додавайте, редагуйте або видаляйте менеджерів.</p>
          <form onSubmit={handleAddManager} className="space-y-4 mb-8 pb-6 border-b border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input type="text" value={newManagerName} onChange={(e) => setNewManagerName(e.target.value)} placeholder="Ім'я менеджера" required disabled={isLoadingManagers} className="block w-full p-2.5 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg"/>
              <input type="email" value={newManagerEmail} onChange={(e) => setNewManagerEmail(e.target.value)} placeholder="Email менеджера" required disabled={isLoadingManagers} className="block w-full p-2.5 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg"/>
            </div>
            <textarea value={newManagerNotes} onChange={(e) => setNewManagerNotes(e.target.value)} rows={2} placeholder="Нотатки (необов'язково)" disabled={isLoadingManagers} className="block w-full p-2.5 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg"/>
            <button type="submit" className="flex items-center bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm" disabled={isLoadingManagers}>
              <PlusIcon className="w-5 h-5 mr-2" /> {isLoadingManagers ? 'Додавання...' : 'Додати менеджера'}
            </button>
          </form>
          <h4 className="text-md font-semibold text-slate-700 dark:text-slate-200 mb-4">Список менеджерів ({managedUsers.length}):</h4>
          {isLoadingManagers && managedUsers.length === 0 ? <p>Завантаження...</p> : (
            <ul className="space-y-3">
              {managedUsers.map(manager => (
                <li key={manager.id} className="p-4 bg-white dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600 hover:border-indigo-200 dark:hover:border-indigo-500">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                      <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-100">{manager.name}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{manager.email}</p>
                      </div>
                      <div className="flex items-center space-x-2 mt-3 sm:mt-0 self-end sm:self-center">
                          <button onClick={() => openEditModal(manager)} className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 p-2 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-md" aria-label={`Редагувати ${manager.name}`}><PencilIcon className="w-5 h-5"/></button>
                          <button onClick={() => handleRemoveManager(manager.id)} className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md" aria-label={`Видалити ${manager.name}`}><TrashIcon className="w-5 h-5"/></button>
                      </div>
                  </div>
                  {manager.notes && <p className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600 text-sm text-slate-600 dark:text-slate-300">{manager.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
        </>
      )}

      {isEditModalOpen && editingManager && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Редагувати менеджера</h3>
              <button onClick={closeEditModal} disabled={isLoadingManagers}><XMarkIcon className="w-6 h-6 text-slate-400 dark:text-slate-300"/></button>
            </div>
            <form onSubmit={handleUpdateManager} className="space-y-4">
              <div>
                <label htmlFor="editManagerName" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Ім'я</label>
                <input type="text" id="editManagerName" value={currentEditName} onChange={(e) => setCurrentEditName(e.target.value)} required disabled={isLoadingManagers} className="mt-1 block w-full p-2.5 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email (не редагується)</label>
                <p className="mt-1 block w-full p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg">{editingManager.email}</p>
              </div>
              <div>
                <label htmlFor="editManagerNotes" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Нотатки</label>
                <textarea id="editManagerNotes" value={currentEditNotes} onChange={(e) => setCurrentEditNotes(e.target.value)} rows={3} disabled={isLoadingManagers} className="mt-1 block w-full p-2.5 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-200 rounded-lg"/>
              </div>
              <div className="flex justify-end space-x-3 pt-6 border-t border-slate-200 dark:border-slate-700">
                <button type="button" onClick={closeEditModal} className="bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 py-2 px-4 rounded-lg" disabled={isLoadingManagers}>Скасувати</button>
                <button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white py-2 px-4 rounded-lg" disabled={isLoadingManagers}>
                  {isLoadingManagers ? 'Збереження...' : 'Зберегти зміни'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;