

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import { ManagedUser } from '../types';
import { Database } from '../types/supabase'; // Import Supabase DB types
import { PlusIcon, TrashIcon, UsersIcon, PencilIcon, XMarkIcon, CurrencyDollarIcon } from '../components/Icons';
import { authenticatedFetch } from '../utils/api';

const API_BASE_URL = '/api'; // For Netlify functions
type ManagedUserRow = Database['public']['Tables']['managed_users']['Row'];

const productGroups = ['BDR', 'LA', 'АГ', 'АБ', 'АР', 'без сокращений', 'АФ', 'ДС', 'м8', 'JDA', 'Faith', 'AB', 'ГФ', 'ЕС', 'ГП', 'СД', 'ATA', 'W'];

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // State for Manager Management
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newManagerName, setNewManagerName] = useState('');
  const [newManagerEmail, setNewManagerEmail] = useState('');
  const [newManagerNotes, setNewManagerNotes] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingManager, setEditingManager] = useState<ManagedUser | null>(null);
  const [currentEditName, setCurrentEditName] = useState('');
  const [currentEditNotes, setCurrentEditNotes] = useState('');

  // State for Exchange Rate Management
  const [globalRate, setGlobalRate] = useState('');
  const [groupRates, setGroupRates] = useState<Record<string, string>>({});
  const [isRateLoading, setIsRateLoading] = useState<Record<string, boolean>>({});

  // Common State for feedback
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchManagedUsers = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await authenticatedFetch(`${API_BASE_URL}/managedUsers`);
      if (!response.ok) {
        let errorMessage = `Failed to fetch managed users. Status: ${response.status} ${response.statusText}`;
        let responseBodyText = '';
        try {
            responseBodyText = await response.text(); 
            const errData = JSON.parse(responseBodyText); 
            errorMessage = errData.message || `Server error: ${response.status} ${response.statusText}`;
        } catch (jsonError) {
            errorMessage = `Server responded with non-JSON error (${response.status} ${response.statusText}): ${responseBodyText.substring(0, 200)}...`;
            console.error("Full non-JSON error response from server (fetchManagedUsers):", responseBodyText);
        }
        throw new Error(errorMessage);
      }
      const usersFromDb: ManagedUserRow[] = await response.json();
      setManagedUsers(usersFromDb.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        notes: u.notes || undefined,
        dateAdded: u.created_at || new Date().toISOString(), 
      })));
    } catch (err: any) {
      setError(err.message || 'Could not load managed users. Please try again.');
      console.error("Error in fetchManagedUsers:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchManagedUsers();
  }, [fetchManagedUsers]);

  const resetMessages = () => {
    setError(null);
    setSuccessMessage(null);
  }

  const handleAddManager = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!newManagerName.trim() || !newManagerEmail.trim()) {
      setError("Ім'я та email менеджера є обов'язковими.");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(newManagerEmail)) {
      setError("Будь ласка, введіть дійсну адресу електронної пошти.");
      return;
    }
    if (managedUsers.some(u => u.email.toLowerCase() === newManagerEmail.toLowerCase())) {
      setError("Менеджер з таким email вже існує.");
      return;
    }
    setIsLoading(true);
    try {
      const payload = { name: newManagerName.trim(), email: newManagerEmail.trim().toLowerCase(), notes: newManagerNotes.trim() || undefined, added_by_admin_email: user?.email };
      const response = await authenticatedFetch(`${API_BASE_URL}/managedUsers`, { method: 'POST', body: JSON.stringify(payload) });
      if (!response.ok) throw new Error((await response.json()).message || 'Failed to add manager.');
      setSuccessMessage(`Менеджера "${payload.name}" успішно додано.`);
      setNewManagerName(''); setNewManagerEmail(''); setNewManagerNotes('');
      fetchManagedUsers();
    } catch (err: any) {
      setError(err.message || 'Could not add manager.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveManager = async (managerId: string) => {
    if (window.confirm("Ви впевнені, що хочете видалити цього менеджера?")) {
      resetMessages();
      setIsLoading(true);
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/managedUsers/${managerId}`, { method: 'DELETE' });
        if (!response.ok && response.status !== 204) throw new Error((await response.json()).message || 'Failed to delete manager.');
        setSuccessMessage("Менеджера успішно видалено.");
        fetchManagedUsers();
      } catch (err: any) {
        setError(err.message || 'Could not delete manager.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const openEditModal = (manager: ManagedUser) => {
    setEditingManager(manager);
    setCurrentEditName(manager.name);
    setCurrentEditNotes(manager.notes || '');
    setIsEditModalOpen(true);
    resetMessages();
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingManager(null);
    setCurrentEditName('');
    setCurrentEditNotes('');
  };

  const handleUpdateManager = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (!currentEditName.trim()) {
      setError("Ім'я менеджера не може бути порожнім.");
      return;
    }
    if (!editingManager) return;
    setIsLoading(true);
    try {
      const payload = { name: currentEditName.trim(), notes: currentEditNotes.trim() || undefined };
      const response = await authenticatedFetch(`${API_BASE_URL}/managedUsers/${editingManager.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      if (!response.ok) throw new Error((await response.json()).message || 'Failed to update manager.');
      setSuccessMessage(`Дані менеджера "${payload.name}" успішно оновлено.`);
      closeEditModal();
      fetchManagedUsers();
    } catch (err: any) {
      setError(err.message || 'Could not update manager.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExchangeRateUpdate = async (groupName?: string) => {
    resetMessages();
    const rateToUpdate = groupName ? groupRates[groupName] : globalRate;
    if (!rateToUpdate || parseFloat(rateToUpdate) <= 0) {
      setError('Курс повинен бути позитивним числом.');
      return;
    }

    const loadingKey = groupName || 'global';
    setIsRateLoading(prev => ({ ...prev, [loadingKey]: true }));
    try {
      const payload = { newRate: parseFloat(rateToUpdate), ...(groupName && { group: groupName }) };
      const response = await authenticatedFetch(`${API_BASE_URL}/exchangeRates`, { method: 'POST', body: JSON.stringify(payload) });
      if (!response.ok) throw new Error((await response.json()).message || 'Не вдалося оновити курс.');
      
      const { updatedCount } = await response.json();
      setSuccessMessage(`Курс успішно оновлено для ${updatedCount} товарів.`);
      if(groupName) {
        setGroupRates(prev => ({...prev, [groupName]: ''}));
      } else {
        setGlobalRate('');
      }
    } catch (err: any) {
      setError(err.message || 'Не вдалося оновити курс.');
    } finally {
      setIsRateLoading(prev => ({ ...prev, [loadingKey]: false }));
    }
  };


  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Налаштування</h2>
      {error && <div role="alert" className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">{error}</div>}
      {successMessage && <div role="alert" className="mb-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm">{successMessage}</div>}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Інформація про мій обліковий запис</h3>
          {user && (
              <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <p className="text-sm text-slate-800"><span className="font-semibold w-20 inline-block text-slate-500">Ім'я:</span> {user.name}</p>
                  <p className="text-sm text-slate-800"><span className="font-semibold w-20 inline-block text-slate-500">Email:</span> {user.email}</p>
                  <p className="text-sm text-slate-800"><span className="font-semibold w-20 inline-block text-slate-500">Роль:</span> <span className='font-medium text-rose-600'>{user.role === 'admin' ? 'Адміністратор' : 'Менеджер'}</span></p>
              </div>
          )}
      </div>

      {isAdmin && (
        <>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
           <h3 className="text-lg font-semibold text-slate-700 mb-1 flex items-center">
             <CurrencyDollarIcon className="w-6 h-6 mr-2 text-green-600"/>
             Панель Адміністратора: Керування курсом валют
           </h3>
           <p className="text-sm text-slate-500 mb-6">Встановіть курс UAH/$ для всіх товарів або для окремих груп.</p>
           
           <div className="space-y-4 mb-8 pb-6 border-b border-slate-200">
              <h4 className="text-md font-semibold text-slate-700">Глобальне оновлення</h4>
              <p className="text-sm text-slate-500">Встановіть єдиний курс для всіх товарів у всіх групах.</p>
              <div className="flex items-center space-x-2">
                <input type="number" placeholder="Наприклад, 40.55" value={globalRate} onChange={(e) => setGlobalRate(e.target.value)} min="0" step="0.01" className="block w-full max-w-xs border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" disabled={isRateLoading.global}/>
                <button onClick={() => handleExchangeRateUpdate()} disabled={isRateLoading.global || !globalRate} className="bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-colors disabled:opacity-50">
                  {isRateLoading.global ? 'Оновлення...' : 'Зберегти для всіх'}
                </button>
              </div>
           </div>

           <div>
             <h4 className="text-md font-semibold text-slate-700 mb-4">Індивідуальне оновлення по групах</h4>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {productGroups.map(group => (
                 <div key={group} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <label htmlFor={`rate-${group}`} className="block text-sm font-semibold text-slate-700 mb-2">{group}</label>
                    <div className="flex items-center space-x-2">
                      <input type="number" id={`rate-${group}`} placeholder="Новий курс" value={groupRates[group] || ''} onChange={(e) => setGroupRates(prev => ({...prev, [group]: e.target.value}))} min="0" step="0.01" className="block w-full border-slate-300 rounded-md shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2" disabled={isRateLoading[group]}/>
                      <button onClick={() => handleExchangeRateUpdate(group)} disabled={isRateLoading[group] || !groupRates[group]} className="bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold py-2 px-3 rounded-md shadow-sm transition-colors disabled:opacity-50 flex-shrink-0">
                         {isRateLoading[group] ? '...' : 'Зберегти'}
                      </button>
                    </div>
                 </div>
               ))}
             </div>
           </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-700 mb-1 flex items-center">
            <UsersIcon className="w-6 h-6 mr-2 text-rose-500"/>
            Панель Адміністратора: Керування менеджерами
          </h3>
          <p className="text-sm text-slate-500 mb-6">Додавайте, редагуйте або видаляйте менеджерів, які мають доступ до цієї панелі керування.</p>
          
          <form onSubmit={handleAddManager} className="space-y-4 mb-8 pb-6 border-b border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="managerName" className="block text-sm font-medium text-slate-700 mb-1">Ім'я менеджера <span className="text-red-500">*</span></label>
                <input type="text" id="managerName" value={newManagerName} onChange={(e) => setNewManagerName(e.target.value)} className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" placeholder="Наприклад, Іван Петренко" required disabled={isLoading}/>
              </div>
              <div>
                <label htmlFor="managerEmail" className="block text-sm font-medium text-slate-700 mb-1">Email менеджера <span className="text-red-500">*</span></label>
                <input type="email" id="managerEmail" value={newManagerEmail} onChange={(e) => setNewManagerEmail(e.target.value)} className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" placeholder="manager@example.com" required disabled={isLoading}/>
              </div>
            </div>
            <div>
                <label htmlFor="managerNotes" className="block text-sm font-medium text-slate-700 mb-1">Нотатки (необов'язково)</label>
                <textarea id="managerNotes" value={newManagerNotes} onChange={(e) => setNewManagerNotes(e.target.value)} rows={2} className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" placeholder="Додаткова інформація про менеджера..." disabled={isLoading}/>
            </div>
            <button type="submit" className="flex items-center bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors disabled:opacity-50" disabled={isLoading}>
              <PlusIcon className="w-5 h-5 mr-2" />
              {isLoading ? 'Додавання...' : 'Додати менеджера'}
            </button>
          </form>

          <div>
            <h4 className="text-md font-semibold text-slate-700 mb-4">Список доданих менеджерів ({managedUsers.length}):</h4>
            {isLoading && managedUsers.length === 0 && <p className="text-sm text-slate-500">Завантаження менеджерів...</p>}
            {!isLoading && managedUsers.length === 0 && !error && <p className="text-sm text-slate-500">Ще не додано жодного менеджера.</p>}
            {managedUsers.length > 0 && (
              <ul className="space-y-3">
                {managedUsers.map(manager => (
                  <li key={manager.id} className="p-4 bg-white rounded-lg border border-slate-200 hover:border-rose-200 hover:bg-rose-50/20 transition-colors">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                        <div>
                            <p className="font-semibold text-slate-800">{manager.name}</p>
                            <p className="text-sm text-slate-500">{manager.email}</p>
                        </div>
                        <div className="flex items-center space-x-2 mt-3 sm:mt-0 flex-shrink-0">
                            <button onClick={() => openEditModal(manager)} className="text-slate-500 hover:text-rose-600 text-sm font-semibold flex items-center p-2 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-50" aria-label={`Редагувати менеджера ${manager.name}`} disabled={isLoading}>
                                <PencilIcon className="w-4 h-4 mr-1.5"/> Редагувати
                            </button>
                            <button onClick={() => handleRemoveManager(manager.id)} className="text-slate-500 hover:text-red-600 text-sm font-semibold flex items-center p-2 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50" aria-label={`Видалити менеджера ${manager.name}`} disabled={isLoading}>
                                <TrashIcon className="w-4 h-4 mr-1.5"/> Видалити
                            </button>
                        </div>
                    </div>
                    {manager.notes && (
                        <div className="mt-3 pt-3 border-t border-slate-200">
                            <p className="text-xs font-semibold text-slate-500">Нотатки:</p>
                            <p className="text-sm text-slate-600 whitespace-pre-wrap">{manager.notes}</p>
                        </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        </>
      )}

      {isEditModalOpen && editingManager && (
        <div role="dialog" aria-modal="true" aria-labelledby="edit-manager-modal-title" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-lg">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200">
              <h3 id="edit-manager-modal-title" className="text-xl font-semibold text-slate-800">Редагувати менеджера</h3>
              <button onClick={closeEditModal} aria-label="Закрити модальне вікно редагування" disabled={isLoading}><XMarkIcon className="w-6 h-6 text-slate-400 hover:text-slate-600"/></button>
            </div>
            <form onSubmit={handleUpdateManager} className="space-y-4">
              <div>
                <label htmlFor="editManagerName" className="block text-sm font-medium text-slate-700 mb-1">Ім'я менеджера <span className="text-red-500">*</span></label>
                <input type="text" id="editManagerName" value={currentEditName} onChange={(e) => setCurrentEditName(e.target.value)} className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" required disabled={isLoading}/>
              </div>
              <div>
                <p className="block text-sm font-medium text-slate-700 mb-1">Email менеджера (не редагується)</p>
                <p className="block w-full border-slate-200 rounded-lg bg-slate-100 sm:text-sm p-2.5 text-slate-500">{editingManager.email}</p>
              </div>
              <div>
                <label htmlFor="editManagerNotes" className="block text-sm font-medium text-slate-700 mb-1">Нотатки</label>
                <textarea id="editManagerNotes" value={currentEditNotes} onChange={(e) => setCurrentEditNotes(e.target.value)} rows={3} className="block w-full border-slate-300 rounded-lg shadow-sm focus:ring-rose-500 focus:border-rose-500 sm:text-sm p-2.5" disabled={isLoading}/>
              </div>
              <div className="flex justify-end space-x-3 pt-6 border-t border-slate-200">
                <button type="button" onClick={closeEditModal} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors" disabled={isLoading}>Скасувати</button>
                <button type="submit" className="bg-rose-500 hover:bg-rose-600 text-white font-semibold py-2 px-4 rounded-lg shadow-sm transition-colors disabled:opacity-50" disabled={isLoading}>
                  {isLoading ? 'Збереження...' : 'Зберегти зміни'}
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
