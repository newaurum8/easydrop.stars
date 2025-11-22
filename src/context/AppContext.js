import React, { createContext, useState, useCallback, useEffect } from 'react';

// --- КОНСТАНТЫ (ИСХОДНЫЕ ДАННЫЕ) ---
const ALL_PRIZES_CASE1 = [
    { id: 'c1_item_1', name: 'Золотые часы', image: '/images/case/item.png', value: 250000, chance: 1 },
    { id: 'c1_item_2', name: 'Кепка Telegram', image: '/images/case/item1.png', value: 12000, chance: 5 },
    { id: 'c1_item_3', name: 'Роза', image: '/images/case/item2.png', value: 10000, chance: 10 },
    { id: 'c1_item_4', name: 'Подарок', image: '/images/case/item3.png', value: 2600, chance: 20 },
    { id: 'c1_item_5', name: 'Цилиндр', image: '/images/case/item4.png', value: 1500, chance: 24 },
    { id: 'c1_item_6', name: 'Ретро-авто', image: '/images/case/item5.png', value: 900, chance: 40 },
    { id: 'c1_item_7', name: 'Обезьянка', image: '/images/case/item6.png', value: 500, chance: 50 },
    { id: 'c1_item_8', name: 'Бенгальский огонь', image: '/images/case/item7.png', value: 300, chance: 60 },
    { id: 'c1_item_9', name: 'Бриллиант', image: '/images/case/item8.png', value: 100, chance: 70 }
];
const ALL_PRIZES_CASE2 = [
    { id: 'c2_item_1', name: 'Кольцо с бриллиантом', image: '/images/case1/item1.png', value: 300000, chance: 1 },
    { id: 'c2_item_2', name: 'Леденец', image: '/images/case1/item2.png', value: 15000, chance: 5 },
    { id: 'c2_item_3', name: 'Ракета', image: '/images/case1/item3.png', value: 12000, chance: 10 },
    { id: 'c2_item_4', name: 'Золотой кубок', image: '/images/case1/item4.png', value: 8000, chance: 20 },
    { id: 'c2_item_5', name: 'Коробка с бантом', image: '/images/case1/item5.png', value: 4000, chance: 24 },
    { id: 'c2_item_6', name: 'Синий бриллиант', image: '/images/case1/item6.png', value: 2000, chance: 40 },
    { id: 'c2_item_7', name: 'Букет тюльпанов', image: '/images/case1/item7.png', value: 1000, chance: 50 },
    { id: 'c2_item_8', name: 'Искорка', image: '/images/case1/item8.png', value: 500, chance: 60 },
];
const ALL_PRIZES = [...ALL_PRIZES_CASE1, ...ALL_PRIZES_CASE2];

