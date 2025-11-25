import React, { useState, useContext, useEffect, useRef } from 'react';
import { AppContext } from '../context/AppContext';

const UpgradePage = () => {
    // Получаем функции из контекста
    const { inventory, ALL_PRIZES, getUpgradeResult, performUpgrade } = useContext(AppContext);

    const [selectedItem, setSelectedItem] = useState(null);
    const [targetItem, setTargetItem] = useState(null);
    
    const [activeTab, setActiveTab] = useState('my-gifts');
    const [chance, setChance] = useState(0);
    const [multiplier, setMultiplier] = useState(0);
    
    const [isRolling, setIsRolling] = useState(false);
    const [rollResult, setRollResult] = useState(null); // 'success' | 'fail' | null
    const [rotation, setRotation] = useState(0);
    const [displayItem, setDisplayItem] = useState(ALL_PRIZES[0]);
    const [isFading, setIsFading] = useState(false);
    const indicatorRef = useRef(null);

    const availableUpgrades = ALL_PRIZES.filter(prize => selectedItem && prize.value > selectedItem.value)
                                       .sort((a, b) => a.value - b.value);

    // Расчет шансов и иксов
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

    // Анимация смены изображений в колесе (режим ожидания)
    useEffect(() => {
        if (targetItem) {
            setDisplayItem(targetItem);
        } else if (selectedItem) {
            setDisplayItem(selectedItem);
        } else {
            const interval = setInterval(() => {
                setIsFading(true);
                setTimeout(() => {
                    setDisplayItem(prevItem => {
                        const currentIndex = ALL_PRIZES.findIndex(item => item.id === prevItem.id);
                        const nextIndex = (currentIndex + 1) % ALL_PRIZES.length;
                        return ALL_PRIZES[nextIndex];
                    });
                    setIsFading(false);
                }, 300);
            }, 2500); 
            return () => clearInterval(interval);
        }
    }, [selectedItem, targetItem, ALL_PRIZES]);
    
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
        setActiveTab('choose-upgrade');
    };

    const handleSelectTarget = (item) => {
        if (isRolling) return;
        setTargetItem(item);
    };

    const handleUpgrade = () => {
        if (!selectedItem || !targetItem || isRolling) return;

        // Сброс стилей перед запуском
        if (indicatorRef.current) {
            void indicatorRef.current.offsetHeight; 
            indicatorRef.current.style.transition = 'transform 4s cubic-bezier(0.25, 1, 0.5, 1)';
        }

        setIsRolling(true);
        setRollResult(null);

        const { success, chance: resultChance } = getUpgradeResult(selectedItem, targetItem);
        
        // Логика вращения
        const chanceInDegrees = resultChance * 3.6;
        let stopAngle;

        if (success) {
            // Останавливаемся в зоне успеха (синяя зона)
            stopAngle = 5 + Math.random() * (chanceInDegrees - 10);
        } else {
            // Останавливаемся в зоне неудачи (серая зона)
            const failZoneStart = chanceInDegrees + 5;
            const failZoneEnd = 360 - 5;
            stopAngle = failZoneStart + Math.random() * (failZoneEnd - failZoneStart);
        }

        // Добавляем 5 полных оборотов + угол остановки
        const totalRotation = (rotation - (rotation % 360)) + (5 * 360) + stopAngle;
        setRotation(totalRotation);

        // Тайминг окончания вращения
        setTimeout(() => {
            setRollResult(success ? 'success' : 'fail');
            performUpgrade(selectedItem.inventoryId, targetItem, success);

            // Сброс через 2 секунды после результата
            setTimeout(() => {
                setIsRolling(false);
                setSelectedItem(null);
                setTargetItem(null);
                setActiveTab('my-gifts');
                setRollResult(null); // Сбрасываем эффект
            }, 3500); // Чуть дольше, чтобы насладиться эффектом

        }, 4100); // 4s анимация + 100ms запас
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
            <div className="upgrade-wheel-container">
                <div className="stat-display">
                    <span className="stat-label">Шанс</span>
                    <span className="stat-value">{chance.toFixed(2)}%</span>
                </div>

                <div className="wheel" style={{ '--chance': `${chance}%` }}>
                    <div className="wheel-outer-ring">
                        <div className="wheel-inner-ring">
                            {/* --- ЭФФЕКТЫ ВСПЛЕСКА (Только при успехе) --- */}
                            {rollResult === 'success' && (
                                <div className="success-burst">
                                    <div className="burst-flash"></div>
                                    <div className="burst-rays"></div>
                                    <div className="burst-shockwave"></div>
                                    <div className="burst-particles">
                                        <span></span><span></span><span></span><span></span>
                                        <span></span><span></span><span></span><span></span>
                                    </div>
                                </div>
                            )}

                            {/* Изображение предмета */}
                            <img
                                src={displayItem.image}
                                alt={displayItem.name}
                                className={`wheel-item ${isFading ? 'is-fading' : ''} ${rollResult ? `roll-${rollResult}` : ''}`}
                            />
                        </div>
                    </div>
                    
                    {/* Стрелка */}
                    <div
                        className="wheel-indicator-container"
                        ref={indicatorRef}
                        style={{ transform: `rotate(${rotation}deg)` }}
                    >
                        <div className="wheel-indicator-arrow"></div>
                    </div>
                </div>

                <div className="stat-display">
                    <span className="stat-label">Икс</span>
                    <span className="stat-value">{multiplier}x</span>
                </div>
            </div>

            <button
                className="upgrade-button"
                onClick={handleUpgrade}
                disabled={!selectedItem || !targetItem || isRolling}
            >
                {isRolling ? 'Улучшение...' : 'Улучшить подарок'}
            </button>

            <div className="selection-area">
                <div className={`selection-box ${selectedItem ? 'active-border' : ''}`} onClick={() => !isRolling && setActiveTab('my-gifts')}>
                    {selectedItem ? (
                        <>
                            <img src={selectedItem.image} alt={selectedItem.name} />
                            <span>{selectedItem.value.toLocaleString()}</span>
                        </>
                    ) : (
                        <>
                            <span className="plus-icon">+</span>
                            <span>Выберите подарок</span>
                        </>
                    )}
                </div>
                <div className={`selection-box ${targetItem ? 'active-border' : ''}`} onClick={() => !isRolling && selectedItem && setActiveTab('choose-upgrade')}>
                     {targetItem ? (
                        <>
                            <img src={targetItem.image} alt={targetItem.name} />
                            <span>{targetItem.value.toLocaleString()}</span>
                        </>
                    ) : (
                        <>
                            <span className="plus-icon">+</span>
                            <span>Выберите цель</span>
                        </>
                    )}
                </div>
            </div>

            <div className="inventory-tabs">
                <button
                    className={`tab-btn ${activeTab === 'my-gifts' ? 'active' : ''}`}
                    onClick={() => !isRolling && setActiveTab('my-gifts')}
                >
                    Мои подарки
                </button>
                <button
                    className={`tab-btn ${activeTab === 'choose-upgrade' ? 'active' : ''}`}
                    onClick={() => !isRolling && setActiveTab('choose-upgrade')}
                    disabled={!selectedItem || isRolling}
                >
                    Выбрать улучшение
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
                        <div className="empty-state">
                            Не найдено нераспределённых подарков
                        </div>
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
                            <div className="empty-state">
                                Нет доступных улучшений для этого предмета
                            </div>
                         )
                     ) : (
                        <div className="empty-state">
                            Сначала выберите предмет для улучшения
                        </div>
                     )}
                </div>
            </div>
        </main>
    );
};

export default UpgradePage;
