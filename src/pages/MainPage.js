import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

// --- КОМПОНЕНТ LIVE ЛЕНТЫ ---
const LiveFeed = () => {
    const { ALL_PRIZES } = useContext(AppContext);
    const [feed, setFeed] = useState([]);

    useEffect(() => {
        // Ждем загрузки призов
        if (!ALL_PRIZES || ALL_PRIZES.length === 0) return;

        // Инициализируем ленту 10 случайными предметами
        const initial = Array(10).fill(null).map(() => 
            ALL_PRIZES[Math.floor(Math.random() * ALL_PRIZES.length)]
        );
        setFeed(initial);

        // Запускаем цикл обновления: добавляем новый предмет слева, удаляем справа
        const interval = setInterval(() => {
            setFeed(prev => {
                const next = [...prev];
                next.pop(); // Удаляем последний
                next.unshift(ALL_PRIZES[Math.floor(Math.random() * ALL_PRIZES.length)]); // Добавляем новый в начало
                return next;
            });
        }, 2000); // Каждые 2 секунды

        return () => clearInterval(interval);
    }, [ALL_PRIZES]);

    // Хелпер для цвета редкости в ленте
    const getRarityColor = (val) => {
        if (val >= 50000) return '#ffc107'; // Легендарный (Золотой)
        if (val >= 10000) return '#f44336'; // Редкий (Красный)
        if (val >= 2000) return '#9c27b0';  // Необычный (Фиолетовый)
        return '#00aaff';                   // Обычный (Синий)
    };

    return (
        <div className="live-feed-wrapper">
            <div className="live-badge">LIVE</div>
            <div className="live-track-container">
                {feed.map((item, i) => (
                    <div 
                        key={`${item.id}-${i}-${Date.now()}`} 
                        className="live-item-card" 
                        style={{ borderColor: getRarityColor(item.value) }}
                    >
                        {/* Свечение позади предмета */}
                        <div 
                            className="live-glow" 
                            style={{ background: getRarityColor(item.value) }}
                        ></div>
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

    // Хелпер для тегов на карточках кейсов
    const getTagData = (tag) => {
        switch(tag) {
            case 'promo': return { label: 'ПРОМО', color: '#9c27b0' };
            case 'limited': return { label: 'ЛИМИТ', color: '#ff9800' };
            case 'legendary': return { label: 'ЛЕГЕНДА', color: '#ffc107' };
            case 'rare': return { label: 'РЕДКИЙ', color: '#f44336' };
            default: return null;
        }
    };

    return (
        <>
            <LiveFeed />
            
            {/* Заголовок раздела (вместо старого баннера) */}
            <div style={{marginTop: '24px', marginBottom: '12px', paddingLeft: '4px'}}>
                <h2 style={{margin: 0, fontSize: '20px', fontWeight: 800, letterSpacing: '0.5px'}}>
                    КЕЙСЫ
                </h2>
            </div>

            <main className="content-grid">
                {ALL_CASES && ALL_CASES.length > 0 ? (
                    ALL_CASES.map((caseItem) => {
                        const tagData = getTagData(caseItem.tag);
                        
                        return (
                            <Link 
                                to={`/case/${caseItem.id}`} 
                                className="case-card-new" 
                                key={caseItem.id}
                                style={{
                                    borderColor: tagData ? tagData.color : '#3a4552'
                                }}
                            >
                                {/* Тег в углу (если есть) */}
                                {tagData && (
                                    <div className="case-tag" style={{background: tagData.color}}>
                                        {tagData.label}
                                    </div>
                                )}

                                {/* Фоновое свечение */}
                                <div 
                                    className="case-glow" 
                                    style={{
                                        background: tagData ? tagData.color : 'rgba(255,255,255,0.1)'
                                    }}
                                ></div>
                                
                                {/* Изображение кейса */}
                                <div className="case-img-box">
                                    <img src={caseItem.image} alt={caseItem.name} />
                                </div>
                                
                                {/* Информация снизу */}
                                <div className="case-info">
                                    <div className="case-name">{caseItem.name}</div>
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
            </main>
        </>
    );
};

export default MainPage;
