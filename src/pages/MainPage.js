import React, { useContext, useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import '../styles/home.css';

// --- КОМПОНЕНТ LIVE ЛЕНТЫ ---
const LiveFeed = () => {
    const { ALL_PRIZES } = useContext(AppContext);
    const [feed, setFeed] = useState([]);
    
    // Рефы для реализации перетаскивания (Drag-to-Scroll)
    const scrollRef = useRef(null);
    const isDragging = useRef(false);
    const startX = useRef(0);
    const scrollLeft = useRef(0);

    useEffect(() => {
        if (!ALL_PRIZES || ALL_PRIZES.length === 0) return;

        // Инициализация ленты уникальными ID
        const initialFeed = Array(20).fill(null).map((_, index) => ({
            ...ALL_PRIZES[Math.floor(Math.random() * ALL_PRIZES.length)],
            uniqueId: Date.now() - index 
        }));
        setFeed(initialFeed);

        // Ускоренный таймер (1500мс = 1.5 секунды)
        const interval = setInterval(() => {
            // Если пользователь держит ленту мышкой, не обновляем, чтобы не сбивать
            if (isDragging.current) return;

            setFeed(prev => {
                const newItem = {
                    ...ALL_PRIZES[Math.floor(Math.random() * ALL_PRIZES.length)],
                    uniqueId: Date.now() 
                };
                // Добавляем новый элемент в начало и удаляем последний
                return [newItem, ...prev.slice(0, 19)];
            });
        }, 1500);

        return () => clearInterval(interval);
    }, [ALL_PRIZES]);

    // Яркие цвета редкости
    const getRarityColor = (val) => {
        if (val >= 50000) return '#FFD700'; // Gold
        if (val >= 10000) return '#ff4081'; // Pink
        if (val >= 2000) return '#b388ff';  // Purple
        return '#40c4ff';                   // Blue
    };

    // --- ОБРАБОТЧИКИ ПЕРЕТАСКИВАНИЯ ---
    const startDragging = (e) => {
        isDragging.current = true;
        startX.current = e.pageX - scrollRef.current.offsetLeft;
        scrollLeft.current = scrollRef.current.scrollLeft;
    };

    const stopDragging = () => {
        isDragging.current = false;
    };

    const onDrag = (e) => {
        if (!isDragging.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX.current) * 2; // Коэффициент скорости прокрутки
        scrollRef.current.scrollLeft = scrollLeft.current - walk;
    };

    return (
        <div className="live-feed-container">
            {/* Вертикальный лейбл с мигающей точкой */}
            <div className="live-label">LIVE</div>
            
            <div 
                className="live-track"
                ref={scrollRef}
                onMouseDown={startDragging}
                onMouseLeave={stopDragging}
                onMouseUp={stopDragging}
                onMouseMove={onDrag}
            >
                {feed.map((item, i) => {
                    const color = getRarityColor(item.value);
                    return (
                        <div 
                            key={item.uniqueId} 
                            // Класс new-item только первому элементу для анимации появления
                            className={`live-card ${i === 0 ? 'new-item' : ''}`}
                            style={{ '--rarity-color': color }} 
                        >
                            <img src={item.image} alt="" draggable="false" />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- ОСНОВНАЯ СТРАНИЦА ---
const MainPage = () => {
    const { ALL_CASES } = useContext(AppContext);

    const getTagStyle = (tag) => {
        switch(tag) {
            case 'promo': return { color: '#ff4081', label: 'PROMO' };
            case 'limited': return { color: '#ff9100', label: 'LIMITED' };
            case 'legendary': return { color: '#ffd700', label: 'LEGEND' };
            case 'epic': return { color: '#d500f9', label: 'EPIC' };
            case 'rare': return { color: '#2979ff', label: 'RARE' };
            default: return { color: '#78909c', label: 'COMMON' };
        }
    };

    return (
        <>
            <LiveFeed />
            
            {/* Сетка кейсов */}
            <div className="content-grid">
                {ALL_CASES && ALL_CASES.length > 0 ? (
                    ALL_CASES.map((caseItem) => {
                        const { color, label } = getTagStyle(caseItem.tag);
                        
                        return (
                            <Link 
                                to={`/case/${caseItem.id}`} 
                                className="case-card" 
                                key={caseItem.id}
                                style={{'--glow-color': color}}
                            >
                                <div className="card-tag" style={{backgroundColor: color}}>
                                    {label}
                                </div>

                                <div className="card-glow"></div>
                                
                                <div className="card-img-container">
                                    <img src={caseItem.image} className="card-image" alt={caseItem.name} />
                                </div>
                                
                                <div className="card-info">
                                    <div className="case-title">{caseItem.name}</div>
                                    <div className="case-price">
                                        {caseItem.price > 0 ? caseItem.price.toLocaleString() : 'FREE'}
                                        {caseItem.price > 0 && (
                                            <img 
                                                src="/images/stars.png" 
                                                alt="star" 
                                                className="star-icon small" 
                                                style={{marginLeft: '4px'}} 
                                            />
                                        )}
                                    </div>
                                </div>
                            </Link>
                        );
                    })
                ) : (
                    <div style={{gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#888'}}>
                        Загрузка кейсов...
                    </div>
                )}
            </div>
        </>
    );
};

export default MainPage;
