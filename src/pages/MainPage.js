import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

const LiveFeed = () => {
    const { ALL_PRIZES } = useContext(AppContext);
    const [liveItems, setLiveItems] = useState([]);
    const maxItems = 8;

    useEffect(() => {
        if (!ALL_PRIZES || ALL_PRIZES.length === 0) return;

        const initialItems = [];
        for (let i = 0; i < maxItems; i++) {
            initialItems.push(ALL_PRIZES[Math.floor(Math.random() * ALL_PRIZES.length)]);
        }
        setLiveItems(initialItems);

        const interval = setInterval(() => {
            setLiveItems(prevItems => {
                const newItems = [...prevItems];
                newItems.shift();
                newItems.push(ALL_PRIZES[Math.floor(Math.random() * ALL_PRIZES.length)]);
                return newItems;
            });
        }, 2000);

        return () => clearInterval(interval);
    }, [ALL_PRIZES]);

    return (
        <section className="live-feed">
            <span className="live-indicator">LIVE</span>
            <div className="live-icons">
                {liveItems.map((item, index) => (
                    <div className="live-icon-item" key={index}>
                        <img src={item.image} alt={item.name} />
                    </div>
                ))}
            </div>
        </section>
    );
};


const MainPage = () => {
    const { ALL_CASES } = useContext(AppContext);

    return (
        <>
            <LiveFeed />

            <section className="sorting-controls">
                <span className="sort-label">Сортировка</span>
                <div className="sort-dropdown">
                    <span>Лимитированные</span>
                    <span className="sort-arrows">▲▼</span>
                </div>
            </section>

            <main className="content-grid">
                {/* Используем optional chaining (?.) для безопасного вызова .map на случай, если данные еще не пришли */}
                {ALL_CASES?.map((caseItem, index) => (
                    <Link to={`/case/${caseItem.id}`} className="case-card" key={caseItem.id}>
                        <div className="card-header">
                            <span className="case-title">{caseItem.name}</span>
                            {caseItem.isPromo ? (
                                <span className="tag tag-promo">Промо</span>
                            ) : index === 0 ? (
                                <span className="tag tag-limit">Лимит</span>
                            ) : (
                                <span className="tag tag-rare">Редкий</span>
                            )}
                        </div>
                        <img src={caseItem.image} alt={`${caseItem.name} Case`} className="card-image" />
                        <div className="card-footer">
                             <img src="/images/stars.png" alt="Star" className="star-icon small" />
                            <span>{caseItem.price > 0 ? caseItem.price : 'Бесплатно'}</span>
                        </div>
                    </Link>
                ))}
            </main>
        </>
    );
};

export default MainPage;