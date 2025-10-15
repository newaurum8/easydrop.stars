import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';

const Header = () => {
    // Получаем из контекста баланс, пользователя и функцию открытия модального окна
    const { balance, user, openTopUpModal } = useContext(AppContext);

    // Определяем имя для отображения и URL аватара, добавляем запасные варианты
    const displayName = user ? (user.firstName || user.username) : 'Загрузка...';
    const avatarUrl = user?.photoUrl || '/images/profile.png'; // Если фото нет, используем стандартное

    return (
        <header className="profile-header">
            <div className="profile-info">
                <img
                    src={avatarUrl}
                    alt="Avatar"
                    className="avatar"
                    // Если фото из ТГ не загрузится, покажем стандартное
                    onError={(e) => { e.target.onerror = null; e.target.src="/images/profile.png" }}
                />
                <div className="user-details">
                    <span className="username">{displayName}</span>
                    <span className="stars-info">0 звёзд заработано</span>
                </div>
            </div>
            <div className="profile-actions">
                <div className="star-balance">
                    <img src="/images/stars.png" alt="Star" className="star-icon" />
                    <span>{balance.toLocaleString()}</span>
                </div>
                {/* Добавляем обработчик onClick */}
                <button className="add-button" onClick={openTopUpModal}>+</button>
            </div>
        </header>
    );
};

export default Header;