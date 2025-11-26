import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import '../styles/inventory.css';

const ProfilePage = () => {
    const { inventory, withdrawals, sellItem, sellAllItems, requestWithdrawal } = useContext(AppContext);
    
    // --- STATE ---
    const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'withdrawals'
    const [sellingItemId, setSellingItemId] = useState(null); // ID предмета для анимации продажи
    
    // Модалка "Продать всё"
    const [showSellAllModal, setShowSellAllModal] = useState(false);
    
    // Модалка "Вывод"
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawItem, setWithdrawItem] = useState(null); // Предмет, который хотим вывести
    const [targetUsername, setTargetUsername] = useState('');

    // --- LOGIC ---
    
    // Подсчет статистики инвентаря
    const stats = useMemo(() => {
        const totalValue = inventory.reduce((acc, item) => acc + item.value, 0);
        const totalItems = inventory.length;
        return { totalValue, totalItems };
    }, [inventory]);

    const getRarityColor = (val) => {
        if (val >= 50000) return '#ffc107'; // Легендарный (Gold)
        if (val >= 10000) return '#f44336'; // Мифический (Red)
        if (val >= 2000) return '#b388ff';  // Эпический (Purple)
        if (val >= 500)   return '#00aaff'; // Редкий (Blue)
        return '#b0bec5';                   // Обычный (Gray)
    };

    // Анимация и продажа одного предмета
    const handleSellOne = (itemId) => {
        if (sellingItemId) return;
        setSellingItemId(itemId);
        setTimeout(() => {
            sellItem(itemId);
            setSellingItemId(null);
        }, 300);
    };

    // Продать всё
    const handleConfirmSellAll = () => {
        sellAllItems();
        setShowSellAllModal(false);
    };

    // Открыть модалку вывода
    const handleOpenWithdraw = (item) => {
        setWithdrawItem(item);
        setTargetUsername('');
        setShowWithdrawModal(true);
    };

    // Подтвердить вывод
    const handleConfirmWithdraw = async () => {
        if (!targetUsername.trim()) return alert('Введите username');
        
        // Убираем @ если пользователь его ввел
        let cleanUsername = targetUsername.replace('@', '').trim();
        
        await requestWithdrawal(withdrawItem.inventoryId, cleanUsername);
        
        setShowWithdrawModal(false);
        setWithdrawItem(null);
        alert('Заявка на вывод отправлена! Проверьте вкладку "История выводов".');
    };

    // Форматирование даты
    const formatDate = (dateString) => {
        const d = new Date(dateString);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    };

    // Рендер статуса
    const getStatusBadge = (status) => {
        switch(status) {
            case 'processing': return <span className="status-badge processing">Процесс вывода</span>;
            case 'withdrawn': return <span className="status-badge success">Выведено</span>;
            case 'cancelled': return <span className="status-badge cancelled">Отменен</span>;
            default: return <span className="status-badge">{status}</span>;
        }
    };

    return (
        <div className="profile-page-wrapper">
            
            {/* БЛОК СТАТИСТИКИ */}
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

            {/* ТАБЫ */}
            <div className="profile-tabs">
                <button 
                    className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('inventory')}
                >
                    Инвентарь
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'withdrawals' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('withdrawals')}
                >
                    История выводов
                </button>
            </div>

            {/* Вклдака ИНВЕНТАРЬ */}
            {activeTab === 'inventory' && (
                <>
                    {/* Кнопка ПРОДАТЬ ВСЁ (появляется только если есть предметы) */}
                    {inventory.length > 0 && (
                        <div className="sell-all-container">
                            <button className="sell-all-btn" onClick={() => setShowSellAllModal(true)}>
                                ПРОДАТЬ ВСЁ ({inventory.length})
                            </button>
                        </div>
                    )}

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
                                        style={{ '--rarity-color': rarityColor, animationDelay: `${index * 0.05}s` }}
                                    >
                                        <div className="card-glow"></div>
                                        <div className="card-image-box"><img src={item.image} alt={item.name} /></div>
                                        
                                        <div className="card-info">
                                            <div className="card-name">{item.name}</div>
                                            <div className="card-price" style={{ color: rarityColor }}>
                                                <img src="/images/stars.png" alt="" className="star-icon small" />
                                                {item.value.toLocaleString()}
                                            </div>
                                        </div>

                                        <div className="card-actions">
                                            <button className="action-btn sell" onClick={() => handleSellOne(item.inventoryId)}>
                                                Продать
                                            </button>
                                            <button className="action-btn withdraw" onClick={() => handleOpenWithdraw(item)}>
                                                Вывести
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            )}

            {/* Вкладка ВЫВОДЫ */}
            {activeTab === 'withdrawals' && (
                <div className="withdrawals-list">
                    {withdrawals.length === 0 ? (
                        <div className="empty-state-container">
                            <p>История выводов пуста</p>
                        </div>
                    ) : (
                        withdrawals.map(w => {
                            const item = w.item_data;
                            return (
                                <div key={w.id} className="withdrawal-item">
                                    <div className="w-img">
                                        <img src={item.image} alt="" />
                                    </div>
                                    <div className="w-info">
                                        <div className="w-name">{item.name}</div>
                                        <div className="w-target">На: @{w.target_username}</div>
                                        <div className="w-date">{formatDate(w.created_at)}</div>
                                    </div>
                                    <div className="w-status">
                                        {getStatusBadge(w.status)}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            )}

            {/* МОДАЛКА ПРОДАТЬ ВСЁ */}
            {showSellAllModal && (
                <div className="custom-modal-overlay">
                    <div className="custom-modal">
                        <h3>Продать весь инвентарь?</h3>
                        <p>Вы получите на баланс:</p>
                        <div className="modal-price-tag">
                            <img src="/images/stars.png" alt="" className="star-icon" />
                            {stats.totalValue.toLocaleString()}
                        </div>
                        <div className="modal-actions">
                            <button className="modal-btn cancel" onClick={() => setShowSellAllModal(false)}>Отмена</button>
                            <button className="modal-btn confirm" onClick={handleConfirmSellAll}>Подтвердить</button>
                        </div>
                    </div>
                </div>
            )}

            {/* МОДАЛКА ВЫВОДА */}
            {showWithdrawModal && withdrawItem && (
                <div className="custom-modal-overlay">
                    <div className="custom-modal">
                        <h3>Вывод предмета</h3>
                        <img src={withdrawItem.image} alt="" style={{width: 70, height: 70, objectFit:'contain', margin: '10px auto'}} />
                        <p className="modal-item-name">{withdrawItem.name}</p>
                        
                        <div className="input-group">
                            <label>Введите Username Telegram (кому отправить):</label>
                            <input 
                                type="text" 
                                placeholder="@username" 
                                value={targetUsername} 
                                onChange={(e) => setTargetUsername(e.target.value)}
                                className="modal-input"
                            />
                        </div>

                        <div className="modal-actions">
                            <button className="modal-btn cancel" onClick={() => setShowWithdrawModal(false)}>Отмена</button>
                            <button className="modal-btn confirm" onClick={handleConfirmWithdraw}>Отправить заявку</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ProfilePage;
