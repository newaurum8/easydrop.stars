import React, { createContext, useState, useCallback, useEffect } from 'react';

// --- ИСХОДНЫЕ ДАННЫЕ (константы для сброса) ---
const INITIAL_PRIZES_CASE1 = [
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
const INITIAL_PRIZES_CASE2 = [
    { id: 'c2_item_1', name: 'Кольцо с бриллиантом', image: '/images/case1/item1.png', value: 300000, chance: 1 },
    { id: 'c2_item_2', name: 'Леденец', image: '/images/case1/item2.png', value: 15000, chance: 5 },
    { id: 'c2_item_3', name: 'Ракета', image: '/images/case1/item3.png', value: 12000, chance: 10 },
    { id: 'c2_item_4', name: 'Золотой кубок', image: '/images/case1/item4.png', value: 8000, chance: 20 },
    { id: 'c2_item_5', name: 'Коробка с бантом', image: '/images/case1/item5.png', value: 4000, chance: 24 },
    { id: 'c2_item_6', name: 'Синий бриллиант', image: '/images/case1/item6.png', value: 2000, chance: 40 },
    { id: 'c2_item_7', name: 'Букет тюльпанов', image: '/images/case1/item7.png', value: 1000, chance: 50 },
    { id: 'c2_item_8', name: 'Искорка', image: '/images/case1/item8.png', value: 500, chance: 60 },
];
const INITIAL_PRIZES = [...INITIAL_PRIZES_CASE1, ...INITIAL_PRIZES_CASE2];

const INITIAL_CASES = [
    { id: 'case_1', name: 'Классический', image: '/images/case.png', price: 2500, prizeIds: INITIAL_PRIZES_CASE1.map(p => p.id), },
    { id: 'case_2', name: 'Сладкий', image: '/images/case1.png', price: 7500, prizeIds: INITIAL_PRIZES_CASE2.map(p => p.id), },
    { id: 'case_3', name: 'Праздничный', image: '/images/case2.png', price: 15000, prizeIds: [...INITIAL_PRIZES_CASE1.slice(4).map(p => p.id), ...INITIAL_PRIZES_CASE2.slice(0, 4).map(p => p.id)], },
    { id: 'case_4', name: 'Редкий', image: '/images/case3.png', price: 20000, prizeIds: INITIAL_PRIZES_CASE2.slice(0, 6).map(p => p.id), },
    { id: 'case_5', name: 'Элитный', image: '/images/case4.png', price: 50000, prizeIds: INITIAL_PRIZES_CASE1.slice(0, 4).map(p => p.id), },
    { id: 'case_6', name: 'Коллекционный', image: '/images/case5.png', price: 100000, prizeIds: INITIAL_PRIZES_CASE2.slice(0, 3).map(p => p.id), },
    { id: 'case_7', name: 'Мифический', image: '/images/case6.png', price: 250000, prizeIds: [INITIAL_PRIZES_CASE1[0].id, INITIAL_PRIZES_CASE2[0].id], },
    { id: 'case_8', name: 'Легендарный', image: '/images/case7.png', price: 500000, prizeIds: [INITIAL_PRIZES_CASE1[0].id, INITIAL_PRIZES_CASE2[0].id, INITIAL_PRIZES_CASE1[1].id], },
    { id: 'promo_case', name: 'Промо-кейс', image: '/images/case8.png', price: 0, prizeIds: [INITIAL_PRIZES_CASE1[3].id, INITIAL_PRIZES_CASE1[4].id, INITIAL_PRIZES_CASE1[5].id, INITIAL_PRIZES_CASE2[6].id, INITIAL_PRIZES_CASE2[7].id], isPromo: true, }
];
// --------------------------------------------------

export const AppContext = createContext();

// --- ДОБАВЛЕНО: Функции-загрузчики из localStorage ---
const loadFromStorage = (key, defaultValue) => {
    const storedValue = localStorage.getItem(key);
    if (storedValue) {
        try {
            return JSON.parse(storedValue);
        } catch (e) {
            console.error(`Failed to parse ${key} from localStorage`, e);
            return defaultValue;
        }
    }
    return defaultValue;
};
// ----------------------------------------------------

export const AppProvider = ({ children }) => {
    // --- ОБНОВЛЕНО: Используем localStorage для пользовательских данных ---
    const [balance, setBalance] = useState(() => loadFromStorage('userBalance', 50000));
    const [inventory, setInventory] = useState(() => loadFromStorage('userInventory', []));
    const [history, setHistory] = useState(() => loadFromStorage('userHistory', []));
    
    const [user, setUser] = useState(null);
    const [isTopUpModalOpen, setIsTopUpModalOpen] = useState(false);

    // --- ОБНОВЛЕНО: Используем localStorage для данных админки ---
    const [allPrizes, setAllPrizes] = useState(() => loadFromStorage('admin_allPrizes', INITIAL_PRIZES));
    const [allCases, setAllCases] = useState(() => loadFromStorage('admin_allCases', INITIAL_CASES));
    // ---------------------------------------------------------

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
            }
        }
    }, []);

    // --- ДОБАВЛЕНО: Эффекты для сохранения в localStorage ---
    useEffect(() => {
        localStorage.setItem('userBalance', balance);
    }, [balance]);

    useEffect(() => {
        localStorage.setItem('userInventory', JSON.stringify(inventory));
    }, [inventory]);

    useEffect(() => {
        localStorage.setItem('userHistory', JSON.stringify(history));
    }, [history]);

    // --- ДОБАВЛЕНО: Эффекты для сохранения АДМИН-ДАННЫХ в localStorage ---
    useEffect(() => {
        localStorage.setItem('admin_allPrizes', JSON.stringify(allPrizes));
    }, [allPrizes]);

    useEffect(() => {
        localStorage.setItem('admin_allCases', JSON.stringify(allCases));
    }, [allCases]);
    // ------------------------------------------------------------------

    const openTopUpModal = useCallback(() => setIsTopUpModalOpen(true), []);
    const closeTopUpModal = useCallback(() => setIsTopUpModalOpen(false), []);

    const updateBalance = useCallback((amount) => {
        setBalance(prev => prev + amount);
    }, []);

    const addToInventory = useCallback((items) => {
        setInventory(prev => {
            const newItems = items.map(item => ({ ...item, inventoryId: Date.now() + Math.random() }));
            return [...prev, ...newItems];
        });
    }, []);

    const removeFromInventory = useCallback((inventoryId) => {
        setInventory(prev => prev.filter(item => item.inventoryId !== inventoryId));
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
            return [...newHistoryEntries, ...prev].slice(0, 50);
        });
    }, []);

    const getWeightedRandomPrize = useCallback((prizes) => {
        const prizePool = prizes || allPrizes;
        const totalChance = prizePool.reduce((sum, prize) => sum + prize.chance, 0);
        let random = Math.random() * totalChance;
        for (const prize of prizePool) {
            if (random < prize.chance) {
                return prize;
            }
            random -= prize.chance;
        }
        return prizePool[prizePool.length - 1];
    }, [allPrizes]);

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
            setInventory(prev => [...prev, newItem]);
            addToHistory([newItem]);
        }
    }, [removeFromInventory, addToHistory]);

    // --- ДОБАВЛЕНО: Функция сброса для админки ---
    const resetAdminData = useCallback(() => {
        if (window.confirm('Вы уверены, что хотите сбросить все кейсы и предметы к настройкам по умолчанию?')) {
            localStorage.removeItem('admin_allPrizes');
            localStorage.removeItem('admin_allCases');
            setAllPrizes(INITIAL_PRIZES);
            setAllCases(INITIAL_CASES);
            alert('Настройки сброшены.');
        }
    }, []);
    // ---------------------------------------------

    const value = {
        balance,
        inventory,
        history,
        user,
        ALL_PRIZES: allPrizes,
        ALL_CASES: allCases,
        setAllPrizes,
        setAllCases,
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
        resetAdminData // <-- ДОБАВЛЕНО
    };

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};
