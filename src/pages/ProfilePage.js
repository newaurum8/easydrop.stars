import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import '../styles/inventory.css'; 

const ProfilePage = () => {
    const { inventory, sellItem } = useContext(AppContext);
    // Состояние для ID предмета, который в данный момент "продается" (для анимации)
    const [sellingItemId, setSellingItemId] = useState(null);

    // 1. Подсчет статистики инвентаря (общая стоимость и кол-во)
    const stats = useMemo(() => {
        const totalValue = inventory.reduce((acc, item) => acc + item.value, 0);
        const totalItems = inventory.length;
        return { totalValue, totalItems };
    }, [inventory]);

    // 2. Функция для получения цвета редкости на основе цены
    const getRarityColor = (val) => {
        if (val >= 50000) return '#ffc107'; // Легендарный (Золотой)
        if (val >= 10000) return '#f44336'; // Мифический (Красный)
        if (val >= 2000) return '#b388ff';  // Эпический (Фиолетовый)
        if (val >= 500)   return '#00aaff'; // Редкий (Голубой)
        return '#b0bec5';                   // Обычный (Серый)
    };

    // 3. Обработчик продажи с задержкой для анимации
    const handleSell = (itemId) => {
        if (sellingItemId) return; // Защита от двойного клика
        setSellingItemId(itemId);
        
        // Ждем 300мс пока проиграет CSS анимация исчезновения
        setTimeout(() => {
            sellItem(itemId);
            setSellingItemId(null);
        }, 300); 
    };

    return (
        <div className="profile-page-wrapper">
            
            {/* БЛОК СТАТИСТИКИ (Hero Section) */}
            <div className="profile-stats-card">
                <div className="stat-item">
                    <span className="stat-label">Стоимость инвентаря</span>
                    <div className="stat-value big">
                        <img src="/images/stars.png" alt="stars" className="star-icon" />
                        {stats.totalValue.toLocaleString()}
                    </div>
                </div>
                <div className="stat-divider"></div>
                <div className="stat-item">
                    <span className="stat-label">Предметов</span>
                    <div className="stat-value">{stats.totalItems}</div>
                </div>
            </div>

            <h3 className="section-title">Ваши предметы</h3>

            <div className="inventory-grid">
                {inventory.length === 0 ? (
                    <div className="empty-state-container">
                        <div className="empty-icon">🎒</div>
                        <p>Инвентарь пуст</p>
                        <span>Открывайте кейсы, чтобы пополнить коллекцию</span>
                    </div>
                ) : (
                    inventory.map((item, index) => {
                        const rarityColor = getRarityColor(item.value);
                        
                        return (
                            <div
                                key={item.inventoryId}
                                className={`inventory-card ${sellingItemId === item.inventoryId ? 'is-selling' : ''}`}
                                style={{ 
                                    '--rarity-color': rarityColor,
                                    animationDelay: `${index * 0.05}s` // Эффект "лесенки" при появлении
                                }}
                            >
                                {/* Фоновое свечение (Glow) */}
                                <div className="card-glow"></div>

                                <div className="card-image-box">
                                    <img src={item.image} alt={item.name} />
                                </div>
                                
                                <div className="card-info">
                                    <div className="card-name">{item.name}</div>
                                    <div className="card-price" style={{ color: rarityColor }}>
                                        <img src="/images/stars.png" alt="star" className="star-icon small" />
                                        {item.value.toLocaleString()}
                                    </div>
                                </div>

                                <button className="sell-btn-modern" onClick={() => handleSell(item.inventoryId)}>
                                    Продать
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ProfilePage;
