import React, { useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';

const HistoryPage = () => {
    const { history } = useContext(AppContext);

    // Функция для определения класса редкости по ценности предмета
    const getRarityClass = (value) => {
        if (value >= 100000) return 'rarity-legendary'; // Легендарный
        if (value >= 10000) return 'rarity-rare';      // Редкий
        if (value >= 2000) return 'rarity-uncommon';    // Необычный
        return 'rarity-common';                         // Обычный
    };

    // Функция для форматирования заголовка даты
    const getFormattedDateHeader = (dateString) => {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const todayString = today.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
        const yesterdayString = yesterday.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });

        if (dateString === todayString) return 'Сегодня';
        if (dateString === yesterdayString) return 'Вчера';
        return dateString;
    };

    // Группируем историю по датам с помощью useMemo для оптимизации
    const groupedHistory = useMemo(() => {
        return history.reduce((acc, item) => {
            const dateKey = new Date(item.date).toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push(item);
            return acc;
        }, {});
    }, [history]);

    return (
        <main className="history-content">
            <h3>История открытий</h3>
            <div className="history-list">
                {history.length === 0 ? (
                    <p className="empty-inventory-message">Вы еще не открывали кейсы</p>
                ) : (
                    Object.entries(groupedHistory).map(([date, items]) => (
                        <div key={date} className="history-group">
                            <h4 className="history-group-header">{getFormattedDateHeader(date)}</h4>
                            {items.map((item, index) => {
                                const itemDate = new Date(item.date);
                                const formattedTime = itemDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                const rarityClass = getRarityClass(item.value);

                                return (
                                    <div key={`${item.inventoryId}-${index}`} className={`history-item ${rarityClass}`}>
                                        <div className="prize-item-image-wrapper">
                                            <img src={item.image} alt={item.name} />
                                        </div>
                                        <div className="prize-item-info">
                                            <span className="prize-name">{item.name}</span>
                                            <span className="history-date">{formattedTime}</span>
                                        </div>
                                        <div className="prize-value">
                                            <img src="/images/stars.png" alt="star" className="star-icon small" />
                                            <span>{item.value.toLocaleString()}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))
                )}
            </div>
        </main>
    );
};

export default HistoryPage;