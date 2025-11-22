import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';

// --- НАСТРОЙКА ПАРОЛЯ ---
const ADMIN_PASSWORD = "admin"; // Придумайте свой пароль

const AdminPage = () => {
    const { user, balance, updateBalance } = useContext(AppContext);
    const [amount, setAmount] = useState(10000);
    
    // Состояние авторизации (по умолчанию закрыто)
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [error, setError] = useState('');

    const handleLogin = () => {
        if (passwordInput === ADMIN_PASSWORD) {
            setIsAuthenticated(true);
            setError('');
        } else {
            setError('Неверный пароль');
        }
    };

    const handleAddBalance = () => {
        updateBalance(Number(amount));
        alert(`Успешно начислено ${amount} звезд!`);
    };

    // Если не авторизован — показываем форму ввода пароля
    if (!isAuthenticated) {
        return (
            <div className="app-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
                <div className="admin-section" style={{ width: '100%', maxWidth: '300px', textAlign: 'center' }}>
                    <h3>Вход в админку</h3>
                    <div className="admin-form" style={{ flexDirection: 'column' }}>
                        <input 
                            type="password" 
                            value={passwordInput} 
                            onChange={(e) => setPasswordInput(e.target.value)}
                            placeholder="Введите пароль"
                            style={{ marginBottom: '10px', width: '100%', boxSizing: 'border-box' }}
                        />
                        <button className="admin-button" onClick={handleLogin} style={{ width: '100%' }}>
                            Войти
                        </button>
                    </div>
                    {error && <p style={{ color: '#f44336', marginTop: '10px' }}>{error}</p>}
                </div>
            </div>
        );
    }

    // Если авторизован — показываем функционал
    return (
        <div className="app-container admin-page" style={{ paddingTop: '20px' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Админ Панель</h2>
            
            {/* Секция 1: Инфо о пользователе (даже если зашли через браузер и user=null) */}
            <div className="admin-section">
                <h3>Текущая сессия</h3>
                <div className="admin-item">
                    <span>Статус:</span>
                    <strong style={{ color: '#4CAF50' }}>Admin Access</strong>
                </div>
                <div className="admin-item">
                    <span>Пользователь:</span>
                    {/* Используем данные из, если они есть */}
                    <strong>{user ? (user.username || user.firstName) : 'Гость (Браузер)'}</strong>
                </div>
                <div className="admin-item">
                    <span>Текущий баланс:</span>
                    <strong style={{ color: '#ffc107' }}>{balance.toLocaleString()}</strong>
                </div>
            </div>

            {/* Секция 2: Накрутка */}
            <div className="admin-section">
                <h3>Управление балансом</h3>
                <div className="admin-form">
                    <input 
                        type="number" 
                        value={amount} 
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Сумма"
                    />
                    <button className="admin-button" onClick={handleAddBalance}>
                        Начислить
                    </button>
                </div>
            </div>
            
            <button 
                className="admin-button danger" 
                onClick={() => setIsAuthenticated(false)}
                style={{ marginTop: '20px', width: '100%' }}
            >
                Выйти
            </button>
        </div>
    );
};

export default AdminPage;
