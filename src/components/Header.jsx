import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';

const Header = () => {
    // Получаем из контекста баланс, пользователя, модалку И ТЕМУ
    const { balance, user, openTopUpModal, toggleTheme, theme } = useContext(AppContext);

    // Определяем имя для отображения и URL аватара
    const displayName = user ? (user.firstName || user.username) : 'Загрузка...';
    const avatarUrl = user?.photoUrl || '/images/profile.png'; 

    return (
        <header className="profile-header">
            <div className="profile-info">
                {/* Обертка для аватарки с кликом для смены темы */}
                <div 
                    className="avatar-container-clickable" 
                    onClick={toggleTheme}
                    style={{ position: 'relative', cursor: 'pointer', display: 'flex' }}
                    title="Нажмите для смены темы"
                >
                    <img
                        src={avatarUrl}
                        alt="Avatar"
                        className="avatar"
                        onError={(e) => { e.target.onerror = null; e.target.src="/images/profile.png" }}
                    />
                    
                    {/* Индикатор темы поверх аватарки */}
                    <div style={{
                        position: 'absolute',
                        bottom: -4,
                        right: -4,
                        width: '20px',
                        height: '20px',
                        backgroundColor: 'var(--bg-secondary)',
                        borderRadius: '50%',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                    }}>
                        {theme === 'dark' ? '🌙' : '☀️'}
                    </div>
                </div>

                <div className="user-details">
                    <span className="username">{displayName}</span>
                    <span className="stars-info">0 звёзд заработано</span>
                </div>
            </div>
            <div className="profile-actions">
                <div className="star-balance">
                    <img src="/images/stars.png" alt="Star" className="star-icon" />
                    <span>{(balance || 0).toLocaleString()}</span>
                </div>
                <button className="add-button" onClick={openTopUpModal}>+</button>
            </div>
        </header>
    );
};

export default Header;
