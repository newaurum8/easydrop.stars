import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';

// Компонент модального окна больше не нужен

const ProfilePage = () => {
    const { inventory, sellItem } = useContext(AppContext);
    // Состояние только для анимации удаления
    const [sellingItemId, setSellingItemId] = useState(null);

    // --- ИЗМЕНЕНИЕ: Прямая продажа по клику ---
    const handleSell = (itemId) => {
        // Не позволяем продавать, если уже идет процесс продажи другого предмета
        if (sellingItemId) return;

        setSellingItemId(itemId); // Запускаем анимацию исчезновения

        // Ждем завершения анимации (500ms) и затем продаем предмет
        setTimeout(() => {
            sellItem(itemId);
            setSellingItemId(null); // Сбрасываем состояние анимации
        }, 500);
    };

    return (
        <div className="profile-content">
            <h3>Мой инвентарь</h3>
            <div className="inventory-grid">
                {inventory.length === 0 ? (
                    <div className="empty-inventory-message">Ваш инвентарь пуст</div>
                ) : (
                    inventory.map(item => (
                        <div
                            key={item.inventoryId}
                            // Добавляем класс для анимации, если id совпадает
                            className={`inventory-item ${sellingItemId === item.inventoryId ? 'is-selling' : ''}`}
                        >
                            <img src={item.image} alt={item.name} />
                            <div className="item-value">
                                <img src="/images/stars.png" alt="star" className="star-icon small" />
                                <span>{item.value.toLocaleString()}</span>
                            </div>
                            <button className="sell-button" onClick={() => handleSell(item.inventoryId)}>
                                Продать
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ProfilePage;