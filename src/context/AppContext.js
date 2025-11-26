import React, { createContext, useState, useCallback, useEffect } from 'react';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [ALL_PRIZES, setAllPrizes] = useState([]);
    const [cases, setCases] = useState([]);
    const [isConfigLoaded, setIsConfigLoaded] = useState(false);

    const [user, setUser] = useState(null);
    const [balance, setBalance] = useState(0);
    const [inventory, setInventory] = useState([]);
    const [history, setHistory] = useState([]);
    const [withdrawals, setWithdrawals] = useState([]); 
    const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);

    // 1. Загрузка конфига (призы, кейсы)
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

    // 2. Функция загрузки выводов
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

    // 3. Инициализация пользователя
    useEffect(() => {
        const initUser = async () => {
            let tgUser = null;
            if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
                tgUser = window.Telegram.WebApp.initDataUnsafe.user;
            } else {
                tgUser = { id: 123456789, first_name: 'Test', username: 'browser_user', photo_url: null };
            }

            try {
                const res = await fetch('/api/user/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: tgUser.id,
                        first_name: tgUser.first_name,
                        username: tgUser.username,
                        photo_url: tgUser.photo_url
                    })
                });

                if (res.ok) {
                    const userData = await res.json();
                    setUser(userData); 
                    setBalance(userData.balance ?? 0);
                    setInventory(userData.inventory || []);
                    setHistory(userData.history || []);
                    fetchWithdrawals(userData.id);
                }
            } catch (err) { console.error("User sync error:", err); }
        };

        if (isConfigLoaded) initUser();
    }, [isConfigLoaded, fetchWithdrawals]);

    // 4. Сохранение данных (при изменении инвентаря/баланса)
    useEffect(() => {
        if (!user) return;
        // Дебаунс 1 секунда, чтобы не спамить сервер при быстрой продаже
        const timer = setTimeout(() => {
            fetch('/api/user/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: user.id,
                    balance,
                    inventory,
                    history
                })
            }).catch(e => console.error("Save error:", e));
        }, 1000);

        return () => clearTimeout(timer);
    }, [balance, inventory, history, user]);

    // 5. Фоновое обновление (Polling)
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(() => {
            // Обновляем ТОЛЬКО список выводов, чтобы проверить статусы
            fetchWithdrawals(user.id);
            
            // ВАЖНО: Мы УБРАЛИ обновление инвентаря отсюда (/api/user/sync), 
            // чтобы оно не перезаписывало локальные предметы, которые еще не сохранились.
            
        }, 5000); // Раз в 5 секунд
        return () => clearInterval(interval);
    }, [user, fetchWithdrawals]);

    // --- ФУНКЦИИ ---

    const updateBalance = useCallback((amount) => {
        setBalance(prev => prev + amount);
    }, []);

    const addToInventory = useCallback((items) => {
        // Добавляем уникальный ID для React ключей
        const newItems = items.map(item => ({ ...item, inventoryId: Date.now() + Math.random() }));
        setInventory(prev => [...prev, ...newItems]);
    }, []);

    const removeFromInventory = useCallback((inventoryId) => {
        setInventory(prev => prev.filter(item => item.inventoryId !== inventoryId));
    }, []);

    const addToHistory = useCallback((items) => {
        const newHistoryEntries = items.map(item => ({ ...item, date: new Date().toISOString() }));
        setHistory(prev => [...newHistoryEntries, ...prev].slice(0, 50));
    }, []);

    const sellItem = useCallback((inventoryId) => {
        const itemIndex = inventory.findIndex(item => item.inventoryId === inventoryId);
        if (itemIndex > -1) {
            const itemToSell = inventory[itemIndex];
            updateBalance(itemToSell.value);
            removeFromInventory(inventoryId);
            return true;
        }
        return false;
    }, [inventory, updateBalance, removeFromInventory]);

    // Функция "Продать всё"
    const sellAllItems = useCallback(async () => {
        if (!user) return;
        try {
            const res = await fetch('/api/user/sell-all', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ userId: user.id })
            });
            const data = await res.json();
            if (data.success) {
                setInventory([]);
                setBalance(data.newBalance);
            }
        } catch (e) { console.error(e); }
    }, [user]);

    // Функция запроса вывода
    const requestWithdrawal = useCallback(async (itemInventoryId, targetUsername) => {
        if (!user) return;
        try {
            const res = await fetch('/api/withdraw/request', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ userId: user.id, itemInventoryId, targetUsername })
            });
            const data = await res.json();
            if (data.success) {
                removeFromInventory(itemInventoryId); // Удаляем локально сразу
                fetchWithdrawals(user.id); // Обновляем список выводов
                return true;
            }
        } catch (e) { console.error(e); }
        return false;
    }, [user, removeFromInventory, fetchWithdrawals]);

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

    const getUpgradeResult = (sourceItem, targetItem) => {
        if (!sourceItem || !targetItem) return { success: false, chance: 0 };
        const chance = Math.min(Math.max((sourceItem.value / targetItem.value) * 50, 1), 95);
        const isSuccess = Math.random() * 100 < chance;
        return { success: isSuccess, chance: chance };
    };

    const performUpgrade = useCallback((sourceItemId, targetItem, success) => {
        removeFromInventory(sourceItemId);
        if (success) {
            const newItem = { ...targetItem, inventoryId: Date.now() + Math.random() };
            setInventory(prev => [...prev, newItem]);
            addToHistory([newItem]);
        }
    }, [removeFromInventory, addToHistory]);

    const openTopUpModal = () => setIsTopUpModalOpen(true);
    const closeTopUpModal = () => setIsTopUpModalOpen(false);

    const value = {
        user, balance, inventory, history, withdrawals,
        ALL_PRIZES, ALL_CASES: cases, isConfigLoaded,
        updateBalance, addToInventory, sellItem, sellAllItems, requestWithdrawal,
        removeFromInventory, addToHistory, getWeightedRandomPrize,
        getUpgradeResult, performUpgrade,
        isTopUpModalOpen, openTopUpModal, closeTopUpModal, refreshConfig
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
