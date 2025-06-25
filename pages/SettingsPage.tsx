
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import { ManagedUser } from '../types';
import { Database } from '../types/supabase'; // Import Supabase DB types
import { PlusIcon, TrashIcon, UsersIcon, PencilIcon, XMarkIcon } from '../components/Icons';

const API_BASE_URL = '/api'; // For Netlify functions
type ManagedUserRow = Database['public']['Tables']['managed_users']['Row'];

const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [newManagerName, setNewManagerName] = useState('');
  const [newManagerEmail, setNewManagerEmail] = useState('');
  const [newManagerNotes, setNewManagerNotes] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingManager, setEditingManager] = useState<ManagedUser | null>(null);
  const [currentEditName, setCurrentEditName] = useState('');
  const [currentEditNotes, setCurrentEditNotes] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchManagedUsers = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/managed-users`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to fetch managed users.'}));
        throw new Error(errData.message);
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
      setError(err.message || 'Could not load managed users.');
      console.error(err);
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
      const payload = {
        name: newManagerName.trim(),
        email: newManagerEmail.trim().toLowerCase(),
        notes: newManagerNotes.trim() || undefined,
        added_by_admin_email: user?.email // Store admin email
      };
      const response = await fetch(`${API_BASE_URL}/managed-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to add manager.'}));
        throw new Error(errData.message);
      }
      // const newManager: ManagedUser = await response.json(); // DB returns full object with ID and created_at
      setSuccessMessage(`Менеджера "${payload.name}" успішно додано.`);
      setNewManagerName('');
      setNewManagerEmail('');
      setNewManagerNotes('');
      fetchManagedUsers(); // Refresh list
    } catch (err: any) {
      setError(err.message || 'Could not add manager.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveManager = async (managerId: string) => {
    if (window.confirm("Ви впевнені, що хочете видалити цього менеджера?")) {
      resetMessages();
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/managed-users/${managerId}`, {
          method: 'DELETE',
        });
        if (!response.ok && response.status !== 204) { // 204 is success no content
          const errData = await response.json().catch(() => ({ message: 'Failed to delete manager.'}));
          throw new Error(errData.message);
        }
        setSuccessMessage("Менеджера успішно видалено.");
        fetchManagedUsers(); // Refresh list
      } catch (err: any) {
        setError(err.message || 'Could not delete manager.');
        console.error(err);
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
      const payload = {
        name: currentEditName.trim(),
        notes: currentEditNotes.trim() || undefined,
        // email is not editable through this flow
      };
      const response = await fetch(`${API_BASE_URL}/managed-users/${editingManager.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ message: 'Failed to update manager.'}));
        throw new Error(errData.message);
      }
      setSuccessMessage(`Дані менеджера "${payload.name}" успішно оновлено.`);
      closeEditModal();
      fetchManagedUsers(); // Refresh list
    } catch (err: any) {
      setError(err.message || 'Could not update manager.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="space-y-8 p-4 md:p-6">
      <h2 className="text-2xl font-semibold text-slate-800">Налаштування</h2>

      {isAdmin && (
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-xl font-semibold text-slate-700 mb-1 flex items-center">
            <UsersIcon className="w-6 h-6 mr-2 text-indigo-600"/>
            Панель Адміністратора: Керування менеджерами
          </h3>
          <p className="text-sm text-slate-500 mb-6">Додавайте, редагуйте або видаляйте менеджерів, які мають доступ до цієї панелі керування.</p>
          
          {error && <div role="alert" className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md text-sm">{error}</div>}
          {successMessage && <div role="alert" className="mb-4 p-3 bg-green-100 text-green-700 border border-green-300 rounded-md text-sm">{successMessage}</div>}

          <form onSubmit={handleAddManager} className="space-y-4 mb-8 pb-6 border-b border-slate-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="managerName" className="block text-sm font-medium text-slate-700">Ім'я менеджера <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  id="managerName"
                  value={newManagerName}
                  onChange={(e) => setNewManagerName(e.target.value)}
                  className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                  placeholder="Наприклад, Іван Петренко"
                  required
                  disabled={isLoading}
                />
              </div>
              <div>
                <label htmlFor="managerEmail" className="block text-sm font-medium text-slate-700">Email менеджера <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  id="managerEmail"
                  value={newManagerEmail}
                  onChange={(e) => setNewManagerEmail(e.target.value)}
                  className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                  placeholder="manager@example.com"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
            <div>
                <label htmlFor="managerNotes" className="block text-sm font-medium text-slate-700">Нотатки (необов'язково)</label>
                <textarea
                  id="managerNotes"
                  value={newManagerNotes}
                  onChange={(e) => setNewManagerNotes(e.target.value)}
                  rows={2}
                  className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                  placeholder="Додаткова інформація про менеджера..."
                  disabled={isLoading}
                />
            </div>
            <button
              type="submit"
              className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg shadow-md transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              {isLoading ? 'Додавання...' : 'Додати менеджера'}
            </button>
          </form>

          <div>
            <h4 className="text-lg font-medium text-slate-700 mb-4">Список доданих менеджерів ({managedUsers.length}):</h4>
            {isLoading && managedUsers.length === 0 && <p className="text-sm text-slate-500">Завантаження менеджерів...</p>}
            {!isLoading && managedUsers.length === 0 && !error && <p className="text-sm text-slate-500">Ще не додано жодного менеджера.</p>}
            {managedUsers.length > 0 && (
              <ul className="space-y-3">
                {managedUsers.map(manager => (
                  <li key={manager.id} className="p-3 bg-slate-50 rounded-md border border-slate-200">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-2">
                        <div>
                            <p className="font-medium text-slate-800">{manager.name}</p>
                            <p className="text-sm text-slate-600">{manager.email}</p>
                            <p className="text-xs text-slate-400">Додано: {new Date(manager.dateAdded).toLocaleDateString()}</p>
                        </div>
                        <div className="flex space-x-2 mt-2 sm:mt-0">
                            <button
                                onClick={() => openEditModal(manager)}
                                className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center p-2 hover:bg-indigo-100 rounded-md transition-colors disabled:opacity-50"
                                aria-label={`Редагувати менеджера ${manager.name}`}
                                disabled={isLoading}
                            >
                                <PencilIcon className="w-4 h-4 mr-1"/> Редагувати
                            </button>
                            <button
                                onClick={() => handleRemoveManager(manager.id)}
                                className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center p-2 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50"
                                aria-label={`Видалити менеджера ${manager.name}`}
                                disabled={isLoading}
                            >
                                <TrashIcon className="w-4 h-4 mr-1"/> Видалити
                            </button>
                        </div>
                    </div>
                    {manager.notes && (
                        <div className="mt-1 pt-2 border-t border-slate-200">
                            <p className="text-xs font-semibold text-slate-600">Нотатки:</p>
                            <p className="text-xs text-slate-500 whitespace-pre-wrap">{manager.notes}</p>
                        </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {isEditModalOpen && editingManager && (
        <div role="dialog" aria-modal="true" aria-labelledby="edit-manager-modal-title" className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 id="edit-manager-modal-title" className="text-lg font-semibold text-slate-800">Редагувати менеджера</h3>
              <button onClick={closeEditModal} aria-label="Закрити модальне вікно редагування" disabled={isLoading}><XMarkIcon className="w-6 h-6 text-slate-500 hover:text-slate-700"/></button>
            </div>
            {error && <div role="alert" className="mb-3 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md text-sm">{error}</div>}
            <form onSubmit={handleUpdateManager} className="space-y-4">
              <div>
                <label htmlFor="editManagerName" className="block text-sm font-medium text-slate-700">Ім'я менеджера <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  id="editManagerName"
                  value={currentEditName}
                  onChange={(e) => setCurrentEditName(e.target.value)}
                  className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                  required
                  disabled={isLoading}
                />
              </div>
              <div>
                <p className="block text-sm font-medium text-slate-700">Email менеджера (не редагується)</p>
                <p className="mt-1 block w-full border-slate-300 rounded-md shadow-sm bg-slate-100 sm:text-sm p-2 text-slate-500">{editingManager.email}</p>
              </div>
              <div>
                <label htmlFor="editManagerNotes" className="block text-sm font-medium text-slate-700">Нотатки</label>
                <textarea
                  id="editManagerNotes"
                  value={currentEditNotes}
                  onChange={(e) => setCurrentEditNotes(e.target.value)}
                  rows={3}
                  className="mt-1 block w-full border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2"
                  disabled={isLoading}
                />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button 
                  type="button" 
                  onClick={closeEditModal}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-4 rounded-md shadow-sm transition-colors"
                  disabled={isLoading}
                >
                  Скасувати
                </button>
                <button 
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-md shadow-sm transition-colors disabled:opacity-50"
                  disabled={isLoading}
                >
                  {isLoading ? 'Збереження...' : 'Зберегти зміни'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!isAdmin && (
         <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-xl font-semibold text-slate-700 mb-4">Мої налаштування</h3>
            <p className="text-slate-600">Ваша інформація облікового запису:</p>
            {user && (
                <div className="mt-4 p-4 bg-slate-50 rounded-md border">
                    <p className="text-sm text-slate-700"><span className="font-medium">Ім'я:</span> {user.name}</p>
                    <p className="text-sm text-slate-700"><span className="font-medium">Email:</span> {user.email}</p>
                    <p className="text-sm text-slate-700"><span className="font-medium">Роль:</span> {user.role === 'admin' ? 'Адміністратор' : 'Менеджер'}</p>
                </div>
            )}
         </div>
      )}
       {isAdmin && user && (
         <div className="bg-white p-6 rounded-xl shadow-lg mt-8">
            <h3 className="text-xl font-semibold text-slate-700 mb-4">Інформація про поточного користувача (Адміністратор)</h3>
             <div className="mt-4 p-4 bg-slate-50 rounded-md border">
                <p className="text-sm text-slate-700"><span className="font-medium">Ім'я:</span> {user.name}</p>
                <p className="text-sm text-slate-700"><span className="font-medium">Email:</span> {user.email}</p>
                <p className="text-sm text-slate-700"><span className="font-medium">Роль:</span> {user.role === 'admin' ? 'Адміністратор' : 'Менеджер'}</p>
            </div>
         </div>
      )}
    </div>
  );
};

export default SettingsPage;