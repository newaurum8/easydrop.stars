import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

// === НОВЫЙ КОМПОНЕНТ МОДАЛЬНОГО ОКНА ===
const ResultsModal = ({ winners, onClose }) => {
    // Состояние для каждого предмета: 'keep' (по умолчанию) или 'sell'
    // Изначально все 'keep'
    const [itemsStatus, setItemsStatus] = useState(
        new Array(winners.length).fill('keep')
    );

    const getRarityColor = (val) => {
        if (val >= 50000) return '#ffc107'; // Легендарный (Золото)
        if (val >= 10000) return '#f44336'; // Редкий (Красный)
        if (val >= 2000) return '#b388ff';  // Необычный (Фиолетовый)
        return '#00aaff';                   // Обычный (Синий)
    };

    const toggleItemStatus = (index) => {
        setItemsStatus(prev => {
            const newStatus = [...prev];
            newStatus[index] = newStatus[index] === 'keep' ? 'sell' : 'keep';
            return newStatus;
        });
    };

    // Подсчет итогов
    const itemsToSell = winners.filter((_, i) => itemsStatus[i] === 'sell');
    const itemsToKeep = winners.filter((_, i) => itemsStatus[i] === 'keep');
    
    const sellAmount = itemsToSell.reduce((sum, item) => sum + item.value, 0);
    const totalCount = winners.length;
    const sellCount = itemsToSell.length;

    const handleConfirm = () => {
        onClose(itemsToSell, itemsToKeep);
    };

    return (
        <div className="win-modal-overlay">
            <div className="win-content-wrapper">
                <div className="win-header">
                    <h2>Поздравляем!</h2>
                    <p>Нажми на предмет, чтобы продать его</p>
                </div>

                <div className="win-grid">
                    {winners.map((item, index) => {
                        const status = itemsStatus[index]; // 'keep' or 'sell'
                        const color = getRarityColor(item.value);
                        
                        return (
                            <div 
                                key={index}
                                className={`win-card status-${status}`}
                                style={{ '--rarity-color': color, animationDelay: `${index * 0.1}s` }}
                                onClick={() => toggleItemStatus(index)}
                            >
                                {/* Оверлей при продаже */}
                                <div className="win-card-overlay">
                                    <div className="sell-icon-big">💰</div>
                                    <span className="sell-text">Продать</span>
                                </div>

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

            {/* Нижняя панель действий */}
            <div className="win-actions-bar">
                <button 
                    className={`action-btn-main ${sellCount === 0 ? 'btn-style-keep' : 'btn-style-mix'}`}
                    onClick={handleConfirm}
                >
                    <div className="btn-left">
                        {sellCount === 0 
                            ? <span>ЗАБРАТЬ ВСЁ</span> 
                            : (sellCount === totalCount 
                                ? <span>ПРОДАТЬ ВСЁ</span> 
                                : <span>ЗАБРАТЬ И ПРОДАТЬ</span>
                              )
                        }
                        {sellCount > 0 && sellCount < totalCount && (
                            <span className="btn-sub">{itemsToKeep.length} в инвентарь, {sellCount} на продажу</span>
                        )}
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

const CasePage = () => {
    const { caseId } = useParams();
    const { user, balance, updateBalance, addToInventory, addToHistory, getWeightedRandomPrize, ALL_CASES, ALL_PRIZES } = useContext(AppContext);

    const currentCase = useMemo(() => ALL_CASES.find(c => c.id === caseId), [caseId, ALL_CASES]);
    const [localActivations, setLocalActivations] = useState(0);

    useEffect(() => {
        if (currentCase) setLocalActivations(currentCase.currentActivations || 0);
    }, [currentCase]);

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
    const [winningPrizes, setWinningPrizes] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [promoCode, setPromoCode] = useState('');
    const [isPromoValid, setIsPromoValid] = useState(false);

    const carouselRefs = useRef([]);
    carouselRefs.current = [...Array(quantity)].map((_, i) => carouselRefs.current[i] ?? React.createRef());

    useEffect(() => {
        if (currentCasePrizes?.length) setWinningPrizes(Array(quantity).fill(currentCasePrizes[0]));
    }, [quantity, currentCasePrizes]);

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
                    if (items[stopIndex]) items[stopIndex].classList.add('winning-item');
                    resolve();
                }, durationInMs);
            });
        });

        Promise.all(animationPromises).then(() => {
            addToHistory(winningPrizes);
            setTimeout(() => setShowModal(true), 500);
        });
    }, [isRolling, winningPrizes, isFastRoll, addToHistory]);

    const handlePromoCodeChange = (e) => {
        const code = e.target.value;
        setPromoCode(code);
        if (currentCase && currentCase.promoCode && code.trim().toLowerCase() === currentCase.promoCode.toLowerCase()) {
            setIsPromoValid(true);
        } else {
            setIsPromoValid(false);
        }
    };

    const handleRoll = async () => {
        if (!currentCase || !currentCasePrizes || currentCasePrizes.length === 0) return;
        
        if (currentCase.maxActivations > 0 && localActivations >= currentCase.maxActivations) {
            return alert('Лимит кейса исчерпан');
        }

        if (currentCase.isPromo) {
            if (!isPromoValid) return alert("Неверный промокод");
        } else {
            const cost = currentCase.price * quantity;
            if (balance < cost || isRolling) return;
            updateBalance(-cost);
        }

        try {
            const res = await fetch('/api/case/spin', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ 
                    caseId: currentCase.id,
                    userId: user ? user.id : null, 
                    quantity: quantity
                })
            });
            const data = await res.json();
            
            if (data.error === 'Case limit reached') {
                if (!currentCase.isPromo) updateBalance(currentCase.price * quantity);
                return alert('К сожалению, лимит активаций этого кейса исчерпан.');
            } else {
                setLocalActivations(prev => prev + quantity); 
            }
        } catch (e) { console.error(e); return; }

        setShowModal(false);
        const winners = Array.from({ length: quantity }).map(() => getWeightedRandomPrize(currentCasePrizes));
        setWinningPrizes(winners);
        setIsRolling(true);
    };

    const handleCloseResults = (itemsToSell, itemsToKeep) => {
        const earnings = itemsToSell.reduce((sum, item) => sum + item.value, 0);
        if (earnings > 0) updateBalance(earnings);
        if (itemsToKeep.length > 0) addToInventory(itemsToKeep);
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
                {winningPrizes.map((prize, i) => (
                    <Carousel key={`${quantity}-${i}`} ref={carouselRefs.current[i]} winningPrize={prize} prizes={currentCasePrizes} quantity={quantity} />
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
