import React, { createContext, useState, useCallback, useEffect } from 'react';

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
    // Данные приложения
    const [ALL_PRIZES, setAllPrizes] = useState([]);
    const [cases, setCases] = useState([]);
    const [isConfigLoaded, setIsConfigLoaded] = useState(false);

    // Данные пользователя
    const [user, setUser] = useState(null);
    const [balance, setBalance] = useState(0);
    const [inventory, setInventory] = useState([]);
    const [history, setHistory] = useState([]);
    const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);

    // 1. ЗАГРУЗКА КОНФИГУРАЦИИ (КЕЙСЫ И ПРЕДМЕТЫ)
    // Выносим в отдельную функцию, чтобы можно было вызывать из Админки для обновления
    const refreshConfig = useCallback(() => {
        fetch('/api/config')
            .then(res => res.json())
            .then(data => {
                setAllPrizes(data.prizes);
                setCases(data.cases);
                setIsConfigLoaded(true);
            })
            .catch(err => console.error("Config fetch error:", err));
    }, []);

    useEffect(() => {
        refreshConfig();
    }, [refreshConfig]);

    // 2. АВТОРИЗАЦИЯ И СИНХРОНИЗАЦИЯ ПОЛЬЗОВАТЕЛЯ
    useEffect(() => {
        const initUser = async () => {
            let tgUser = null;
            if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
                tgUser = window.Telegram.WebApp.initDataUnsafe.user;
            } else {
                // Фейк юзер для браузера (для тестов)
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
                const userData = await res.json();
                
                setUser(userData); // id, name, etc...
                setBalance(userData.balance);
                setInventory(userData.inventory || []);
                setHistory(userData.history || []);
            } catch (err) {
                console.error("User sync error:", err);
            }
        };

        if (isConfigLoaded) {
            initUser();
        }
    }, [isConfigLoaded]);

    // 3. СОХРАНЕНИЕ ДАННЫХ ПРИ ИЗМЕНЕНИИ
    // (Дебаунс сохранение, чтобы не спамить сервер)
    useEffect(() => {
        if (!user) return;
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
        }, 1000); // Сохраняем через 1 сек после последнего изменения

        return () => clearTimeout(timer);
    }, [balance, inventory, history, user]);

    // --- ФУНКЦИИ ---

    // Админка: обновление локального стейта кейсов (сервер уже обновлен админкой)
    const updateCaseData = useCallback((updatedCase) => {
        setCases(prev => prev.map(c => c.id === updatedCase.id ? updatedCase : c));
    }, []);

    const updateBalance = useCallback((amount) => {
        setBalance(prev => prev + amount);
    }, []);

    const addToInventory = useCallback((items) => {
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

    const getWeightedRandomPrize = useCallback((prizes) => {
        const prizePool = prizes || ALL_PRIZES;
        const totalChance = prizePool.reduce((sum, prize) => sum + prize.chance, 0);
        let random = Math.random() * totalChance;
        for (const prize of prizePool) {
            if (random < prize.chance) {
                return prize;
            }
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
        user,
        balance,
        inventory,
        history,
        ALL_PRIZES,
        ALL_CASES: cases,
        isConfigLoaded,
        updateCaseData,
        updateBalance,
        addToInventory,
        sellItem,
        removeFromInventory,
        addToHistory,
        getWeightedRandomPrize,
        getUpgradeResult,
        performUpgrade,
        isTopUpModalOpen,
        openTopUpModal,
        closeTopUpModal,
        refreshConfig // <-- Добавили для админки
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};
