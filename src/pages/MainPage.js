import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

// Компонент ленты живых дропов
const LiveFeed = () => {
    const { ALL_PRIZES } = useContext(AppContext);
    const [liveItems, setLiveItems] = useState([]);

    useEffect(() => {
        // Если призы еще не загрузились, ничего не делаем
        if (!ALL_PRIZES || ALL_PRIZES.length === 0) return;

        // Инициализация ленты случайными предметами
        const initialItems = Array(8).fill(null).map(() => 
            ALL_PRIZES[Math.floor(Math.random() * ALL_PRIZES.length)]
        );
        setLiveItems(initialItems);

        // Эмуляция выпадения новых предметов каждые 2.5 секунды
        const interval = setInterval(() => {
            setLiveItems(prevItems => {
                const newItems = [...prevItems];
                newItems.shift(); // Удаляем старый
                newItems.push(ALL_PRIZES[Math.floor(Math.random() * ALL_PRIZES.length)]); // Добавляем новый
                return newItems;
            });
        }, 2500);

        return () => clearInterval(interval);
    }, [ALL_PRIZES]);

    // Функция для определения цвета обводки в ленте (по цене)
    const getRarityClass = (value) => {
        if (value >= 50000) return 'rarity-gold';
        if (value >= 10000) return 'rarity-red';
        if (value >= 2000) return 'rarity-purple';
        return 'rarity-blue';
    };

    return (
        <section className="live-feed-container">
            <div className="live-label">LIVE DROPS</div>
            <div className="live-track">
                {liveItems.map((item, index) => (
                    <div 
                        key={`${item.id}-${index}`} 
                        className={`live-card ${getRarityClass(item.value)}`}
                    >
                        <img src={item.image} alt="" />
                    </div>
                ))}
            </div>
        </section>
    );
};

const MainPage = () => {
    const { ALL_CASES } = useContext(AppContext);

    // Хелпер для перевода тегов на русский
    const getTagLabel = (tag) => {
        switch(tag) {
            case 'promo': return 'ПРОМО';
            case 'limited': return 'ЛИМИТ';
            case 'legendary': return 'ЛЕГЕНДА';
            case 'rare': return 'РЕДКИЙ';
            default: return null;
        }
    };

    return (
        <>
            <LiveFeed />

            <div className="hero-banner">
                <h2>Испытай удачу</h2>
                <p>Открывай кейсы и выигрывай реальные призы</p>
            </div>

            <main className="content-grid">
                {/* Проверка на наличие данных перед маппингом */}
                {ALL_CASES && ALL_CASES.length > 0 ? (
                    ALL_CASES.map((caseItem) => (
                        <Link 
                            to={`/case/${caseItem.id}`} 
                            // Класс card-rarity-... задает цвет рамки и свечения
                            className={`case-card card-rarity-${caseItem.tag || 'common'}`} 
                            key={caseItem.id}
                        >
                            {/* Эффект свечения на фоне */}
                            <div className="card-glow"></div>
                            
                            <div className="card-header">
                                <span className="case-title">{caseItem.name}</span>
                                {caseItem.tag && caseItem.tag !== 'common' && (
                                    <span className={`tag tag-${caseItem.tag}`}>
                                        {getTagLabel(caseItem.tag)}
                                    </span>
                                )}
                            </div>
                            
                            <div className="card-img-container">
                                <img src={caseItem.image} alt={caseItem.name} className="card-image" />
                            </div>
                            
                            <div className="card-footer">
                                <img src="/images/stars.png" alt="Star" className="star-icon small" />
                                <span>
                                    {caseItem.price > 0 ? caseItem.price.toLocaleString() : 'FREE'}
                                </span>
                            </div>
                        </Link>
                    ))
                ) : (
                    <p style={{textAlign: 'center', gridColumn: '1 / -1', color: '#888'}}>
                        Загрузка кейсов...
                    </p>
                )}
            </main>
        </>
    );
};

export default MainPage;
