import React, { useState, useContext, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import '../styles/inventory.css';

const ProfilePage = () => {
    const { user, inventory, withdrawals, sellItem, sellAllItems, requestWithdrawal } = useContext(AppContext);
    
    // --- STATE ---
    const [activeTab, setActiveTab] = useState('inventory');
    const [selectedItem, setSelectedItem] = useState(null); // Предмет, открытый в шторке
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [targetUsername, setTargetUsername] = useState('');

    // --- LOGIC ---
    const stats = useMemo(() => {
        const totalValue = inventory.reduce((acc, item) => acc + item.value, 0);
        return { totalValue, totalItems: inventory.length };
    }, [inventory]);

    const getRarityColor = (val) => {
        if (val >= 50000) return '#ffd700'; // Gold/Legendary
        if (val >= 10000) return '#ff4081'; // Pink
        if (val >= 2000) return '#b388ff';  // Purple
        if (val >= 500)   return '#40c4ff'; // Blue
        return '#b0bec5';                   // Grey
    };

    // --- HANDLERS ---
    const handleItemClick = (item) => {
        setSelectedItem(item);
    };

    const handleSell = () => {
        if (!selectedItem) return;
        sellItem(selectedItem.inventoryId);
        setSelectedItem(null); // Закрыть шторку
    };

    const handleOpenWithdraw = () => {
        setShowWithdrawModal(true);
    };

    const handleConfirmWithdraw = async () => {
        if (!targetUsername.trim()) return alert('Введите @username');
        let cleanUsername = targetUsername.replace('@', '').trim();
        await requestWithdrawal(selectedItem.inventoryId, cleanUsername);
        setShowWithdrawModal(false);
        setSelectedItem(null);
        alert('Заявка создана!');
    };

    const handleConfirmSellAll = () => {
        if(window.confirm("Продать всё и получить " + stats.totalValue + " stars?")) {
            sellAllItems();
        }
    };

    const formatDate = (dateString) => {
        const d = new Date(dateString);
        return d.toLocaleDateString('ru-RU', {day: 'numeric', month: 'short'}) + ', ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    };

    return (
        <div className="profile-page-wrapper">
            
            {/* 1. ПРОФИЛЬ ХЕДЕР (Новый дизайн) */}
            <div className="profile-header-section">
                <div className="user-identity">
                    <div className="avatar-ring">
                        <img 
                            src={user?.photoUrl || '/images/profile.png'} 
                            alt="avatar" 
                            className="main-avatar"
                            onError={(e) => {e.target.onerror = null; e.target.src="/images/profile.png"}}
                        />
                    </div>
                    <div className="user-text">
                        <h2 className="user-name">{user?.firstName || user?.username || 'User'}</h2>
                        <span className="user-id">ID: {user?.id}</span>
                    </div>
                </div>

                <div className="bento-stats">
                    <div className="bento-box balance-box">
                        <span className="bento-label">Стоимость инвентаря</span>
                        <div className="bento-value">
                            <img src="/images/stars.png" alt="" />
                            {stats.totalValue.toLocaleString()}
                        </div>
                    </div>
                    <div className="bento-box items-box">
                        <span className="bento-label">Предметов</span>
                        <div className="bento-value">{stats.totalItems}</div>
                    </div>
                </div>
            </div>

            {/* 2. ТАБЫ (iOS style) */}
            <div className="segmented-control">
                <div 
                    className={`segment ${activeTab === 'inventory' ? 'active' : ''}`}
                    onClick={() => setActiveTab('inventory')}
                >
                    Инвентарь
                </div>
                <div 
                    className={`segment ${activeTab === 'withdrawals' ? 'active' : ''}`}
                    onClick={() => setActiveTab('withdrawals')}
                >
                    История
                </div>
            </div>

            {/* 3. КОНТЕНТ */}
            {activeTab === 'inventory' && (
                <div className="fade-in-content">
                    {inventory.length > 0 && (
                        <button className="minimal-sell-all" onClick={handleConfirmSellAll}>
                            Продать всё за <img src="/images/stars.png" alt=""/> {stats.totalValue.toLocaleString()}
                        </button>
                    )}

                    <div className="clean-grid">
                        {inventory.length === 0 ? (
                            <div className="empty-placeholder">
                                <img src="/images/case.png" alt="" className="floating-empty" />
                                <p>Здесь пока пусто</p>
                                <span>Открывайте кейсы, чтобы получить крутые скины</span>
                            </div>
                        ) : (
                            inventory.map((item) => {
                                const rarityColor = getRarityColor(item.value);
                                return (
                                    <div 
                                        key={item.inventoryId} 
                                        className="clean-card"
                                        onClick={() => handleItemClick(item)}
                                    >
                                        <div className="clean-card-bg" style={{background: `radial-gradient(circle at center, ${rarityColor}20, transparent 70%)`}}></div>
                                        <img src={item.image} alt="" className="clean-card-img" />
                                        <div className="clean-card-price">
                                            {item.value.toLocaleString()}
                                        </div>
                                        <div className="rarity-dot" style={{background: rarityColor}}></div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'withdrawals' && (
                <div className="withdrawals-list fade-in-content">
                    {withdrawals.length === 0 ? (
                         <div className="empty-placeholder">
                            <p>История пуста</p>
                        </div>
                    ) : (
                        withdrawals.map(w => (
                            <div key={w.id} className="history-row">
                                <img src={w.item_data.image} alt="" className="h-img"/>
                                <div className="h-info">
                                    <div className="h-name">{w.item_data.name}</div>
                                    <div className="h-meta">@{w.target_username} • {formatDate(w.created_at)}</div>
                                </div>
                                <div className={`h-status ${w.status}`}>
                                    {w.status === 'processing' ? '🕒' : w.status === 'withdrawn' ? '✅' : '❌'}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* 4. DRAWER (Шторка с деталями предмета) */}
            {/* Оверлей */}
            <div className={`drawer-overlay ${selectedItem ? 'open' : ''}`} onClick={() => setSelectedItem(null)}></div>
            
            {/* Сама шторка */}
            <div className={`bottom-drawer ${selectedItem ? 'open' : ''}`}>
                {selectedItem && (
                    <div className="drawer-content">
                        <div className="drawer-handle"></div>
                        
                        <div className="drawer-image-wrapper">
                            <div className="glow-bg" style={{background: getRarityColor(selectedItem.value)}}></div>
                            <img src={selectedItem.image} alt="" className="drawer-img" />
                        </div>
                        
                        <h3 className="drawer-title">{selectedItem.name}</h3>
                        <div className="drawer-price">
                            <img src="/images/stars.png" alt="" />
                            {selectedItem.value.toLocaleString()}
                        </div>

                        <div className="drawer-actions">
                            <button className="btn-action withdraw" onClick={handleOpenWithdraw}>
                                Вывести в Telegram
                            </button>
                            <button className="btn-action sell" onClick={handleSell}>
                                Продать
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* МОДАЛКА ВВОДА НИКА (Оставляем простой) */}
            {showWithdrawModal && (
                <div className="custom-modal-overlay">
                    <div className="custom-modal">
                        <h3>Вывод скина</h3>
                        <p style={{fontSize:13, color:'#888', marginBottom: 15}}>
                            Укажите username для отправки подарка
                        </p>
                        <input 
                            type="text" 
                            className="modal-input"
                            placeholder="@durov" 
                            value={targetUsername}
                            onChange={e => setTargetUsername(e.target.value)}
                            autoFocus
                        />
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
