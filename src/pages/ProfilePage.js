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
    const [withdrawItem, setWithdrawItem] = useState(null); 
    const [targetUsername, setTargetUsername] = useState('');

    // --- LOGIC ---
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

    const handleSellOne = (itemId) => {
        if (sellingItemId) return;
        setSellingItemId(itemId);
        setTimeout(() => {
            sellItem(itemId);
            setSellingItemId(null);
        }, 300);
    };

    const handleConfirmSellAll = () => {
        sellAllItems();
        setShowSellAllModal(false);
    };

    const handleOpenWithdraw = (item) => {
        setWithdrawItem(item);
        setTargetUsername('');
        setShowWithdrawModal(true);
    };

    const handleConfirmWithdraw = async () => {
        if (!targetUsername.trim()) return alert('Введите username');
        let cleanUsername = targetUsername.replace('@', '').trim();
        await requestWithdrawal(withdrawItem.inventoryId, cleanUsername);
        setShowWithdrawModal(false);
        setWithdrawItem(null);
        alert('Заявка на вывод отправлена!');
    };

    const formatDate = (dateString) => {
        const d = new Date(dateString);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    };

    const getStatusBadge = (status) => {
        switch(status) {
            case 'processing': return <span className="status-badge processing">Обработка</span>;
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

            {/* Вкладка ИНВЕНТАРЬ */}
            {activeTab === 'inventory' && (
                <>
                    {/* Кнопка ПРОДАТЬ ВСЁ (Исправлено: убран счетчик) */}
                    {inventory.length > 0 && (
                        <div className="sell-all-container">
                            <button className="sell-all-btn" onClick={() => setShowSellAllModal(true)}>
                                ПРОДАТЬ ВСЁ
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
                                        style={{ '--rarity-color': rarityColor, animationDelay: `${Math.min(index * 0.05, 0.5)}s` }}
                                    >
                                        {/* Свечение */}
                                        <div className="card-glow"></div>
                                        
                                        {/* Картинка */}
                                        <div className="card-image-box">
                                            <img src={item.image} alt={item.name} />
                                        </div>
                                        
                                        {/* Инфо */}
                                        <div className="card-info">
                                            <div className="card-name">{item.name}</div>
                                            <div className="card-price" style={{ color: rarityColor }}>
                                                <img src="/images/stars.png" alt="" className="star-icon small" />
                                                {item.value.toLocaleString()}
                                            </div>
                                        </div>

                                        {/* Кнопки (Теперь ровные) */}
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
                                        <div className="w-target">@{w.target_username}</div>
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
                        <img src={withdrawItem.image} alt="" style={{width: 80, height: 80, objectFit:'contain', margin: '10px auto', filter: 'drop-shadow(0 0 15px rgba(0,0,0,0.5))'}} />
                        <p className="modal-item-name">{withdrawItem.name}</p>
                        
                        <div className="input-group">
                            <label>Введите ваш Telegram Username:</label>
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
                            <button className="modal-btn confirm" onClick={handleConfirmWithdraw}>Отправить</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default ProfilePage;