// Исходный список кейсов
const INITIAL_CASES = [
    { id: 'case_1', name: 'Классический', image: '/images/case.png', price: 2500, prizes: ALL_PRIZES_CASE1, },
    { id: 'case_2', name: 'Сладкий', image: '/images/case1.png', price: 7500, prizes: ALL_PRIZES_CASE2, },
    { id: 'case_3', name: 'Праздничный', image: '/images/case2.png', price: 15000, prizes: [...ALL_PRIZES_CASE1.slice(4), ...ALL_PRIZES_CASE2.slice(0, 4)], },
    { id: 'case_4', name: 'Редкий', image: '/images/case3.png', price: 20000, prizes: ALL_PRIZES_CASE2.slice(0, 6), },
    { id: 'case_5', name: 'Элитный', image: '/images/case4.png', price: 50000, prizes: ALL_PRIZES_CASE1.slice(0, 4), },
    { id: 'case_6', name: 'Коллекционный', image: '/images/case5.png', price: 100000, prizes: ALL_PRIZES_CASE2.slice(0, 3), },
    { id: 'case_7', name: 'Мифический', image: '/images/case6.png', price: 250000, prizes: [ALL_PRIZES_CASE1[0], ALL_PRIZES_CASE2[0]], },
    { id: 'case_8', name: 'Легендарный', image: '/images/case7.png', price: 500000, prizes: [ALL_PRIZES_CASE1[0], ALL_PRIZES_CASE2[0], ALL_PRIZES_CASE1[1]], },
    { id: 'promo_case', name: 'Промо-кейс', image: '/images/case8.png', price: 0, prizes: [ALL_PRIZES_CASE1[3], ALL_PRIZES_CASE1[4], ALL_PRIZES_CASE1[5], ALL_PRIZES_CASE2[6], ALL_PRIZES_CASE2[7]], isPromo: true, }
];

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
    // 1. Загружаем баланс и инвентарь
    const [balance, setBalance] = useState(() => parseInt(localStorage.getItem('userBalance') || '50000'));
    const [inventory, setInventory] = useState(() => JSON.parse(localStorage.getItem('userInventory') || '[]'));
    const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('userHistory') || '[]'));
    
    // 2. Загружаем кейсы из localStorage, если их там нет — берем стандартные
    const [cases, setCases] = useState(() => {
        const savedCases = localStorage.getItem('adminCases');
        return savedCases ? JSON.parse(savedCases) : INITIAL_CASES;
    });

    const [user, setUser] = useState(null);
    const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);

    useEffect(() => {
        const tg = window.Telegram?.WebApp;
        if (tg) {
            tg.ready();
            const userData = tg.initDataUnsafe?.user;
            if (userData) {
                setUser({
                    id: userData.id,
                    firstName: userData.first_name,
                    lastName: userData.last_name,
                    username: userData.username,
                    photoUrl: userData.photo_url
                });
                return;
            }
        }
        // Фейковый юзер для браузера (чтобы работала админка)
        setUser({ id: 12345, firstName: 'Browser', lastName: 'User', username: 'tester', photoUrl: null });
    }, []);

    // --- ФУНКЦИЯ ДЛЯ АДМИНКИ: Обновление кейса ---
    const updateCaseData = useCallback((updatedCase) => {
        setCases(prevCases => {
            const newCases = prevCases.map(c => c.id === updatedCase.id ? updatedCase : c);
            localStorage.setItem('adminCases', JSON.stringify(newCases)); // Сохраняем настройки
            return newCases;
        });
    }, []);

    // --- ФУНКЦИЯ ДЛЯ АДМИНКИ: Сброс настроек ---
    const resetCasesToDefault = useCallback(() => {
        setCases(INITIAL_CASES);
        localStorage.removeItem('adminCases');
    }, []);

    const openTopUpModal = useCallback(() => setIsTopUpModalOpen(true), []);
    const closeTopUpModal = useCallback(() => setIsTopUpModalOpen(false), []);

    const updateBalance = useCallback((amount) => {
        setBalance(prev => {
            const newBalance = prev + amount;
            localStorage.setItem('userBalance', newBalance);
            return newBalance;
        });
    }, []);

    const addToInventory = useCallback((items) => {
        setInventory(prev => {
            const newItems = items.map(item => ({ ...item, inventoryId: Date.now() + Math.random() }));
            const updatedInventory = [...prev, ...newItems];
            localStorage.setItem('userInventory', JSON.stringify(updatedInventory));
            return updatedInventory;
        });
    }, []);

    const removeFromInventory = useCallback((inventoryId) => {
        setInventory(prev => {
            const updatedInventory = prev.filter(item => item.inventoryId !== inventoryId);
            localStorage.setItem('userInventory', JSON.stringify(updatedInventory));
            return updatedInventory;
        });
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

    const addToHistory = useCallback((items) => {
        setHistory(prev => {
            const newHistoryEntries = items.map(item => ({ ...item, date: new Date().toISOString() }));
            const updatedHistory = [...newHistoryEntries, ...prev].slice(0, 50);
            localStorage.setItem('userHistory', JSON.stringify(updatedHistory));
            return updatedHistory;
        });
    }, []);

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
    }, []);

    const getUpgradeResult = (sourceItem, targetItem) => {
        if (!sourceItem || !targetItem) {
            return { success: false, chance: 0 };
        }
        const chance = Math.min(Math.max((sourceItem.value / targetItem.value) * 50, 1), 95);
        const isSuccess = Math.random() * 100 < chance;
        return { success: isSuccess, chance: chance };
    };

    const performUpgrade = useCallback((sourceItemId, targetItem, success) => {
        removeFromInventory(sourceItemId);
        if (success) {
            const newItem = { ...targetItem, inventoryId: Date.now() + Math.random() };
            setInventory(prev => {
                const updatedInventory = [...prev, newItem];
                localStorage.setItem('userInventory', JSON.stringify(updatedInventory));
                return updatedInventory;
            });
            addToHistory([newItem]);
        }
    }, [removeFromInventory, addToHistory]);

    const value = {
        balance,
        inventory,
        history,
        user,
        ALL_PRIZES,
        ALL_CASES: cases, // ! ВАЖНО: Передаем динамические кейсы под старым именем, чтобы не ломать другие файлы
        updateCaseData,   // Новая функция для админки
        resetCasesToDefault, // Новая функция для сброса
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
        closeTopUpModal
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};
