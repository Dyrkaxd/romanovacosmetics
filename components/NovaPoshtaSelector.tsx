





import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { authenticatedFetch } from '../utils/api';
import { NovaPoshtaDepartment } from '../types';
import { XMarkIcon, SearchIcon } from './Icons';

interface NpCity {
  Ref: string;
  Description: string;
  AreaDescription?: string;
}

interface NpDepartment {
  Ref: string;
  Description: string;
  Number: string;
  SettlementDescription: string;
  CityRef: string; // The API returns this
}

interface NovaPoshtaSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (department: NovaPoshtaDepartment) => void;
}

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

const NovaPoshtaSelector: React.FC<NovaPoshtaSelectorProps> = ({ isOpen, onClose, onSelect }) => {
  const [citySearch, setCitySearch] = useState('');
  const [departmentSearch, setDepartmentSearch] = useState('');
  
  const [cities, setCities] = useState<NpCity[]>([]);
  const [allDepartments, setAllDepartments] = useState<NpDepartment[]>([]);

  const [selectedCity, setSelectedCity] = useState<NpCity | null>(null);
  
  const [isCityLoading, setIsCityLoading] = useState(false);
  const [isDepartmentLoading, setIsDepartmentLoading] = useState(false);
  
  const [error, setError] = useState<string | null>(null);

  const debouncedCitySearch = useDebounce(citySearch, 300);
  
  const cityInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
      if (isOpen) {
          // Reset state when modal opens
          setCitySearch('');
          setDepartmentSearch('');
          setCities([]);
          setAllDepartments([]);
          setSelectedCity(null);
          setError(null);
          // Focus the first input
          setTimeout(() => cityInputRef.current?.focus(), 100);
      }
  }, [isOpen]);

  const fetchCities = useCallback(async (query: string) => {
    if (query.length < 2) {
      setCities([]);
      return;
    }
    setIsCityLoading(true);
    setError(null);
    try {
      const res = await authenticatedFetch(`/api/novaPoshtaSearch?type=cities&query=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Помилка пошуку міста');
      const data = await res.json();
      setCities(data);
    } catch (err: any) {
      setError(err.message);
      setCities([]);
    } finally {
      setIsCityLoading(false);
    }
  }, []);

  const fetchAllDepartmentsForCity = useCallback(async (cityRef: string) => {
    setIsDepartmentLoading(true);
    setError(null);
    setAllDepartments([]);
    try {
        // This endpoint now fetches ALL departments, ignoring any query.
        const res = await authenticatedFetch(`/api/novaPoshtaSearch?type=departments&cityRef=${encodeURIComponent(cityRef)}`);
        if (!res.ok) throw new Error('Помилка завантаження відділень');
        const data = await res.json();
        setAllDepartments(data);
    } catch (err: any) {
        setError(err.message);
        setAllDepartments([]);
    } finally {
        setIsDepartmentLoading(false);
    }
  }, []);

  useEffect(() => {
      fetchCities(debouncedCitySearch);
  }, [debouncedCitySearch, fetchCities]);

  const handleCitySelect = (city: NpCity) => {
    setSelectedCity(city);
    setCitySearch(city.Description);
    setCities([]); // Hide city results
    fetchAllDepartmentsForCity(city.Ref); // Fetch all departments for the selected city
  };
  
  const filteredDepartments = useMemo(() => {
      if (!departmentSearch) {
          return allDepartments;
      }
      const lowercasedQuery = departmentSearch.toLowerCase();
      return allDepartments.filter(dep => 
          dep.Description.toLowerCase().includes(lowercasedQuery)
      );
  }, [departmentSearch, allDepartments]);

  const handleDepartmentSelect = (department: NpDepartment) => {
    // Construct the final department object conforming to the NovaPoshtaDepartment type
    const finalDepartment: NovaPoshtaDepartment = {
      ref: department.Ref,
      name: department.Description,
      settlementName: department.SettlementDescription,
      departmentNumber: department.Number,
      cityRef: department.CityRef,
    };
    onSelect(finalDepartment);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-xl font-semibold text-slate-800">Вибір відділення Нової Пошти</h3>
          <button type="button" onClick={onClose}><XMarkIcon className="w-6 h-6 text-slate-500 hover:text-slate-700"/></button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto">
            {error && <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>}
            
            {/* Step 1: City Search */}
            <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-1">1. Знайдіть місто</label>
                <div className="relative">
                    <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 transform -translate-y-1/2"/>
                    <input
                        ref={cityInputRef}
                        type="text"
                        placeholder="Наприклад, Київ"
                        value={citySearch}
                        onChange={(e) => setCitySearch(e.target.value)}
                        className="w-full p-2.5 pl-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                        disabled={!!selectedCity}
                    />
                     {selectedCity && (
                        <button onClick={() => { setSelectedCity(null); setCitySearch(''); setAllDepartments([]); setDepartmentSearch('')}} className="absolute top-1/2 right-3 transform -translate-y-1/2 text-slate-500 hover:text-slate-800">
                           <XMarkIcon className="w-5 h-5"/>
                        </button>
                    )}
                </div>
                {isCityLoading && <div className="p-2 text-sm text-slate-500">Пошук...</div>}
                {cities.length > 0 && !selectedCity && (
                    <ul className="absolute top-full left-0 w-full bg-white border border-slate-300 rounded-b-lg shadow-lg max-h-60 overflow-y-auto z-10 mt-1">
                        {cities.map(city => (
                            <li key={city.Ref} onClick={() => handleCitySelect(city)} className="p-3 hover:bg-rose-50 cursor-pointer">
                                <p className="font-medium text-slate-800">{city.Description}</p>
                                {city.AreaDescription && <p className="text-sm text-slate-500">{city.AreaDescription} область</p>}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            
            {/* Step 2: Department Search */}
            {selectedCity && (
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">2. Знайдіть відділення або поштомат</label>
                    <div className="relative">
                       <SearchIcon className="w-5 h-5 text-slate-400 absolute top-1/2 left-3 transform -translate-y-1/2"/>
                       <input
                           type="text"
                           placeholder="Введіть номер або адресу..."
                           value={departmentSearch}
                           onChange={(e) => setDepartmentSearch(e.target.value)}
                           className="w-full p-2.5 pl-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                           autoFocus
                       />
                   </div>
                    {isDepartmentLoading ? (
                        <div className="p-4 text-center text-slate-500">Завантаження відділень...</div>
                    ) : (
                       <div className="border border-slate-200 rounded-lg mt-2 max-h-64 overflow-y-auto">
                           {filteredDepartments.length > 0 ? (
                              <ul className="divide-y divide-slate-200">
                                   {filteredDepartments.map(dep => (
                                       <li key={dep.Ref} onClick={() => handleDepartmentSelect(dep)} className="p-3 hover:bg-rose-50 cursor-pointer">
                                          <p className="font-medium text-slate-800">{dep.Description}</p>
                                       </li>
                                   ))}
                               </ul>
                           ) : (
                               <p className="p-4 text-center text-slate-500">
                                   {departmentSearch ? 'Відділень не знайдено.' : `Знайдено ${allDepartments.length} відділень. Почніть пошук.`}
                               </p>
                           )}
                       </div>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default NovaPoshtaSelector;