import React, { createContext, useState, useCallback, useEffect } from 'react';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
    // --- СОСТОЯНИЕ ---
    const [ALL_PRIZES, setAllPrizes] = useState([]);
    const [cases, setCases] = useState([]);
    const [isConfigLoaded, setIsConfigLoaded] = useState(false);

    // Начальное состояние - null. Пока оно null, приложение не знает, кто вы.
    const [user, setUser] = useState(null);
    const [balance, setBalance] = useState(0);
    const [inventory, setInventory] = useState([]);
    const [history, setHistory] = useState([]);
    const [withdrawals, setWithdrawals] = useState([]); 
    const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);

    // === НОВАЯ ЛОГИКА ТЕМЫ ===
    // Читаем из localStorage или ставим 'dark' по умолчанию
    const [theme, setTheme] = useState(localStorage.getItem('app_theme') || 'dark');

    const toggleTheme = useCallback(() => {
        setTheme(prev => {
            const newTheme = prev === 'dark' ? 'light' : 'dark';
            localStorage.setItem('app_theme', newTheme);
            return newTheme;
        });
    }, []);

    // Применяем атрибут data-theme к html при изменении стейта
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);
    // ========================

    // --- АВТОРИЗАЦИЯ ---
    // Формируем заголовки для каждого запроса
    const getAuthHeaders = () => {
        const headers = { 'Content-Type': 'application/json' };
        // Если приложение открыто в Telegram, добавляем initData для проверки на сервере
        if (window.Telegram?.WebApp?.initData) {
            headers['x-telegram-init-data'] = window.Telegram.WebApp.initData;
        }
        return headers;
    };

    // 1. ЗАГРУЗКА КОНФИГА (Список призов и кейсов)
    const refreshConfig = useCallback(() => {
        fetch('/api/config')
            .then(res => res.json())
            .then(data => {
                setAllPrizes(data.prizes || []);
                setCases(data.cases || []);
                setIsConfigLoaded(true);
            })
            .catch(err => console.error("Config fetch error:", err));
    }, []);

    useEffect(() => { refreshConfig(); }, [refreshConfig]);

    // 2. ЗАГРУЗКА ИСТОРИИ ВЫВОДОВ
    const fetchWithdrawals = useCallback(async (userId) => {
        if (!userId) return;
        try {
            const res = await fetch(`/api/user/withdrawals/${userId}`);
            if (res.ok) {
                const data = await res.json();
                setWithdrawals(data);
            }
        } catch (e) { console.error(e); }
    }, []);

    // 3. ГЛАВНАЯ ИНИЦИАЛИЗАЦИЯ ПОЛЬЗОВАТЕЛЯ
    useEffect(() => {
        const initUser = async () => {
            // Проверяем, доступны ли данные Телеграм
            if (!window.Telegram?.WebApp?.initData) {
                console.warn("⚠️ Нет данных Telegram. Если вы в браузере — авторизация не пройдет (если сервер в prod).");
                return;
            }

            try {
                // Отправляем запрос синхронизации
                const res = await fetch('/api/user/sync', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({}) // Тело пустое, сервер берет данные из заголовка
                });

                if (res.ok) {
                    const userData = await res.json();
                    console.log("✅ User loaded:", userData.username);
                    
                    setUser(userData); 
                    setBalance(userData.balance ?? 0);
                    // Сервер теперь возвращает готовый массив объектов (а не JSON-строку)
                    setInventory(userData.inventory || []);
                    setHistory(userData.history || []);
                    
                    fetchWithdrawals(userData.id);
                } else {
                    // Обработка ошибки авторизации
                    const errorText = await res.text();
                    console.error("Auth failed:", res.status, errorText);
                    alert(`Ошибка входа (${res.status}): ${errorText}`);
                }
            } catch (err) { 
                console.error("Network sync error:", err);
                alert("Ошибка соединения с сервером.");
            }
        };

        if (isConfigLoaded) {
            initUser();
        }
    }, [isConfigLoaded, fetchWithdrawals]);

    // --- ДЕЙСТВИЯ (ВЫЗОВ СЕРВЕРА) ---

    // Открытие кейса
    const spinCase = useCallback(async (caseId, quantity) => {
        if (!user) return { success: false, error: 'User not loaded' };
        
        try {
            const res = await fetch('/api/case/spin', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ caseId, quantity })
            });
            const data = await res.json();
            
            if (data.success) {
                // Обновляем баланс
                setBalance(data.newBalance);
                
                // Добавляем новые предметы в начало инвентаря
                setInventory(prev => [...data.wonItems, ...prev]);
                
                // Добавляем в локальную историю
                const newHistoryItems = data.wonItems.map(item => ({
                    ...item, 
                    date: new Date().toISOString()
                }));
                setHistory(prev => [...newHistoryItems, ...prev].slice(0, 50));
                
                return { success: true, wonItems: data.wonItems };
            } else {
                return { success: false, error: data.error };
            }
        } catch (e) {
            console.error(e);
            return { success: false, error: "Ошибка сети" };
        }
    }, [user]);

    // Продажа одного предмета
    const sellItem = useCallback(async (inventoryId) => {
        if (!user) return;
        try {
            const res = await fetch('/api/user/sell-item', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ inventoryId })
            });
            const data = await res.json();
            
            if (data.success) {
                setBalance(data.newBalance);
                // Удаляем предмет из локального инвентаря по ID
                setInventory(prev => prev.filter(item => item.inventoryId !== inventoryId));
                return true;
            } else {
                console.error("Sell failed:", data.error);
            }
        } catch (e) { console.error("Sell network error:", e); }
        return false;
    }, [user]);

    // Продажа всего
    const sellAllItems = useCallback(async () => {
        if (!user) return;
        try {
            const res = await fetch('/api/user/sell-all', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({})
            });
            const data = await res.json();
            if (data.success) {
                setInventory([]); // Очищаем локально
                setBalance(data.newBalance);
            }
        } catch (e) { console.error(e); }
    }, [user]);

    // Апгрейд
    const performUpgrade = useCallback(async (sourceItemId, targetItem) => {
        if (!user) return { success: false };
        
        try {
            const res = await fetch('/api/user/upgrade', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ 
                    inventoryId: sourceItemId, 
                    targetItemId: targetItem.id 
                })
            });
            
            const data = await res.json();
            
            if (data.success) {
                 // Успех: убираем старый, добавляем новый
                 setInventory(prev => {
                     // Фильтруем старый
                     const filtered = prev.filter(i => i.inventoryId !== sourceItemId);
                     // Добавляем новый в начало
                     return [data.newItem, ...filtered]; 
                 });
                 
                 // Добавляем в историю
                 setHistory(prev => [{...data.newItem, date: new Date().toISOString()}, ...prev].slice(0, 50));
                 
                 return { success: true, newItem: data.newItem };
            } else {
                 // Неудача: просто убираем старый предмет (он сгорел)
                 setInventory(prev => prev.filter(i => i.inventoryId !== sourceItemId));
                 return { success: false };
            }
        } catch (e) { 
            console.error(e); 
            return { success: false, error: true }; 
        }
    }, [user]);

    // Запрос на вывод
    const requestWithdrawal = useCallback(async (itemInventoryId, targetUsername) => {
        if (!user) return;
        try {
            const res = await fetch('/api/withdraw/request', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ itemInventoryId, targetUsername })
            });
            const data = await res.json();
            
            if (data.success) {
                // Удаляем из инвентаря
                setInventory(prev => prev.filter(i => i.inventoryId !== itemInventoryId));
                // Обновляем список выводов
                fetchWithdrawals(user.id);
                return true;
            } else {
                alert("Ошибка: " + (data.error || "Неизвестная ошибка"));
            }
        } catch (e) { console.error(e); }
        return false;
    }, [user, fetchWithdrawals]);

    // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
    
    // Используется ТОЛЬКО для визуализации прокрутки (фейковый выбор для анимации)
    const getWeightedRandomPrize = useCallback((prizes) => {
        const prizePool = prizes || ALL_PRIZES;
        if (!prizePool.length) return null;
        const randomIndex = Math.floor(Math.random() * prizePool.length);
        return prizePool[randomIndex];
    }, [ALL_PRIZES]);

    // Используется для отображения шанса в интерфейсе апгрейда
    const getUpgradeResult = (sourceItem, targetItem) => {
        if (!sourceItem || !targetItem) return { success: false, chance: 0 };
        const chance = Math.min(Math.max((sourceItem.value / targetItem.value) * 50, 1), 95);
        return { success: false, chance: chance }; 
    };

    // Обертки для модалки
    const openTopUpModal = () => setIsTopUpModalOpen(true);
    const closeTopUpModal = () => setIsTopUpModalOpen(false);

    // Устаревшие методы (для совместимости)
    const updateBalance = (amount) => setBalance(prev => prev + amount);
    const addToInventory = (items) => setInventory(prev => [...prev, ...items]);
    const removeFromInventory = (id) => setInventory(prev => prev.filter(i => i.inventoryId !== id));
    const addToHistory = (items) => setHistory(prev => [...items, ...prev]);

    const value = {
        user, balance, inventory, history, withdrawals,
        ALL_PRIZES, ALL_CASES: cases, isConfigLoaded,
        refreshConfig,
        
        // Основные методы API
        spinCase,
        sellItem, 
        sellAllItems, 
        performUpgrade, 
        requestWithdrawal,
        
        // UI Helpers
        getWeightedRandomPrize,
        getUpgradeResult,
        
        // Legacy state helpers
        updateBalance, addToInventory, removeFromInventory, addToHistory,
        
        // Modals
        isTopUpModalOpen, openTopUpModal, closeTopUpModal,

        // Theme
        theme, toggleTheme
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
