import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';

// --- ПАРОЛЬ АДМИНА ---
const SECRET_PASSWORD = "admin"; 

const AdminPage = () => {
    const { user, balance, updateBalance, ALL_CASES, updateCaseData, resetCasesToDefault } = useContext(AppContext);
    
    // Авторизация
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [inputPassword, setInputPassword] = useState('');
    const [authError, setAuthError] = useState('');

    // Вкладки админки
    const [activeTab, setActiveTab] = useState('balance'); // 'balance' | 'cases'

    // Локальные стейты
    const [amount, setAmount] = useState(10000);

    const handleLogin = () => {
        if (inputPassword === SECRET_PASSWORD) {
            setIsAuthorized(true);
            setAuthError('');
        } else {
            setAuthError('Неверный пароль');
        }
    };

    const handleAddBalance = () => {
        updateBalance(Number(amount));
        alert('Баланс обновлен');
    };

    // Компонент редактирования одного кейса
    const CaseEditor = ({ caseItem }) => {
        const [price, setPrice] = useState(caseItem.price);
        const [name,HN] = useState(caseItem.name);

        const handleSave = () => {
            updateCaseData({ ...caseItem, price: Number(price), name: name });
            alert(`Кейс "${name}" сохранен!`);
        };

        return (
            <div className="admin-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px', padding: '15px', borderBottom: '1px solid #444' }}>
                <div style={{display: 'flex', alignItems: 'center', gap: '10px', width: '100%'}}>
                    <img src={caseItem.image} alt={caseItem.name} style={{width: '40px', height: '40px', objectFit: 'contain'}}/>
                    <span style={{fontWeight: 'bold', flex: 1}}>{caseItem.name}</span>
                </div>
                
                <div style={{display: 'flex', gap: '10px', width: '100%'}}>
                    <div style={{flex: 1}}>
                        <label style={{fontSize: '10px', color: '#888'}}>Название</label>
                        <input 
                            type="text" 
                            value={name} 
                            onChange={(e) => HN(e.target.value)}
                            style={{width: '100%', padding: '5px', borderRadius: '5px', border: 'none'}}
                        />
                    </div>
                    <div style={{flex: 1}}>
                        <label style={{fontSize: '10px', color: '#888'}}>Цена</label>
                        <input 
                            type="number" 
                            value={price} 
                            onChange={(e) => setPrice(e.target.value)}
                            style={{width: '100%', padding: '5px', borderRadius: '5px', border: 'none'}}
                        />
                    </div>
                </div>
                <button 
                    onClick={handleSave}
                    style={{
                        padding: '5px 10px', 
                        backgroundColor: '#4CAF50', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '5px', 
                        cursor: 'pointer',
                        fontSize: '12px',
                        alignSelf: 'flex-end'
                    }}
                >
                    Сохранить
                </button>
            </div>
        );
    };

    // ЭКРАН ВХОДА
    if (!isAuthorized) {
        return (
            <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div className="admin-section" style={{ width: '100%', maxWidth: '300px', textAlign: 'center' }}>
                    <h3>Admin Panel</h3>
                    <input 
                        type="password" 
                        value={inputPassword}
                        onChange={(e) => setInputPassword(e.target.value)}
                        placeholder="Пароль..."
                        style={{ width: '100%', padding: '10px', margin: '10px 0', borderRadius: '8px', border: 'none' }}
                    />
                    <button className="admin-button" onClick={handleLogin} style={{ width: '100%' }}>Войти</button>
                    {authError && <p style={{ color: 'red', marginTop: '10px' }}>{authError}</p>}
                </div>
            </div>
        );
    }

    // ПАНЕЛЬ УПРАВЛЕНИЯ
    return (
        <div className="admin-page app-container" style={{ paddingBottom: '100px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2>Админка</h2>
                <button className="admin-button danger small" onClick={() => setIsAuthorized(false)}>Выход</button>
            </div>

            {/* Переключатель вкладок */}
            <div className="inventory-tabs" style={{ marginBottom: '20px' }}>
                <button 
                    className={`tab-btn ${activeTab === 'balance' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('balance')}
                >
                    Баланс
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'cases' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('cases')}
                >
                    Кейсы
                </button>
            </div>

            {/* ВКЛАДКА БАЛАНС */}
            {activeTab === 'balance' && (
                <div className="admin-section">
                    <h3>Пользователь</h3>
                    <div className="admin-item">
                        <span>Имя:</span> <strong>{user?.firstName} {user?.lastName}</strong>
                    </div>
                    <div className="admin-item">
                        <span>Баланс:</span> <strong style={{color: '#ffc107'}}>{balance.toLocaleString()}</strong>
                    </div>
                    
                    <h3 style={{marginTop: '20px'}}>Начислить</h3>
                    <div className="admin-form">
                        <input 
                            type="number" 
                            value={amount} 
                            onChange={(e) => setAmount(e.target.value)} 
                        />
                        <button className="admin-button" onClick={handleAddBalance}>OK</button>
                    </div>
                </div>
            )}

            {/* ВКЛАДКА КЕЙСЫ */}
            {activeTab === 'cases' && (
                <div className="admin-section">
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                        <h3>Редактор Кейсов</h3>
                        <button 
                            onClick={() => {
                                if(window.confirm('Сбросить все цены и названия к заводским настройкам?')) resetCasesToDefault();
                            }}
                            style={{fontSize: '10px', background: 'transparent', color: '#f44336', border: '1px solid #f44336', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer'}}
                        >
                            Сброс
                        </button>
                    </div>
                    
                    <div className="admin-item-list compact">
                        {ALL_CASES.map(caseItem => (
                            <CaseEditor key={caseItem.id} caseItem={caseItem} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPage;
