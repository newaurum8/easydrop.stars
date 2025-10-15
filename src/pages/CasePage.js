// ... (весь код до return)
import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

// --- Модальное окно с выбором продажи (без изменений) ---
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

// --- Компонент Карусели ---
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
                    <div className="carousel-item" key={`${item.id}-${index}`}>
                        <img src={item.image} alt={item.name} />
                    </div>
                ))}
            </div>
        </div>
    );
});


// Основной компонент страницы
const CasePage = () => {
    const { caseId } = useParams(); // Получаем ID кейса из URL
    const { balance, updateBalance, addToInventory, addToHistory, getWeightedRandomPrize, ALL_CASES } = useContext(AppContext);

    // Находим данные текущего кейса по ID
    const currentCase = useMemo(() => ALL_CASES.find(c => c.id === caseId), [caseId, ALL_CASES]);

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
        // Устанавливаем призы по умолчанию для карусели при изменении кейса или количества
        if (currentCase?.prizes?.length) {
            setWinningPrizes(Array(quantity).fill(currentCase.prizes[0]));
        }
    }, [quantity, currentCase]);

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

    const handlePromoCodeChange = (e) => {
        const code = e.target.value;
        setPromoCode(code);
        // Здесь можно добавить более сложную логику проверки промокода
        if (code.toLowerCase() === 'promo') {
            setIsPromoValid(true);
        } else {
            setIsPromoValid(false);
        }
    };


    const handleRoll = () => {
        if (!currentCase) return;
        
        if (currentCase.isPromo) {
            if (!isPromoValid) return;
        } else {
            const cost = currentCase.price * quantity;
            if (balance < cost || isRolling) return;
            updateBalance(-cost);
        }


        setShowModal(false);
        const winners = Array.from({ length: quantity }).map(() => getWeightedRandomPrize(currentCase.prizes));
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


    return (
        <div className="app-container case-page-body">
            {showModal && <ResultsModal winners={winningPrizes} onClose={handleCloseResults} />}
            <Link to="/" className="back-button">‹ Назад</Link>

            <div id="multi-roll-container">
                <div className="carousel-indicator"></div>
                {winningPrizes.map((prize, i) => (
                    <Carousel key={`${quantity}-${i}`} ref={carouselRefs.current[i]} winningPrize={prize} prizes={currentCase.prizes} quantity={quantity} />
                ))}
                <div className="carousel-indicator bottom"></div>
            </div>

            <div className="controls-panel">
                {currentCase.isPromo ? (
                    <div className="promo-container">
                         <input
                            type="text"
                            value={promoCode}
                            onChange={handlePromoCodeChange}
                            placeholder="Введите промокод"
                            className="promo-input"
                        />
                        <button
                            id="roll-button"
                            className={`roll-button ${isButtonDisabled ? 'disabled' : ''}`}
                            onClick={handleRoll}
                            disabled={isButtonDisabled}
                        >
                            <span className="roll-button-text">Открыть бесплатно</span>
                        </button>
                    </div>
                ) : (
                    <>
                        <button
                            id="roll-button"
                            className={`roll-button ${isButtonDisabled ? 'disabled' : ''}`}
                            onClick={handleRoll}>
                            <div className="roll-button-progress" style={{ width: '91.3%' }}></div>
                            <span className="roll-button-text">Испытай удачу - {currentCase.price * quantity}</span>
                            <img src="/images/stars.png" alt="star" className="star-icon small roll-button-star" />
                            {/* СЧЕТЧИК УДАЛЕН ОТСЮДА */}
                        </button>
                        <div className="roll-options">
                            <div className="quantity-selector">
                                {[1, 2, 3, 4, 5].map(num => (
                                    <button
                                        key={num}
                                        className={`quantity-btn ${quantity === num ? 'active' : ''}`}
                                        onClick={() => changeQuantity(num)}>
                                        {num}
                                    </button>
                                ))}
                            </div>
                            <div className="fast-roll-toggle">
                                <input
                                    type="checkbox"
                                    id="fast-roll-checkbox"
                                    checked={isFastRoll}
                                    onChange={(e) => setIsFastRoll(e.target.checked)} />
                                <label htmlFor="fast-roll-checkbox">Быстро</label>
                            </div>
                        </div>
                    </>
                )}


                <div className="demo-mode-toggle">
                    <label className="switch">
                        <input type="checkbox" />
                        <span className="slider round"></span>
                    </label>
                    <span>Демо режим</span>
                </div>
            </div>
            <div className="prize-list">
                <h3 className="prize-list-header">Содержимое кейса: {currentCase.name}</h3>
                {currentCase.prizes.sort((a,b) => a.chance - b.chance).map(prize => (
                    <div key={prize.id} className="prize-item">
                        <div className="prize-item-image-wrapper">
                            <img src={prize.image} alt={prize.name} />
                        </div>
                        <div className="prize-item-info">
                            <span className="prize-name">{prize.name}</span>
                            <div className="prize-value">
                                <img src="/images/stars.png" alt="star" className="star-icon small" />
                                <span>{prize.value.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CasePage;