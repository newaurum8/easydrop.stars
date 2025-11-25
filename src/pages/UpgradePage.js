import React, { useState, useContext, useEffect, useRef } from 'react';
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

    const availableUpgrades = ALL_PRIZES.filter(prize => selectedItem && prize.value > selectedItem.value)
                                       .sort((a, b) => a.value - b.value);

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

        // 1. Вращаем колесо 4.1 секунды
        setTimeout(() => {
            setRollResult(success ? 'success' : 'fail');
            performUpgrade(selectedItem.inventoryId, targetItem, success);

            // 2. Ждем окончания анимации результата
            // Анимация исчезновения длится 1.5с. Ставим таймер на 1.5с, чтобы сбросить сразу после нее.
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
                {/* Декоративное свечение за колесом */}
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

            {/* Зона выбора с новой стрелкой */}
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
                            <span>Предмет</span>
                        </div>
                    )}
                </div>

                {/* Стрелка между блоками */}
                <div className={`upgrade-arrow ${targetItem ? 'active' : ''}`}>
                    ➜
                </div>

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
                            <span>Цель</span>
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

            {/* Меню табов и сетка */}
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
                        Магазин
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
                            <div className="empty-state">Пусто</div>
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
                                <div className="empty-state">Нет доступных апгрейдов</div>
                             )
                         ) : (
                            <div className="empty-state">Выберите предмет слева</div>
                         )}
                    </div>
                </div>
            </div>
        </main>
    );
};

export default UpgradePage;
