import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

// --- МОДАЛЬНОЕ ОКНО РЕЗУЛЬТАТОВ ---
const ResultsModal = ({ winners, onClose }) => {
    const [selectedIds, setSelectedIds] = useState(new Set());

    const toggleSelection = (index) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    const handleSell = () => {
        const itemsToSell = [];
        const itemsToKeep = [];
        winners.forEach((item, index) => {
            if (selectedIds.has(index)) {
                itemsToSell.push(item);
            } else {
                itemsToKeep.push(item);
            }
        });
        onClose(itemsToSell, itemsToKeep);
    };

    const handleKeepAll = () => {
        onClose([], winners);
    };

    const totalSellValue = winners
        .filter((_, index) => selectedIds.has(index))
        .reduce((sum, item) => sum + item.value, 0);

    return (
        <div className="results-modal">
            <div className="results-modal-content">
                <h3>Ваш выигрыш:</h3>
                <div className="results-grid">
                    {winners.map((item, index) => (
                        <div
                            key={index}
                            className={`result-item ${selectedIds.has(index) ? 'selected' : ''}`}
                            onClick={() => toggleSelection(index)}
                        >
                            <img src={item.image} alt={item.name} />
                            <span className="prize-name">{item.name}</span>
                            <div className="prize-value">
                                <img src="/images/stars.png" className="star-icon small" alt="star"/>
                                <span>{item.value.toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="results-actions">
                    <button
                        className="sell-button"
                        onClick={handleSell}
                        disabled={selectedIds.size === 0}
                    >
                        Продать выбранное ({totalSellValue.toLocaleString()})
                    </button>
                    <button
                        id="close-modal-btn"
                        onClick={handleKeepAll}
                    >
                        Получить все предметы
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- КОМПОНЕНТ КАРУСЕЛИ ---
const Carousel = React.forwardRef(({ winningPrize, prizes, quantity }, ref) => {
    const totalCarouselItems = 100;
    const stopIndex = 80;

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
                    <div className="carousel-item" key={`${item.id}-${index}-${Date.now()}`}>
                        <img src={item.image} alt={item.name} />
                    </div>
                ))}
            </div>
        </div>
    );
});

// --- ОСНОВНОЙ КОМПОНЕНТ СТРАНИЦЫ ---
const CasePage = () => {
    const { caseId } = useParams();
    const { balance, updateBalance, addToInventory, addToHistory, getWeightedRandomPrize, ALL_CASES, ALL_PRIZES } = useContext(AppContext);

    const currentCase = useMemo(() => ALL_CASES.find(c => c.id === caseId), [caseId, ALL_CASES]);

    const currentCasePrizes = useMemo(() => {
        if (!currentCase || !ALL_PRIZES || !currentCase.prizeIds) return [];
        
        return currentCase.prizeIds.map(config => {
            const prizeId = typeof config === 'object' ? config.id : config;
            const customChance = typeof config === 'object' ? config.chance : null;

            const baseItem = ALL_PRIZES.find(p => p.id === prizeId);
            if (!baseItem) return null;
            
            return { 
                ...baseItem, 
                chance: customChance !== null ? Number(customChance) : baseItem.chance 
            };
        }).filter(Boolean);
    }, [currentCase, ALL_PRIZES]);

    const [quantity, setQuantity] = useState(1);
    const [isFastRoll, setIsFastRoll] = useState(false);
    const [isRolling, setIsRolling] = useState(false);
    const [winningPrizes, setWinningPrizes] = useState([]);
    const [showModal, setShowModal] = useState(false);
    
    // Новые стейты для промокода
    const [promoCode, setPromoCode] = useState('');
    const [isPromoValid, setIsPromoValid] = useState(false);

    const carouselRefs = useRef([]);
    carouselRefs.current = [...Array(quantity)].map((_, i) => carouselRefs.current[i] ?? React.createRef());

    useEffect(() => {
        if (currentCasePrizes?.length) {
            setWinningPrizes(Array(quantity).fill(currentCasePrizes[0]));
        }
    }, [quantity, currentCasePrizes]);

    // Анимация прокрутки
    useEffect(() => {
        if (!isRolling) return;

        const animationPromises = carouselRefs.current.map(ref => {
            return new Promise(resolve => {
                const carouselTrack = ref.current;
                if (!carouselTrack) return resolve();

                const items = carouselTrack.querySelectorAll('.carousel-item');
                if (items.length === 0) return resolve();

                const stopIndex = 80;
                const winnerEl = carouselTrack.querySelector('.winning-item');
                if (winnerEl) winnerEl.classList.remove('winning-item');

                carouselTrack.classList.remove('is-rolling', 'fast');
                carouselTrack.style.transform = 'translateX(0)';
                void carouselTrack.offsetHeight; 

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
                    if (items[stopIndex]) {
                       items[stopIndex].classList.add('winning-item');
                    }
                    resolve();
                }, durationInMs);
            });
        });

        Promise.all(animationPromises).then(() => {
            addToHistory(winningPrizes);
            setTimeout(() => {
                setShowModal(true);
            }, 500);
        });
    }, [isRolling, winningPrizes, isFastRoll, addToHistory]);

    // Обработка ввода промокода
    const handlePromoCodeChange = (e) => {
        const code = e.target.value;
        setPromoCode(code);
        
        // Сверяем с кодом из объекта кейса
        if (currentCase && currentCase.promoCode && code.trim().toLowerCase() === currentCase.promoCode.toLowerCase()) {
            setIsPromoValid(true);
        } else {
            setIsPromoValid(false);
        }
    };

    const handleRoll = async () => {
        if (!currentCase || !currentCasePrizes || currentCasePrizes.length === 0) return;
        
        // 1. Проверка условий (промокод или баланс)
        if (currentCase.isPromo) {
            if (!isPromoValid) return alert("Неверный промокод");
        } else {
            const cost = currentCase.price * quantity;
            if (balance < cost || isRolling) return;
            updateBalance(-cost);
        }

        // 2. Отправка запроса на сервер для фиксации прокрута
        try {
            const res = await fetch('/api/case/spin', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ caseId: currentCase.id })
            });
            const data = await res.json();
            
            if (data.error === 'Case limit reached') {
                if (!currentCase.isPromo) {
                    updateBalance(currentCase.price * quantity); // Возврат денег
                }
                return alert('К сожалению, лимит активаций этого кейса исчерпан.');
            }
        } catch (e) {
            console.error(e);
            return;
        }

        setShowModal(false);
        
        const winners = Array.from({ length: quantity }).map(() => getWeightedRandomPrize(currentCasePrizes));
        setWinningPrizes(winners);
        
        setIsRolling(true);
    };

    const handleCloseResults = (itemsToSell, itemsToKeep) => {
        const earnings = itemsToSell.reduce((sum, item) => sum + item.value, 0);
        if (earnings > 0) {
            updateBalance(earnings);
        }
        if (itemsToKeep.length > 0) {
            addToInventory(itemsToKeep);
        }
        setShowModal(false);
        setIsRolling(false);
    };

    const changeQuantity = (num) => {
        if (isRolling) return;
        setQuantity(num);
    }

    if (!currentCase) {
        return <Navigate to="/" />;
    }

    const isButtonDisabled = isRolling || (currentCase.isPromo ? !isPromoValid : balance < currentCase.price * quantity);
    
    // --- ЛОГИКА ОТОБРАЖЕНИЯ ПОЛОСКИ ЛИМИТА ---
    const isLimited = currentCase.maxActivations > 0;
    // Считаем процент заполнения (текущие / макс * 100)
    const progressPercent = isLimited 
        ? Math.min(100, (currentCase.currentActivations / currentCase.maxActivations) * 100) 
        : 0;

    return (
        <div className="app-container case-page-body">
            {showModal && <ResultsModal winners={winningPrizes} onClose={handleCloseResults} />}
            <Link to="/" className="back-button">‹ Назад</Link>

            <div id="multi-roll-container">
                <div className="carousel-indicator"></div>
                {winningPrizes.map((prize, i) => (
                    <Carousel 
                        key={`${quantity}-${i}`} 
                        ref={carouselRefs.current[i]} 
                        winningPrize={prize} 
                        prizes={currentCasePrizes} 
                        quantity={quantity} 
                    />
                ))}
                <div className="carousel-indicator bottom"></div>
            </div>

            <div className="controls-panel">
                {/* Если кейс Лимитированный, показываем особую кнопку с прогрессом */}
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
                            style={{position: 'relative', overflow: 'hidden'}}
                        >
                            {/* Полоска прогресса (синяя) */}
                            <div 
                                className="roll-button-progress" 
                                style={{ 
                                    width: `${progressPercent}%`, 
                                    backgroundColor: '#00aaff', 
                                    position: 'absolute', 
                                    left: 0, top: 0, bottom: 0, 
                                    zIndex: 1,
                                    transition: 'width 0.5s ease'
                                }}
                            ></div>
                            
                            {/* Текст поверх полоски (цифры) */}
                            <span className="roll-button-text" style={{zIndex: 2, position: 'relative', fontSize: '18px', fontWeight: 'bold'}}>
                                {currentCase.currentActivations} / {currentCase.maxActivations}
                            </span>
                        </button>
                    </div>
                ) : (
                    // --- ОБЫЧНЫЙ РЕЖИМ (БЕЗ ЛИМИТА) ---
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
                                <span className="roll-button-text">Открыть за {currentCase.price * quantity}</span>
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
