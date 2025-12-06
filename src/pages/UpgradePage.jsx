import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import { AppContext } from '../context/AppContext';

const UpgradePage = () => {
    const { inventory, ALL_PRIZES, getUpgradeResult, performUpgrade } = useContext(AppContext);

    const [selectedItem, setSelectedItem] = useState(null);
    const [targetItem, setTargetItem] = useState(null);
    
    const [activeTab, setActiveTab] = useState('my-gifts');
    
    const [chance, setChance] = useState(0);
    const [multiplier, setMultiplier] = useState(0);
    
    const [isRolling, setIsRolling] = useState(false);
    const [rollResult, setRollResult] = useState(null);
    const [rotation, setRotation] = useState(0);
    const [displayItem, setDisplayItem] = useState(ALL_PRIZES[0]);
    const [isFading, setIsFading] = useState(false);
    const indicatorRef = useRef(null);

    // Мемоизация доступных улучшений
    const availableUpgrades = useMemo(() => {
        if (!selectedItem) return [];
        return ALL_PRIZES
            .filter(prize => prize.value > selectedItem.value)
            .sort((a, b) => a.value - b.value);
    }, [selectedItem, ALL_PRIZES]);

    // Расчет статистики
    useEffect(() => {
        if (selectedItem && targetItem) {
            const calculatedChance = Math.min(Math.max((selectedItem.value / targetItem.value) * 50, 1), 95);
            setChance(calculatedChance);
            const calculatedMultiplier = (targetItem.value / selectedItem.value).toFixed(2);
            setMultiplier(calculatedMultiplier);
        } else {
            setChance(0);
            setMultiplier(0);
        }
    }, [selectedItem, targetItem]);

    // --- УЛУЧШЕННАЯ АНИМАЦИЯ ПРЕВЬЮ ---
    useEffect(() => {
        // 1. Если выбрана цель - показываем её статично и без анимации
        if (targetItem) {
            setDisplayItem(targetItem);
            setIsFading(false);
            return;
        }

        // 2. Определяем пул предметов
        let pool = selectedItem ? (availableUpgrades.length > 0 ? availableUpgrades : [selectedItem]) : ALL_PRIZES;
        
        // Если предмета для анимации нет или он один - просто показываем его
        if (!pool || pool.length <= 1) {
            if (pool.length === 1) setDisplayItem(pool[0]);
            setIsFading(false);
            return;
        }

        // 3. Цикл анимации
        let isMounted = true;
        let timeout1, timeout2, timeout3;

        const animateCycle = () => {
            if (!isMounted) return;

            // ШАГ 1: Начало исчезновения (Fade Out)
            setIsFading(true);

            // Ждем пока исчезнет (400ms - совпадает с CSS transition)
            timeout1 = setTimeout(() => {
                if (!isMounted) return;

                // ШАГ 2: Смена картинки (пока она невидима)
                setDisplayItem(prevItem => {
                    // Строгая фильтрация текущего предмета
                    const candidates = pool.filter(item => item.id !== prevItem.id);
                    // Если каким-то чудом кандидатов нет, берем любой из пула, иначе рандом
                    if (candidates.length === 0) return pool[Math.floor(Math.random() * pool.length)];
                    
                    const randomIndex = Math.floor(Math.random() * candidates.length);
                    return candidates[randomIndex];
                });

                // ШАГ 3: Небольшая задержка перед появлением (чтобы браузер успел сменить src)
                timeout2 = setTimeout(() => {
                    if (!isMounted) return;
                    
                    // ШАГ 4: Появление (Fade In)
                    setIsFading(false);

                    // ШАГ 5: Планируем следующий цикл через 2 секунды видимости
                    timeout3 = setTimeout(animateCycle, 2000);
                }, 50); // 50ms техническая пауза

            }, 400); // Время исчезновения
        };

        // Запускаем первый цикл
        timeout3 = setTimeout(animateCycle, 2000);

        return () => {
            isMounted = false;
            clearTimeout(timeout1);
            clearTimeout(timeout2);
            clearTimeout(timeout3);
        };
    }, [selectedItem, targetItem, availableUpgrades, ALL_PRIZES]);
    
    // Сброс стрелки
    useEffect(() => {
        if (!isRolling && indicatorRef.current) {
            indicatorRef.current.style.transition = 'none';
            const currentRotation = rotation % 360;
            indicatorRef.current.style.transform = `rotate(${currentRotation}deg)`;
        }
    }, [isRolling, rotation]);

    // --- ОБРАБОТЧИКИ ---

    const handleSelectItem = (item) => {
        if (isRolling) return;
        setSelectedItem(item);
        setTargetItem(null);
        setActiveTab('choose-upgrade'); 
    };

    const handleSelectTarget = (item) => {
        if (isRolling) return;
        setTargetItem(item);
    };

    const handleUpgrade = () => {
        if (!selectedItem || !targetItem || isRolling) return;

        if (indicatorRef.current) {
            void indicatorRef.current.offsetHeight; 
            indicatorRef.current.style.transition = 'transform 4s cubic-bezier(0.25, 1, 0.5, 1)';
        }

        setIsRolling(true);
        setRollResult(null);

        const { success, chance: resultChance } = getUpgradeResult(selectedItem, targetItem);
        
        const chanceInDegrees = resultChance * 3.6;
        let stopAngle;

        if (success) {
            stopAngle = 5 + Math.random() * (chanceInDegrees - 10);
        } else {
            const failZoneStart = chanceInDegrees + 5;
            const failZoneEnd = 360 - 5;
            stopAngle = failZoneStart + Math.random() * (failZoneEnd - failZoneStart);
        }

        const totalRotation = (rotation - (rotation % 360)) + (5 * 360) + stopAngle;
        setRotation(totalRotation);

        setTimeout(() => {
            setRollResult(success ? 'success' : 'fail');
            performUpgrade(selectedItem.inventoryId, targetItem, success);

            setTimeout(() => {
                setIsRolling(false);
                setSelectedItem(null);
                setTargetItem(null);
                setActiveTab('my-gifts');
                setRollResult(null); 
            }, 1500);

        }, 4100);
    };

    const InventoryItem = ({ item, onClick, isActive }) => (
        <div className={`inventory-item ${isActive ? 'active-border' : ''}`} onClick={() => onClick(item)}>
            <img src={item.image} alt={item.name} />
            <div className="item-value">
                <img src="/images/stars.png" alt="star" className="star-icon small" />
                <span>{item.value.toLocaleString()}</span>
            </div>
        </div>
    );

    return (
        <main className="upgrade-content">
            <div className="upgrade-header">
                <h2>Upgrade</h2>
            </div>

            <div className="upgrade-center-stage">
                <div className="wheel-glow-backdrop"></div>

                <div className="upgrade-wheel-container">
                    <div className="stat-display left">
                        <span className="stat-label">Chance</span>
                        <span className="stat-value" style={{color: '#00e5ff'}}>{chance.toFixed(2)}%</span>
                    </div>

                    <div className="wheel" style={{ '--chance': `${chance}%` }}>
                        <div className="wheel-outer-ring">
                            <div className="wheel-inner-ring">
                                {rollResult && (
                                    <div className={`result-effect ${rollResult}`}>
                                        <div className="effect-wave"></div>
                                        <div className="effect-flash"></div>
                                    </div>
                                )}
                                <img
                                    src={displayItem.image}
                                    alt={displayItem.name}
                                    className={`wheel-item ${isFading ? 'is-fading' : ''} ${rollResult ? `roll-${rollResult}` : ''}`}
                                />
                            </div>
                        </div>
                        
                        <div className="wheel-indicator-container" ref={indicatorRef} style={{ transform: `rotate(${rotation}deg)` }}>
                            <div className="wheel-indicator-arrow"></div>
                        </div>
                    </div>

                    <div className="stat-display right">
                        <span className="stat-label">Multiplier</span>
                        <span className="stat-value" style={{color: '#ffc107'}}>{multiplier}x</span>
                    </div>
                </div>
            </div>

            {/* Верхние слоты */}
            <div className="selection-area">
                <div className={`selection-box ${selectedItem ? 'filled' : 'empty'} ${activeTab === 'my-gifts' ? 'active-focus' : ''}`} onClick={() => !isRolling && setActiveTab('my-gifts')}>
                    {selectedItem ? (
                        <>
                            <div className="box-glow" style={{background: 'radial-gradient(circle, rgba(0,170,255,0.2), transparent)'}}></div>
                            <img src={selectedItem.image} alt={selectedItem.name} />
                            <span className="box-price">{selectedItem.value.toLocaleString()}</span>
                        </>
                    ) : (
                        <div className="placeholder-content">
                            <span className="plus-icon">+</span>
                            <span>Мой предмет</span>
                        </div>
                    )}
                </div>

                <div className={`upgrade-arrow ${selectedItem && targetItem ? 'active' : ''}`}>➜</div>

                <div className={`selection-box ${targetItem ? 'filled target' : 'empty'} ${activeTab === 'choose-upgrade' ? 'active-focus' : ''}`} onClick={() => !isRolling && selectedItem && setActiveTab('choose-upgrade')}>
                     {targetItem ? (
                        <>
                            <div className="box-glow" style={{background: 'radial-gradient(circle, rgba(255,193,7,0.2), transparent)'}}></div>
                            <img src={targetItem.image} alt={targetItem.name} />
                            <span className="box-price" style={{color: '#ffc107'}}>{targetItem.value.toLocaleString()}</span>
                        </>
                    ) : (
                        <div className="placeholder-content">
                            <span className="plus-icon">+</span>
                            <span>Улучшение</span>
                        </div>
                    )}
                </div>
            </div>

            <button
                className="upgrade-button-main"
                onClick={handleUpgrade}
                disabled={!selectedItem || !targetItem || isRolling}
            >
                {isRolling ? 'UPGRADING...' : 'UPGRADE'}
            </button>

            {/* Списки */}
            <div className="inventory-section">
                <div className="inventory-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'my-gifts' ? 'active' : ''}`}
                        onClick={() => !isRolling && setActiveTab('my-gifts')}
                    >
                        Инвентарь
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'choose-upgrade' ? 'active' : ''}`}
                        onClick={() => !isRolling && setActiveTab('choose-upgrade')}
                        disabled={!selectedItem || isRolling}
                    >
                        Улучшения
                    </button>
                </div>

                <div className="inventory-content">
                    {activeTab === 'my-gifts' && (
                        <div className="tab-content active">
                            {inventory.length > 0 ? (
                                <div className="inventory-grid">
                                    {inventory.map(item => (
                                        <InventoryItem
                                            key={item.inventoryId}
                                            item={item}
                                            onClick={handleSelectItem}
                                            isActive={selectedItem && selectedItem.inventoryId === item.inventoryId}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-state-container">
                                    <div className="empty-icon">🎒</div>
                                    <p>Инвентарь пуст</p>
                                    <span>Откройте кейсы, чтобы получить предметы</span>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'choose-upgrade' && (
                        <div className="tab-content active">
                             {selectedItem ? (
                                 availableUpgrades.length > 0 ? (
                                    <div className="inventory-grid">
                                        {availableUpgrades.map(item => (
                                            <InventoryItem
                                                key={item.id}
                                                item={item}
                                                onClick={handleSelectTarget}
                                                isActive={targetItem && targetItem.id === item.id}
                                            />
                                        ))}
                                    </div>
                                 ) : (
                                    <div className="empty-state-container">
                                        <div className="empty-icon">💎</div>
                                        <p>Нет улучшений</p>
                                        <span>Для этого предмета нет более дорогих вариантов</span>
                                    </div>
                                 )
                             ) : (
                                <div className="empty-state-container">
                                    <div className="empty-icon">👈</div>
                                    <p>Выберите предмет</p>
                                    <span>Сначала выберите предмет из инвентаря (слева)</span>
                                </div>
                             )}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
};

export default UpgradePage;
