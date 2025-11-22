import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { Link } from 'react-router-dom';

const SECRET_PASSWORD = "admin"; // Простой пароль

const AdminPage = () => {
    const { 
        ALL_CASES, 
        updateCaseData, 
        ALL_PRIZES 
    } = useContext(AppContext);

    const [isAuthorized, setIsAuthorized] = useState(false);
    const [password, setPassword] = useState('');
    const [activeTab, setActiveTab] = useState('users');

    // --- АВТОРИЗАЦИЯ ---
    if (!isAuthorized) {
        return (
            <div className="app-container" style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh'}}>
                <div className="admin-section" style={{width: '100%', maxWidth: '350px', textAlign:'center'}}>
                    <h2>Вход в БД</h2>
                    <input 
                        type="password" 
                        className="admin-input"
                        placeholder="Пароль"
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
                        <Link to="/" style={{color: '#00aaff'}}>На главную</Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-container">
            <header className="admin-header">
                <h1>База Данных: PostgreSQL</h1>
                <Link to="/" className="back-button" style={{margin:0, border:'1px solid #00aaff', padding:'8px 16px', borderRadius:'8px'}}>
                    В приложение
                </Link>
            </header>

            <div className="admin-tabs">
                <button 
                    className={`admin-tab-button ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    👥 Пользователи (Баланс)
                </button>
                <button 
                    className={`admin-tab-button ${activeTab === 'cases' ? 'active' : ''}`}
                    onClick={() => setActiveTab('cases')}
                >
                    🎒 Редактор Кейсов
                </button>
            </div>

            {activeTab === 'users' && <UserManager />}
            {activeTab === 'cases' && <CaseManager cases={ALL_CASES} onLocalUpdate={updateCaseData} allPrizes={ALL_PRIZES} />}
        </div>
    );
};

// --- КОМПОНЕНТ: УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ ---
const UserManager = () => {
    const [searchId, setSearchId] = useState('');
    const [foundUser, setFoundUser] = useState(null);
    const [statusMsg, setStatusMsg] = useState('');
    const [newBalance, setNewBalance] = useState('');

    const findUser = async () => {
        try {
            const res = await fetch(`/api/admin/user/${searchId}`);
            if (!res.ok) throw new Error('User not found');
            const data = await res.json();
            setFoundUser(data);
            setNewBalance(data.balance);
            setStatusMsg('');
        } catch (err) {
            setFoundUser(null);
            setStatusMsg('Пользователь не найден (убедитесь, что он заходил в приложение)');
        }
    };

    const saveBalance = async () => {
        if(!foundUser) return;
        try {
            const res = await fetch('/api/admin/user/balance', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ id: foundUser.id, amount: newBalance, type: 'set' })
            });
            const updated = await res.json();
            setFoundUser(updated);
            alert('Баланс обновлен в базе данных!');
        } catch (err) {
            alert('Ошибка обновления');
        }
    };

    return (
        <div className="admin-section">
            <h3>Поиск и редактирование пользователя</h3>
            <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                <input 
                    className="admin-input" 
                    placeholder="Введите Telegram ID" 
                    value={searchId}
                    onChange={e => setSearchId(e.target.value)}
                />
                <button className="upgrade-button" style={{width:'auto'}} onClick={findUser}>Найти</button>
            </div>
            {statusMsg && <p style={{color:'red'}}>{statusMsg}</p>}

            {foundUser && (
                <div style={{background: '#212a31', padding: '20px', borderRadius: '12px'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'15px', marginBottom:'15px'}}>
                        <img src={foundUser.photo_url || '/images/profile.png'} style={{width:50, height:50, borderRadius:'50%'}} alt=""/>
                        <div>
                            <div style={{fontWeight:'bold', fontSize:18}}>{foundUser.first_name}</div>
                            <div style={{color:'#888'}}>@{foundUser.username} (ID: {foundUser.id})</div>
                        </div>
                    </div>
                    
                    <div className="admin-form-group">
                        <label>Баланс пользователя:</label>
                        <div style={{display:'flex', gap:'10px'}}>
                            <input 
                                type="number" 
                                className="admin-input" 
                                value={newBalance} 
                                onChange={e => setNewBalance(e.target.value)} 
                            />
                            <button className="upgrade-button" style={{width:'auto', background:'#4CAF50'}} onClick={saveBalance}>Сохранить</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- КОМПОНЕНТ: РЕДАКТОР КЕЙСОВ ---
const CaseManager = ({ cases, onLocalUpdate, allPrizes }) => {
    const [selectedCaseId, setSelectedCaseId] = useState(cases[0]?.id);
    const selectedCase = useMemo(() => cases.find(c => c.id === selectedCaseId), [cases, selectedCaseId]);

    const handleServerUpdate = async (updatedCase) => {
        try {
            const res = await fetch('/api/admin/case/update', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(updatedCase)
            });
            const data = await res.json();
            
            // Преобразуем ответ для локального стейта (camelCase)
            const mappedForClient = {
                id: data.id,
                name: data.name,
                image: data.image,
                price: data.price,
                prizeIds: data.prize_ids,
                isPromo: data.is_promo
            };
            
            // Обновляем контекст, чтобы изменения сразу появились в приложении
            onLocalUpdate(mappedForClient);
            alert('Кейс успешно обновлен в БД!');
        } catch (err) {
            console.error(err);
            alert('Ошибка сохранения');
        }
    };

    return (
        <div className="case-manager-layout">
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
                            <div style={{fontSize:'12px', color:'#ffc107'}}>{c.price} ⭐</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="case-editor-area">
                {selectedCase && (
                    <CaseEditor 
                        key={selectedCase.id} 
                        caseItem={selectedCase} 
                        onSave={handleServerUpdate} 
                        allPrizes={allPrizes}
                    />
                )}
            </div>
        </div>
    );
};

const CaseEditor = ({ caseItem, onSave, allPrizes }) => {
    const [formData, setFormData] = useState({ ...caseItem });
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPrizeIds, setSelectedPrizeIds] = useState(caseItem.prizeIds || []);

    const availablePrizes = allPrizes.filter(p => 
        !selectedPrizeIds.includes(p.id) && 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSave = () => {
        onSave({
            ...formData,
            prizeIds: selectedPrizeIds
        });
    };

    return (
        <div className="admin-section">
            <div style={{display:'flex', gap:'20px', alignItems:'center', marginBottom:'20px'}}>
                <img src={formData.image} alt="Case" style={{width:'80px', height:'80px', objectFit:'contain'}} />
                <h2 style={{margin:0}}>{formData.name}</h2>
            </div>

            <div className="editor-row">
                <div className="editor-col">
                    <label style={{color:'#888', fontSize:'12px'}}>Название</label>
                    <input 
                        type="text" className="admin-input" 
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                    />
                </div>
                <div className="editor-col">
                    <label style={{color:'#888', fontSize:'12px'}}>Цена</label>
                    <input 
                        type="number" className="admin-input" 
                        value={formData.price}
                        onChange={e => setFormData({...formData, price: parseInt(e.target.value)})}
                    />
                </div>
            </div>

            <h4 style={{marginTop:'30px', borderBottom:'1px solid #444'}}>Содержимое ({selectedPrizeIds.length})</h4>
            
            <div className="item-picker-container">
                <div className="picker-column">
                    <div className="picker-header">В КЕЙСЕ</div>
                    <div className="picker-list">
                        {selectedPrizeIds.map(id => {
                            const item = allPrizes.find(p => p.id === id);
                            if(!item) return null;
                            return (
                                <div key={id} className="picker-item">
                                    <button className="action-btn-small btn-remove" onClick={() => setSelectedPrizeIds(prev => prev.filter(pid => pid !== id))}>−</button>
                                    <img src={item.image} alt="" />
                                    <span>{item.name}</span>
                                    <small style={{color:'#ffc107'}}>{item.value}</small>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="picker-column">
                    <div className="picker-header">ДОБАВИТЬ</div>
                    <input type="text" placeholder="Поиск..." className="admin-input" style={{padding:'8px', marginBottom:'10px', fontSize:'14px'}} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    <div className="picker-list">
                        {availablePrizes.map(item => (
                            <div key={item.id} className="picker-item" style={{opacity: 0.8}}>
                                <img src={item.image} alt="" />
                                <span>{item.name}</span>
                                <small style={{color:'#ffc107'}}>{item.value}</small>
                                <button className="action-btn-small btn-add" onClick={() => setSelectedPrizeIds(prev => [...prev, item.id])}>+</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <button className="save-fab" onClick={handleSave}>СОХРАНИТЬ В БД</button>
        </div>
    );
};

export default AdminPage;
