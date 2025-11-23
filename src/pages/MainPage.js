import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import '../styles/home.css'; // Подключение новых стилей

// --- КОМПОНЕНТ LIVE ЛЕНТЫ ---
const LiveFeed = () => {
    const { ALL_PRIZES } = useContext(AppContext);
    const [feed, setFeed] = useState([]);

    useEffect(() => {
        // Если призы еще не загрузились, ничего не делаем
        if (!ALL_PRIZES || ALL_PRIZES.length === 0) return;

        // Инициализируем ленту случайными предметами для старта
        const initialFeed = Array(15).fill(null).map(() => 
            ALL_PRIZES[Math.floor(Math.random() * ALL_PRIZES.length)]
        );
        setFeed(initialFeed);

        // Запускаем цикл обновления ленты
        const interval = setInterval(() => {
            setFeed(prev => {
                const newItem = ALL_PRIZES[Math.floor(Math.random() * ALL_PRIZES.length)];
                // Добавляем новый элемент в начало и убираем последний, чтобы длина была постоянной
                return [newItem, ...prev.slice(0, 14)];
            });
        }, 2500); // Каждые 2.5 секунды новый дроп

        return () => clearInterval(interval);
    }, [ALL_PRIZES]);

    // Определение цвета рамки в зависимости от цены предмета
    const getRarityColor = (val) => {
        if (val >= 50000) return '#ffc107'; // Легендарный (Золотой)
        if (val >= 10000) return '#f44336'; // Редкий (Красный)
        if (val >= 2000) return '#9c27b0';  // Эпический (Фиолетовый)
        return '#00aaff';                   // Обычный (Синий)
    };

    return (
        <div className="live-feed-container">
            <div className="live-label">LIVE DROP</div>
            <div className="live-track">
                {feed.map((item, i) => (
                    <div 
                        key={`${item.id}-${i}`} 
                        className="live-card" 
                        style={{borderColor: getRarityColor(item.value)}}
                    >
                        <img src={item.image} alt="" />
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- ОСНОВНАЯ СТРАНИЦА ---
const MainPage = () => {
    const { ALL_CASES } = useContext(AppContext);

    // Хелпер для настройки цветов тегов и свечения кейса
    const getTagStyle = (tag) => {
        switch(tag) {
            case 'promo': return { color: '#ff4081', label: 'PROMO' }; // Розовый
            case 'limited': return { color: '#ff9100', label: 'LIMITED' }; // Оранжевый
            case 'legendary': return { color: '#ffd700', label: 'LEGEND' }; // Золотой
            case 'epic': return { color: '#d500f9', label: 'EPIC' }; // Фиолетовый
            case 'rare': return { color: '#2979ff', label: 'RARE' }; // Синий
            default: return { color: '#78909c', label: 'COMMON' }; // Серый
        }
    };

    return (
        <>
            <LiveFeed />
            
            {/* Баннер */}
            <div className="hero-banner">
                <h2>КЕЙСЫ</h2>
                <p>Открывай и выигрывай ценные призы!</p>
            </div>

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
                                // Передаем цвет свечения через CSS переменную
                                style={{'--glow-color': color}}
                            >
                                {/* Тег в углу */}
                                <div className="card-tag" style={{backgroundColor: color}}>
                                    {label}
                                </div>

                                {/* Фоновое свечение */}
                                <div className="card-glow"></div>
                                
                                {/* Изображение кейса */}
                                <div className="card-img-container">
                                    <img src={caseItem.image} className="card-image" alt={caseItem.name} />
                                </div>
                                
                                {/* Информация снизу */}
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
