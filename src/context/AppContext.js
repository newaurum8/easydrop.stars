import React, { createContext, useState, useCallback, useEffect } from 'react';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
    // --- СОСТОЯНИЕ ---
    const [ALL_PRIZES, setAllPrizes] = useState([]);
    const [cases, setCases] = useState([]);
    const [isConfigLoaded, setIsConfigLoaded] = useState(false);

    const [user, setUser] = useState(null);
    const [balance, setBalance] = useState(0);
    const [inventory, setInventory] = useState([]);
    const [history, setHistory] = useState([]);
    const [withdrawals, setWithdrawals] = useState([]); 
    const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);

    // Вспомогательная функция для заголовков
    const getAuthHeaders = () => {
        const headers = { 'Content-Type': 'application/json' };
        if (window.Telegram?.WebApp?.initData) {
            headers['x-telegram-init-data'] = window.Telegram.WebApp.initData;
        }
        return headers;
    };

    // 1. ЗАГРУЗКА КОНФИГА
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

    // 2. ФУНКЦИЯ ЗАГРУЗКИ ВЫВОДОВ
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

    // 3. ИНИЦИАЛИЗАЦИЯ ПОЛЬЗОВАТЕЛЯ
    useEffect(() => {
        const initUser = async () => {
            // Если открыто не в Telegram, используем заглушку (только если сервер в dev режиме разрешает)
            // В продакшене сервер отклонит запрос без initData
            
            try {
                // Синхронизация при входе
                const res = await fetch('/api/user/sync', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({}) // Тело пустое, сервер берет данные из initData
                });

                if (res.ok) {
                    const userData = await res.json();
                    setUser(userData); 
                    setBalance(userData.balance ?? 0);
                    // Сервер возвращает уже готовый массив инвентаря
                    setInventory(userData.inventory || []);
                    setHistory(userData.history || []);
                    fetchWithdrawals(userData.id);
                }
            } catch (err) { console.error("User sync error:", err); }
        };

        if (isConfigLoaded) {
            initUser();
        }
    }, [isConfigLoaded, fetchWithdrawals]);

    // --- БЕЗОПАСНЫЕ ДЕЙСТВИЯ (ЧЕРЕЗ API) ---

    // Открытие кейса (Серверная логика)
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
                // Обновляем баланс и добавляем предметы, которые вернул сервер
                setBalance(data.newBalance);
                
                // Добавляем новые предметы в инвентарь локально (сервер вернул их с UUID)
                setInventory(prev => [...data.wonItems, ...prev]);
                
                // Добавляем в историю (фейковая дата для мгновенного отображения)
                const newHistory = data.wonItems.map(item => ({...item, date: new Date().toISOString()}));
                setHistory(prev => [...newHistory, ...prev].slice(0, 50));
                
                return { success: true, wonItems: data.wonItems };
            } else {
                return { success: false, error: data.error };
            }
        } catch (e) {
            console.error(e);
            return { success: false, error: e.message };
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
                // Обновляем инвентарь (удаляем проданный предмет)
                setInventory(prev => prev.filter(item => item.inventoryId !== inventoryId));
                return true;
            }
        } catch (e) { console.error("Sell error:", e); }
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
                setInventory([]);
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
                 // Убираем старый предмет, добавляем новый
                 setInventory(prev => {
                     const filtered = prev.filter(i => i.inventoryId !== sourceItemId);
                     return [data.newItem, ...filtered]; 
                 });
                 
                 // Добавляем в историю
                 setHistory(prev => [{...data.newItem, date: new Date().toISOString()}, ...prev].slice(0, 50));
                 
                 return { success: true, newItem: data.newItem };
            } else {
                 // Если неудача, просто убираем предмет (сервер уже сжег его)
                 setInventory(prev => prev.filter(i => i.inventoryId !== sourceItemId));
                 return { success: false };
            }
        } catch (e) { 
            console.error(e); 
            return { success: false, error: true }; 
        }
    }, [user]);

    // Вывод
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
                setInventory(prev => prev.filter(i => i.inventoryId !== itemInventoryId));
                fetchWithdrawals(user.id);
                return true;
            } else {
                alert("Ошибка: " + data.error);
            }
        } catch (e) { console.error(e); }
        return false;
    }, [user, fetchWithdrawals]);

    // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (UI Helpers) ---
    
    // Используется только для визуализации рулетки (логика теперь на сервере)
    const getWeightedRandomPrize = useCallback((prizes) => {
        const prizePool = prizes || ALL_PRIZES;
        const totalChance = prizePool.reduce((sum, prize) => sum + prize.chance, 0);
        let random = Math.random() * totalChance;
        for (const prize of prizePool) {
            if (random < prize.chance) return prize;
            random -= prize.chance;
        }
        return prizePool[prizePool.length - 1];
    }, [ALL_PRIZES]);

    // Используется только для отображения шанса в UI апгрейда
    const getUpgradeResult = (sourceItem, targetItem) => {
        if (!sourceItem || !targetItem) return { success: false, chance: 0 };
        const chance = Math.min(Math.max((sourceItem.value / targetItem.value) * 50, 1), 95);
        return { success: false, chance: chance }; 
    };

    // Устаревшие методы (оставлены как заглушки или для локальных обновлений, если нужно)
    const updateBalance = useCallback((amount) => { setBalance(prev => prev + amount); }, []);
    const addToInventory = useCallback((items) => { setInventory(prev => [...items, ...prev]); }, []);
    const removeFromInventory = useCallback((id) => { setInventory(prev => prev.filter(i => i.inventoryId !== id)); }, []);
    const addToHistory = useCallback((items) => { setHistory(prev => [...items, ...prev]); }, []);

    const openTopUpModal = () => setIsTopUpModalOpen(true);
    const closeTopUpModal = () => setIsTopUpModalOpen(false);

    const value = {
        user, balance, inventory, history, withdrawals,
        ALL_PRIZES, ALL_CASES: cases, isConfigLoaded,
        refreshConfig,
        
        // Новые безопасные методы
        spinCase,
        sellItem, 
        sellAllItems, 
        performUpgrade, 
        requestWithdrawal,
        
        // UI Helpers
        getWeightedRandomPrize,
        getUpgradeResult,
        
        // State Modifiers (Legacy support)
        updateBalance, 
        addToInventory, 
        removeFromInventory, 
        addToHistory,
        
        isTopUpModalOpen, openTopUpModal, closeTopUpModal
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
