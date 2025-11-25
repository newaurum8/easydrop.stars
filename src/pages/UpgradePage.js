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

    // Список доступных улучшений (только те, что дороже выбранного)
    const availableUpgrades = useMemo(() => {
        if (!selectedItem) return [];
        return ALL_PRIZES
            .filter(prize => prize.value > selectedItem.value)
            .sort((a, b) => a.value - b.value);
    }, [selectedItem, ALL_PRIZES]);

    // Расчет шансов
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

    // --- АНИМАЦИЯ ПРЕДМЕТА В ЦЕНТРЕ (ПРЕВЬЮ) ---
    useEffect(() => {
        // 1. Если выбрана цель - показываем её статично
        if (targetItem) {
            setDisplayItem(targetItem);
            return;
        }

        // 2. Определяем пул предметов для показа
        let pool = [];
        if (selectedItem) {
            // Если выбран свой предмет, крутим только возможные улучшения
            // Если улучшений нет (самый дорогой предмет), показываем только его
            pool = availableUpgrades.length > 0 ? availableUpgrades : [selectedItem];
        } else {
            // Если ничего не выбрано, крутим всё (демо режим)
            pool = ALL_PRIZES;
        }

        if (!pool || pool.length === 0) return;

        const interval = setInterval(() => {
            setIsFading(true);
            
            setTimeout(() => {
                setDisplayItem(prevItem => {
                    // Фильтруем пул, исключая текущий предмет, чтобы картинка точно сменилась
                    const candidates = pool.filter(item => item.id !== prevItem.id);
                    
                    // Если кандидатов нет (например, в пуле всего 1 предмет), возвращаем его же
                    if (candidates.length === 0) return pool[0];

                    // Выбираем случайный из оставшихся
                    const randomIndex = Math.floor(Math.random() * candidates.length);
                    return candidates[randomIndex];
                });
                setIsFading(false);
            }, 300); // Время исчезновения (соответствует CSS transition)
            
        }, 2000); // Интервал смены картинки

        return () => clearInterval(interval);
    }, [selectedItem, targetItem, availableUpgrades, ALL_PRIZES]);
    
    // Сброс анимации стрелки
    useEffect(() => {
        if (!isRolling && indicatorRef.current) {
            indicatorRef.current.style.transition = 'none';
            const currentRotation = rotation % 360;
            indicatorRef.current.style.transform = `rotate(${currentRotation}deg)`;
        }
    }, [isRolling, rotation]);

    const handleSelectItem = (item) => {
        if (isRolling) return;
        setSelectedItem(item);
        setTargetItem(null);
        setActiveTab('choose-upgrade'); // Авто-переход к выбору улучшения
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

        // 1. Вращение (4.1 сек)
        setTimeout(() => {
            setRollResult(success ? 'success' : 'fail');
            performUpgrade(selectedItem.inventoryId, targetItem, success);

            // 2. Сброс интерфейса (через 1.5 сек после остановки, время анимации исчезновения)
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
                        
                        <div
                            className="wheel-indicator-container"
                            ref={indicatorRef}
                            style={{ transform: `rotate(${rotation}deg)` }}
                        >
                            <div className="wheel-indicator-arrow"></div>
                        </div>
                    </div>

                    <div className="stat-display right">
                        <span className="stat-label">Multiplier</span>
                        <span className="stat-value" style={{color: '#ffc107'}}>{multiplier}x</span>
                    </div>
                </div>
            </div>

            {/* --- ЗОНА ВЫБОРА (ПОСЛЕДОВАТЕЛЬНАЯ) --- */}
            <div className="selection-area">
                {/* 1. Слот СВОЕГО предмета (Всегда виден) */}
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
                            <span>Выберите предмет</span>
                        </div>
                    )}
                </div>

                {/* 2. Стрелка и Слот ЦЕЛИ (Появляются только после выбора первого) */}
                {selectedItem && (
                    <>
                        <div className={`upgrade-arrow ${targetItem ? 'active' : ''}`}>➜</div>

                        <div className={`selection-box ${targetItem ? 'filled target' : 'empty'} ${activeTab === 'choose-upgrade' ? 'active-focus' : ''}`} onClick={() => !isRolling && setActiveTab('choose-upgrade')}>
                             {targetItem ? (
                                <>
                                    <div className="box-glow" style={{background: 'radial-gradient(circle, rgba(255,193,7,0.2), transparent)'}}></div>
                                    <img src={targetItem.image} alt={targetItem.name} />
                                    <span className="box-price" style={{color: '#ffc107'}}>{targetItem.value.toLocaleString()}</span>
                                </>
                            ) : (
                                <div className="placeholder-content">
                                    <span className="plus-icon">+</span>
                                    <span>Выберите улучшение</span>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            <button
                className="upgrade-button-main"
                onClick={handleUpgrade}
                disabled={!selectedItem || !targetItem || isRolling}
            >
                {isRolling ? 'UPGRADING...' : 'UPGRADE'}
            </button>

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
                    <div id="my-gifts" className={`tab-content ${activeTab === 'my-gifts' ? 'active' : ''}`}>
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
                            <div className="empty-state">Инвентарь пуст</div>
                        )}
                    </div>
                    <div id="choose-upgrade" className={`tab-content ${activeTab === 'choose-upgrade' ? 'active' : ''}`}>
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
                                <div className="empty-state">Нет доступных улучшений</div>
                             )
                         ) : (
                            <div className="empty-state">Сначала выберите предмет из инвентаря</div>
                         )}
                    </div>
                </div>
            </div>
        </main>
    );
};

export default UpgradePage;
