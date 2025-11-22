import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { Link } from 'react-router-dom';

const SECRET_PASSWORD = "admin";

const AdminPage = () => {
    const { 
        user, 
        balance, 
        updateBalance, 
        ALL_CASES, 
        updateCaseData, 
        resetCasesToDefault, 
        ALL_PRIZES 
    } = useContext(AppContext);

    // Состояния авторизации
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [password, setPassword] = useState('');
    const [activeTab, setActiveTab] = useState('users'); // 'users' | 'cases'

    // --- ЛОГИКА АВТОРИЗАЦИИ ---
    if (!isAuthorized) {
        return (
            <div className="app-container" style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh'}}>
                <div className="admin-section" style={{width: '100%', maxWidth: '350px', textAlign:'center'}}>
                    <h2>Вход в Админку</h2>
                    <input 
                        type="password" 
                        className="admin-input"
                        placeholder="Пароль (admin)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{marginBottom: '20px'}}
                    />
                    <button 
                        className="upgrade-button" 
                        onClick={() => password === SECRET_PASSWORD ? setIsAuthorized(true) : alert('Неверный пароль')}
                    >
                        Войти
                    </button>
                    <div style={{marginTop: '20px'}}>
                        <Link to="/" style={{color: '#00aaff'}}>Вернуться на главную</Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        // Используем div вместо Layout, чтобы убрать нижнее меню, но добавляем класс для стилей
        <div className="admin-container">
            <header className="admin-header">
                <h1>Панель Администратора</h1>
                <div style={{display:'flex', gap:'10px'}}>
                    <button onClick={resetCasesToDefault} style={{background:'transparent', border:'1px solid #f44336', color:'#f44336', padding:'8px 16px', borderRadius:'8px', cursor:'pointer'}}>
                        Сброс всех настроек
                    </button>
                    <Link to="/" className="back-button" style={{margin:0, border:'1px solid #00aaff', padding:'8px 16px', borderRadius:'8px'}}>
                        В приложение
                    </Link>
                </div>
            </header>

            {/* Вкладки */}
            <div className="admin-tabs">
                <button 
                    className={`admin-tab-button ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    👥 Пользователи
                </button>
                <button 
                    className={`admin-tab-button ${activeTab === 'cases' ? 'active' : ''}`}
                    onClick={() => setActiveTab('cases')}
                >
                    🎒 Управление Кейсами
                </button>
            </div>

            {/* КОНТЕНТ */}
            {activeTab === 'users' && <UserManager user={user} balance={balance} updateBalance={updateBalance} />}
            {activeTab === 'cases' && <CaseManager cases={ALL_CASES} onUpdate={updateCaseData} allPrizes={ALL_PRIZES} />}
        </div>
    );
};

// --- КОМПОНЕНТ 1: Управление Пользователями ---
const UserManager = ({ user, balance, updateBalance }) => {
    const [editBalance, setEditBalance] = useState(balance);
    const [addAmount, setAddAmount] = useState(0);

    const handleSetBalance = () => {
        // Вычисляем разницу, чтобы использовать updateBalance
        const diff = Number(editBalance) - balance;
        updateBalance(diff);
        alert('Баланс установлен!');
    };

    const handleAddBalance = () => {
        updateBalance(Number(addAmount));
        setAddAmount(0);
        alert(`Добавлено ${addAmount} звезд`);
    };

    return (
        <div className="admin-section">
            <h3>Редактирование текущего пользователя</h3>
            <div style={{display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px'}}>
                <img src={user?.photoUrl || '/images/profile.png'} style={{width:'60px', height:'60px', borderRadius:'50%'}} alt="Avatar"/>
                <div>
                    <div style={{fontSize: '18px', fontWeight: 'bold'}}>{user?.firstName} {user?.lastName}</div>
                    <div style={{color: '#8a99a8'}}>@{user?.username || 'unknown'} (ID: {user?.id})</div>
                </div>
            </div>

            <div className="editor-row">
                <div className="editor-col">
                    <div className="admin-form-group">
                        <label>Установить точный баланс:</label>
                        <div style={{display:'flex', gap:'10px'}}>
                            <input 
                                type="number" 
                                className="admin-input" 
                                value={editBalance} 
                                onChange={(e) => setEditBalance(e.target.value)} 
                            />
                            <button className="upgrade-button" style={{width:'auto'}} onClick={handleSetBalance}>OK</button>
                        </div>
                    </div>
                </div>
                <div className="editor-col">
                    <div className="admin-form-group">
                        <label>Добавить к текущему (+):</label>
                        <div style={{display:'flex', gap:'10px'}}>
                            <input 
                                type="number" 
                                className="admin-input" 
                                value={addAmount} 
                                onChange={(e) => setAddAmount(e.target.value)} 
                                placeholder="1000"
                            />
                            <button className="upgrade-button" style={{width:'auto', backgroundColor:'#4CAF50'}} onClick={handleAddBalance}>Add</button>
                        </div>
                    </div>
                </div>
            </div>
            <p style={{fontSize:'12px', color:'#666'}}>* В текущей версии редактируется только локальный пользователь браузера.</p>
        </div>
    );
};

// --- КОМПОНЕНТ 2: Менеджер Кейсов (Master-Detail) ---
const CaseManager = ({ cases, onUpdate, allPrizes }) => {
    const [selectedCaseId, setSelectedCaseId] = useState(cases[0]?.id);
    
    // Находим выбранный кейс
    const selectedCase = useMemo(() => cases.find(c => c.id === selectedCaseId), [cases, selectedCaseId]);

    return (
        <div className="case-manager-layout">
            {/* Сайдбар со списком кейсов */}
            <div className="case-list-sidebar">
                {cases.map(c => (
                    <div 
                        key={c.id} 
                        className={`admin-case-item ${selectedCaseId === c.id ? 'active' : ''}`}
                        onClick={() => setSelectedCaseId(c.id)}
                    >
                        <img src={c.image} alt={c.name} />
                        <div>
                            <div style={{fontWeight:'500', color:'#fff'}}>{c.name}</div>
                            <div style={{fontSize:'12px', color:'#ffc107'}}>{c.price > 0 ? c.price : 'Free'} ⭐</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Область редактирования */}
            <div className="case-editor-area">
                {selectedCase && (
                    <CaseEditor 
                        key={selectedCase.id} // Важно: пересоздаем компонент при смене кейса
                        caseItem={selectedCase} 
                        onSave={onUpdate} 
                        allPrizes={allPrizes}
                    />
                )}
            </div>
        </div>
    );
};

// --- КОМПОНЕНТ 3: Редактор одного кейса ---
const CaseEditor = ({ caseItem, onSave, allPrizes }) => {
    const [formData, setFormData] = useState({
        ...caseItem,
        price: caseItem.price
    });
    const [searchQuery, setSearchQuery] = useState('');

    // Призы, которые СЕЙЧАС в кейсе (полные объекты)
    const currentPrizes = useMemo(() => {
        // Если у кейса сохранены ID призов (что правильно)
        if (caseItem.prizeIds) {
            return caseItem.prizeIds.map(id => allPrizes.find(p => p.id === id)).filter(Boolean);
        }
        // Fallback для старой структуры (если вдруг массив объектов)
        return caseItem.prizes || [];
    }, [caseItem, allPrizes]); // Используем caseItem из пропсов для инициализации, но редактируем через локальный стейт списка ID

    // Локальное состояние для списка ID призов
    const [selectedPrizeIds, setSelectedPrizeIds] = useState(
        caseItem.prizeIds || caseItem.prizes.map(p => p.id)
    );

    // Доступные для добавления (все минус уже добавленные)
    const availablePrizes = allPrizes.filter(p => 
        !selectedPrizeIds.includes(p.id) && 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAddItem = (prizeId) => {
        setSelectedPrizeIds(prev => [...prev, prizeId]);
    };

    const handleRemoveItem = (prizeId) => {
        setSelectedPrizeIds(prev => prev.filter(id => id !== prizeId));
    };

    const handleSave = () => {
        // Формируем готовый объект кейса
        const updatedCase = {
            ...formData,
            price: Number(formData.price),
            prizeIds: selectedPrizeIds, // Сохраняем только ID
            // Обновляем prizes для совместимости, если где-то используется старый формат
            prizes: selectedPrizeIds.map(id => allPrizes.find(p => p.id === id)) 
        };
        
        onSave(updatedCase);
        alert(`Кейс "${formData.name}" успешно сохранен!`);
    };

    return (
        <div className="admin-section">
            <div style={{display:'flex', gap:'20px', alignItems:'center', marginBottom:'20px'}}>
                <img src={formData.image} alt="Case" style={{width:'80px', height:'80px', objectFit:'contain'}} />
                <h2 style={{margin:0}}>{formData.name}</h2>
            </div>

            <div className="editor-row">
                <div className="editor-col">
                    <div className="admin-form-group">
                        <label>Название кейса</label>
                        <input 
                            type="text" 
                            className="admin-input" 
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                    </div>
                </div>
                <div className="editor-col">
                    <div className="admin-form-group">
                        <label>Цена (Звезд)</label>
                        <input 
                            type="number" 
                            className="admin-input" 
                            value={formData.price}
                            onChange={e => setFormData({...formData, price: e.target.value})}
                        />
                    </div>
                </div>
            </div>

            <h4 style={{marginTop:'30px', borderBottom:'1px solid #444', paddingBottom:'10px'}}>Содержимое кейса</h4>
            
            <div className="item-picker-container">
                {/* КОЛОНКА 1: В КЕЙСЕ */}
                <div className="picker-column">
                    <div className="picker-header">ВНУТРИ КЕЙСА ({selectedPrizeIds.length})</div>
                    <div className="picker-list">
                        {selectedPrizeIds.map(id => {
                            const item = allPrizes.find(p => p.id === id);
                            if(!item) return null;
                            return (
                                <div key={id} className="picker-item">
                                    <button className="action-btn-small btn-remove" onClick={() => handleRemoveItem(id)}>−</button>
                                    <img src={item.image} alt="" />
                                    <span>{item.name}</span>
                                    <small style={{color:'#ffc107'}}>{item.value}</small>
                                </div>
                            );
                        })}
                        {selectedPrizeIds.length === 0 && <div style={{textAlign:'center', padding:'20px', color:'#666'}}>Пусто</div>}
                    </div>
                </div>

                {/* КОЛОНКА 2: БАЗА ПРЕДМЕТОВ */}
                <div className="picker-column">
                    <div className="picker-header">ДОСТУПНЫЕ ПРЕДМЕТЫ</div>
                    <input 
                        type="text" 
                        placeholder="Поиск..." 
                        className="admin-input" 
                        style={{padding:'8px', marginBottom:'10px', fontSize:'14px'}}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                    <div className="picker-list">
                        {availablePrizes.map(item => (
                            <div key={item.id} className="picker-item" style={{opacity: 0.8}}>
                                <img src={item.image} alt="" />
                                <span>{item.name}</span>
                                <small style={{color:'#ffc107'}}>{item.value}</small>
                                <button className="action-btn-small btn-add" onClick={() => handleAddItem(item.id)}>+</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <button className="save-fab" onClick={handleSave}>
                СОХРАНИТЬ ИЗМЕНЕНИЯ
            </button>
        </div>
    );
};

export default AdminPage;
