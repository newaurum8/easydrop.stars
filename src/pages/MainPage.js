import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import '../styles/home.css';

// --- КОМПОНЕНТ LIVE ЛЕНТЫ ---
const LiveFeed = () => {
    const { ALL_PRIZES } = useContext(AppContext);
    const [feed, setFeed] = useState([]);

    useEffect(() => {
        if (!ALL_PRIZES || ALL_PRIZES.length === 0) return;

        const initialFeed = Array(15).fill(null).map(() => 
            ALL_PRIZES[Math.floor(Math.random() * ALL_PRIZES.length)]
        );
        setFeed(initialFeed);

        const interval = setInterval(() => {
            setFeed(prev => {
                const newItem = ALL_PRIZES[Math.floor(Math.random() * ALL_PRIZES.length)];
                return [newItem, ...prev.slice(0, 14)];
            });
        }, 2500);

        return () => clearInterval(interval);
    }, [ALL_PRIZES]);

    const getRarityColor = (val) => {
        if (val >= 50000) return '#ffc107';
        if (val >= 10000) return '#f44336';
        if (val >= 2000) return '#9c27b0';
        return '#00aaff';
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
            
            {/* БАННЕР УДАЛЕН ОТСЮДА */}

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
