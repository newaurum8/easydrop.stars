import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

// === КОМПОНЕНТ МОДАЛЬНОГО ОКНА ===
const ResultsModal = ({ winners, onClose }) => {
    // По умолчанию все предметы выбраны на продажу (sell)
    const [itemsStatus, setItemsStatus] = useState(
        new Array(winners.length).fill('sell')
    );

    const getRarityColor = (val) => {
        if (val >= 50000) return '#ffc107'; // Легендарный
        if (val >= 10000) return '#f44336'; // Редкий
        if (val >= 2000) return '#b388ff';  // Необычный
        return '#00aaff';                   // Обычный
    };

    const toggleItemStatus = (index) => {
        setItemsStatus(prev => {
            const newStatus = [...prev];
            newStatus[index] = newStatus[index] === 'sell' ? 'keep' : 'sell';
            return newStatus;
        });
    };

    const itemsToSell = winners.filter((_, i) => itemsStatus[i] === 'sell');
    const itemsToKeep = winners.filter((_, i) => itemsStatus[i] === 'keep');
    
    const totalWonValue = winners.reduce((sum, item) => sum + item.value, 0);
    const sellAmount = itemsToSell.reduce((sum, item) => sum + item.value, 0);

    const totalCount = winners.length;
    const sellCount = itemsToSell.length;

    const handleConfirm = () => {
        onClose(itemsToSell, itemsToKeep);
    };

    let btnClass = 'btn-style-sell';
    let mainText = 'ПРОДАТЬ ВСЁ';
    let subText = null;

    if (sellCount === 0) {
        btnClass = 'btn-style-keep';
        mainText = 'ЗАБРАТЬ ВСЁ';
    } else if (sellCount < totalCount) {
        btnClass = 'btn-style-mix';
        mainText = `ПРОДАТЬ (${sellCount})`;
        subText = `Остальные ${itemsToKeep.length} в инвентарь`;
    }

    return (
        <div className="win-modal-overlay">
            <div className="win-content-wrapper">
                <div className="win-summary-clean">
                    <div className="win-summary-label">Общая ценность</div>
                    <div className="win-summary-value">
                        <img src="/images/stars.png" alt="" className="star-icon" />
                        {totalWonValue.toLocaleString()}
                    </div>
                </div>

                <div className="win-grid">
                    {winners.map((item, index) => {
                        const status = itemsStatus[index];
                        const color = getRarityColor(item.value);
                        
                        return (
                            <div 
                                key={`${item.inventoryId}-${index}`} // Используем inventoryId
                                className={`win-card status-${status}`}
                                style={{ '--rarity-color': color, animationDelay: `${index * 0.05}s` }}
                                onClick={() => toggleItemStatus(index)}
                            >
                                <img src={item.image} alt={item.name} className="win-card-img" />
                                <div className="win-card-name">{item.name}</div>
                                <div className="win-card-price">
                                    <img src="/images/stars.png" alt="" className="star-icon small" />
                                    <span>{item.value.toLocaleString()}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="win-actions-bar">
                <button className={`action-btn-main ${btnClass}`} onClick={handleConfirm}>
                    <div className="btn-left">
                        <span>{mainText}</span>
                        {subText && <span className="btn-sub">{subText}</span>}
                    </div>
                    {sellCount > 0 && (
                        <div className="btn-right">
                            <span>+{sellAmount.toLocaleString()}</span>
                            <img src="/images/stars.png" alt="" className="star-icon small"/>
                        </div>
                    )}
                </button>
            </div>
        </div>
    );
};

// === КАРУСЕЛЬ ===
const Carousel = React.forwardRef(({ winningPrize, prizes, quantity }, ref) => {
    const totalCarouselItems = 100;
    const stopIndex = 80;
    
    // Генерируем ленту. winningPrize - это уже определенный сервером предмет
    const items = useMemo(() => {
        if (!prizes || prizes.length === 0) return [];
        return Array.from({ length: totalCarouselItems }).map((_, i) =>
            i === stopIndex ? winningPrize : prizes[Math.floor(Math.random() * prizes.length)]
        )
    }, [winningPrize, prizes]);

    return (
        <div className={`item-carousel-wrapper size-${quantity}`}>
            <div className="item-carousel" ref={ref}>
                {items.map((item, index) => (
                    <div className="carousel-item" key={`carousel-${index}-${Date.now()}`}>
                        <img src={item.image} alt={item.name} />
                    </div>
                ))}
            </div>
        </div>
    );
});

// === СТРАНИЦА КЕЙСА ===
const CasePage = () => {
    const { caseId } = useParams();
    const { 
        user, balance, 
        spinCase, sellItem, // Берем методы из обновленного контекста
        ALL_CASES, ALL_PRIZES 
    } = useContext(AppContext);

    const currentCase = useMemo(() => ALL_CASES.find(c => c.id === caseId), [caseId, ALL_CASES]);
    const [localActivations, setLocalActivations] = useState(0);

    // Синхронизируем локальный счетчик открытий с данными кейса
    useEffect(() => {
        if (currentCase) setLocalActivations(currentCase.currentActivations || 0);
    }, [currentCase]);

    // Собираем массив возможных призов для отображения в списке и карусели
    const currentCasePrizes = useMemo(() => {
        if (!currentCase || !ALL_PRIZES || !currentCase.prizeIds) return [];
        return currentCase.prizeIds.map(config => {
            const prizeId = typeof config === 'object' ? config.id : config;
            const customChance = typeof config === 'object' ? config.chance : null;
            const baseItem = ALL_PRIZES.find(p => p.id === prizeId);
            if (!baseItem) return null;
            return { ...baseItem, chance: customChance !== null ? Number(customChance) : baseItem.chance };
        }).filter(Boolean);
    }, [currentCase, ALL_PRIZES]);

    const [quantity, setQuantity] = useState(1);
    const [isFastRoll, setIsFastRoll] = useState(false);
    const [isRolling, setIsRolling] = useState(false);
    const [winningPrizes, setWinningPrizes] = useState([]); // Сюда упадут результаты с сервера
    const [showModal, setShowModal] = useState(false);
    const [promoCode, setPromoCode] = useState('');
    const [isPromoValid, setIsPromoValid] = useState(false);

    const carouselRefs = useRef([]);
    carouselRefs.current = [...Array(quantity)].map((_, i) => carouselRefs.current[i] ?? React.createRef());

    // Инициализация каруселей заглушками до прокрутки
    useEffect(() => {
        if (currentCasePrizes?.length && !isRolling && winningPrizes.length === 0) {
            setWinningPrizes(Array(quantity).fill(currentCasePrizes[0]));
        }
    }, [quantity, currentCasePrizes, isRolling, winningPrizes.length]);

    // ЛОГИКА АНИМАЦИИ
    useEffect(() => {
        if (!isRolling) return;
        
        const animationPromises = carouselRefs.current.map((ref, index) => {
            return new Promise(resolve => {
                const carouselTrack = ref.current;
                if (!carouselTrack) return resolve();
                
                // ВАЖНО: winningPrizes[index] уже содержит правильный предмет с сервера
                
                const items = carouselTrack.querySelectorAll('.carousel-item');
                if (items.length === 0) return resolve();

                const stopIndex = 80;
                const winnerEl = carouselTrack.querySelector('.winning-item');
                if (winnerEl) winnerEl.classList.remove('winning-item');

                carouselTrack.classList.remove('is-rolling', 'fast');
                carouselTrack.style.transform = 'translateX(0)';
                void carouselTrack.offsetHeight; // Trigger reflow

                const itemStyle = window.getComputedStyle(items[0]);
                const itemWidth = items[0].offsetWidth + parseInt(itemStyle.marginLeft) + parseInt(itemStyle.marginRight);
                const offsetToCenter = (carouselTrack.parentElement.offsetWidth / 2) - (itemWidth / 2);
                const finalPosition = -(stopIndex * itemWidth - offsetToCenter);
                const randomJitter = (Math.random() - 0.5) * (itemWidth * 0.4);

                carouselTrack.style.transform = `translateX(${finalPosition + randomJitter}px)`;
                carouselTrack.classList.add('is-rolling');
                if (isFastRoll) carouselTrack.classList.add('fast');

                const durationInMs = (isFastRoll ? 0.8 : 6) * 1000;
                setTimeout(() => {
                    if (items[stopIndex]) items[stopIndex].classList.add('winning-item');
                    resolve();
                }, durationInMs);
            });
        });

        Promise.all(animationPromises).then(() => {
            // Анимация закончилась, показываем модалку
            setTimeout(() => setShowModal(true), 500);
        });
    }, [isRolling, winningPrizes, isFastRoll]);

    const handlePromoCodeChange = (e) => {
        const code = e.target.value;
        setPromoCode(code);
        if (currentCase && currentCase.promoCode && code.trim().toLowerCase() === currentCase.promoCode.toLowerCase()) {
            setIsPromoValid(true);
        } else {
            setIsPromoValid(false);
        }
    };

    // --- ГЛАВНАЯ ФУНКЦИЯ ОТКРЫТИЯ (SERVER SIDE) ---
    const handleRoll = async () => {
        if (!currentCase || !currentCasePrizes || isRolling) return;
        
        // Предварительная проверка (полная проверка будет на сервере)
        if (currentCase.maxActivations > 0 && localActivations >= currentCase.maxActivations) {
            return alert('Лимит кейса исчерпан');
        }

        if (currentCase.isPromo) {
            if (!isPromoValid) return alert("Неверный промокод");
        } else {
            const cost = currentCase.price * quantity;
            if (balance < cost) return alert("Недостаточно средств");
        }

        // Вызываем безопасный метод из контекста
        // Он вернет { success: true, wonItems: [...] } или ошибку
        const result = await spinCase(currentCase.id, quantity);

        if (!result.success) {
            return alert(result.error || "Ошибка при открытии кейса");
        }

        // Обновляем локальный счетчик открытий для UI
        setLocalActivations(prev => prev + quantity);

        // Устанавливаем победителей, полученных с сервера
        setWinningPrizes(result.wonItems);
        setShowModal(false);
        setIsRolling(true); // Запускаем анимацию
    };

    // Обработка закрытия модалки
    const handleCloseResults = async (itemsToSell, itemsToKeep) => {
        // itemsToKeep - уже в инвентаре (сервер добавил их при спине), ничего делать не надо.
        
        // itemsToSell - нужно продать. Сервер уже добавил их, теперь удаляем и начисляем баланс.
        // Выполняем продажу последовательно (или можно добавить endpoint sell-bulk)
        for (const item of itemsToSell) {
            await sellItem(item.inventoryId);
        }

        // Баланс обновится автоматически внутри sellItem через контекст
        setShowModal(false);
        setIsRolling(false);
    };

    const changeQuantity = (num) => {
        if (isRolling) return;
        setQuantity(num);
    }

    if (!currentCase) return <Navigate to="/" />;

    const isButtonDisabled = isRolling || (currentCase.isPromo ? !isPromoValid : balance < currentCase.price * quantity);
    const isLimited = currentCase.maxActivations > 0;
    const progressPercent = isLimited ? Math.min(100, (localActivations / currentCase.maxActivations) * 100) : 0;

    return (
        <div className="app-container case-page-body">
            {showModal && <ResultsModal winners={winningPrizes} onClose={handleCloseResults} />}
            <Link to="/" className="back-button">‹ Назад</Link>

            <div id="multi-roll-container">
                <div className="carousel-indicator"></div>
                {/* Рендерим N каруселей */}
                {Array.from({length: quantity}).map((_, i) => (
                    <Carousel 
                        key={`${quantity}-${i}`} 
                        ref={carouselRefs.current[i]} 
                        winningPrize={winningPrizes[i] || currentCasePrizes[0]} 
                        prizes={currentCasePrizes} 
                        quantity={quantity} 
                    />
                ))}
                <div className="carousel-indicator bottom"></div>
            </div>

            <div className="controls-panel">
                {isLimited ? (
                     <div className="promo-container">
                        {currentCase.isPromo && (
                             <input
                                type="text"
                                value={promoCode}
                                onChange={handlePromoCodeChange}
                                placeholder="Введите промокод"
                                className="promo-input"
                                style={{marginBottom:'10px'}}
                            />
                        )}
                        
                        <button
                            className={`roll-button ${isButtonDisabled ? 'disabled' : ''}`}
                            onClick={handleRoll}
                            disabled={isButtonDisabled}
                            style={{
                                position: 'relative', overflow: 'hidden', 
                                flexDirection: 'column', alignItems: 'center', padding: '10px'
                            }}
                        >
                            <div 
                                className="roll-button-progress" 
                                style={{ 
                                    width: `${progressPercent}%`, 
                                    backgroundColor: '#00aaff', 
                                    position: 'absolute', left: 0, top: 0, bottom: 0, 
                                    zIndex: 1, transition: 'width 0.3s ease-out'
                                }}
                            ></div>
                            
                            <div style={{zIndex: 2, position: 'relative', display:'flex', alignItems:'center', gap:'5px'}}>
                                <span className="roll-button-text" style={{fontSize: '16px', fontWeight: 'bold', textTransform: 'uppercase'}}>
                                    {currentCase.isPromo ? 'ОТКРЫТЬ БЕСПЛАТНО' : `ОТКРЫТЬ ЗА ${(currentCase.price * quantity).toLocaleString()}`}
                                </span>
                                {!currentCase.isPromo && (
                                    <img src="/images/stars.png" alt="star" className="star-icon small" style={{filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.3))'}} />
                                )}
                            </div>

                            <div style={{
                                zIndex: 2, position: 'relative', fontSize: '11px', 
                                marginTop: '4px', opacity: 0.9, fontWeight: '500',
                                background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '10px'
                            }}>
                                {localActivations} / {currentCase.maxActivations}
                            </div>
                        </button>
                    </div>
                ) : (
                    currentCase.isPromo ? (
                        <div className="promo-container">
                             <input
                                type="text"
                                value={promoCode}
                                onChange={handlePromoCodeChange}
                                placeholder="Введите промокод"
                                className="promo-input"
                            />
                            <button className={`roll-button ${isButtonDisabled ? 'disabled' : ''}`} onClick={handleRoll} disabled={isButtonDisabled}>
                                <span className="roll-button-text">Открыть бесплатно</span>
                            </button>
                        </div>
                    ) : (
                        <>
                             <button className={`roll-button ${isButtonDisabled ? 'disabled' : ''}`} onClick={handleRoll} disabled={isButtonDisabled}>
                                <span className="roll-button-text">Открыть за {(currentCase.price * quantity).toLocaleString()}</span>
                                <img src="/images/stars.png" alt="star" className="star-icon small roll-button-star" style={{marginLeft: 5}} />
                            </button>
                            
                            <div className="roll-options">
                                <div className="quantity-selector">
                                    {[1, 2, 3, 4, 5].map(num => (
                                        <button key={num} className={`quantity-btn ${quantity === num ? 'active' : ''}`} onClick={() => changeQuantity(num)}>
                                            {num}
                                        </button>
                                    ))}
                                </div>
                                <div className="fast-roll-toggle">
                                    <label className="switch">
                                        <input type="checkbox" checked={isFastRoll} onChange={(e) => setIsFastRoll(e.target.checked)} disabled={isRolling} />
                                        <span className="slider round"></span>
                                    </label>
                                    <label style={{cursor: isRolling ? 'not-allowed' : 'pointer'}}>Быстро</label>
                                </div>
                            </div>
                        </>
                    )
                )}
            </div>

            <div className="prize-list">
                <h3 className="prize-list-header">Содержимое кейса</h3>
                {currentCasePrizes.sort((a,b) => a.value - b.value).map(prize => (
                    <div key={prize.id} className="prize-item">
                        <div className="prize-item-image-wrapper">
                            <img src={prize.image} alt={prize.name} />
                        </div>
                        <div className="prize-item-info">
                            <span className="prize-name">{prize.name}</span>
                            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                                <div className="prize-value">
                                    <img src="/images/stars.png" alt="star" className="star-icon small" />
                                    <span>{prize.value.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CasePage;
