import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { Link } from 'react-router-dom';

const SECRET_PASSWORD = "admin"; // Пароль для входа

const AdminPage = () => {
    const { ALL_CASES, ALL_PRIZES, refreshConfig } = useContext(AppContext);

    const [isAuthorized, setIsAuthorized] = useState(false);
    const [password, setPassword] = useState('');
    const [activeTab, setActiveTab] = useState('users');

    // --- АВТОРИЗАЦИЯ ---
    if (!isAuthorized) {
        return (
            <div className="app-container" style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh'}}>
                <div className="admin-section" style={{width: '100%', maxWidth: '350px', textAlign:'center'}}>
                    <h2>Вход в Админку</h2>
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
                <h1>Панель Администратора</h1>
                <Link to="/" className="back-button" style={{margin:0, border:'1px solid #00aaff', padding:'8px 16px', borderRadius:'8px'}}>
                    В приложение
                </Link>
            </header>

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
                    🎒 Кейсы
                </button>
                <button 
                    className={`admin-tab-button ${activeTab === 'items' ? 'active' : ''}`}
                    onClick={() => setActiveTab('items')}
                >
                    💎 Предметы (Цены/Шансы)
                </button>
            </div>

            <div className="admin-content">
                {activeTab === 'users' && <UserManager />}
                {activeTab === 'cases' && <CaseManager cases={ALL_CASES} allPrizes={ALL_PRIZES} onUpdate={refreshConfig} />}
                {activeTab === 'items' && <ItemManager prizes={ALL_PRIZES} onUpdate={refreshConfig} />}
            </div>
        </div>
    );
};

// ==================================================
// 1. МЕНЕДЖЕР ПРЕДМЕТОВ (ЦЕНЫ И ШАНСЫ)
// ==================================================
const ItemManager = ({ prizes, onUpdate }) => {
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({});
    const [searchQuery, setSearchQuery] = useState('');

    const filteredPrizes = prizes.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const startEdit = (item) => {
        setEditId(item.id);
        setFormData({ value: item.value, chance: item.chance });
    };

    const cancelEdit = () => {
        setEditId(null);
        setFormData({});
    };

    const saveItem = async () => {
        try {
            const res = await fetch('/api/admin/prize/update', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ id: editId, ...formData })
            });
            
            if (res.ok) {
                setEditId(null);
                onUpdate(); // Обновляем глобальный контекст
            } else {
                alert('Ошибка при сохранении');
            }
        } catch (e) { 
            console.error(e);
            alert('Ошибка соединения'); 
        }
    };

    return (
        <div className="admin-section">
            <h3>Настройка предметов</h3>
            <input 
                type="text" 
                className="admin-input" 
                placeholder="Поиск предметов..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{marginBottom: '15px'}}
            />
            
            <div style={{maxHeight: '600px', overflowY: 'auto'}}>
                {filteredPrizes.map(item => (
                    <div key={item.id} style={{
                        display:'flex', alignItems:'center', gap:'10px', padding:'10px', 
                        background:'#212a31', marginBottom:'8px', borderRadius:'8px', border:'1px solid #3a4552'
                    }}>
                        <img src={item.image} alt="" style={{width:40, height:40, objectFit:'contain'}} />
                        
                        <div style={{flex:1}}>
                            <div style={{fontWeight:'bold', fontSize:'14px'}}>{item.name}</div>
                            <div style={{fontSize:'11px', color:'#888'}}>{item.id}</div>
                        </div>
                        
                        {editId === item.id ? (
                            <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
                                <div style={{display:'flex', flexDirection:'column', width:'80px'}}>
                                    <label style={{fontSize:'9px', color:'#aaa'}}>Цена</label>
                                    <input 
                                        type="number" 
                                        className="admin-input" 
                                        style={{padding:'5px', fontSize:'12px'}} 
                                        value={formData.value} 
                                        onChange={e => setFormData({...formData, value: Number(e.target.value)})} 
                                    />
                                </div>
                                <div style={{display:'flex', flexDirection:'column', width:'60px'}}>
                                    <label style={{fontSize:'9px', color:'#aaa'}}>Шанс</label>
                                    <input 
                                        type="number" 
                                        className="admin-input" 
                                        style={{padding:'5px', fontSize:'12px'}} 
                                        value={formData.chance} 
                                        onChange={e => setFormData({...formData, chance: Number(e.target.value)})} 
                                    />
                                </div>
                                <div style={{display:'flex', flexDirection:'column', gap:'2px'}}>
                                    <button className="action-btn-small btn-add" onClick={saveItem} title="Сохранить">✓</button>
                                    <button className="action-btn-small btn-remove" onClick={cancelEdit} title="Отмена">✕</button>
                                </div>
                            </div>
                        ) : (
                            <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                                <div style={{textAlign:'right'}}>
                                    <div style={{fontSize:'13px', color:'#ffc107'}}>{item.value.toLocaleString()} ⭐</div>
                                    <div style={{fontSize:'11px', color:'#888'}}>Шанс: {item.chance}</div>
                                </div>
                                <button className="admin-button" onClick={() => startEdit(item)}>Изменить</button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// ==================================================
// 2. МЕНЕДЖЕР КЕЙСОВ
// ==================================================
const CaseManager = ({ cases, allPrizes, onUpdate }) => {
    const [selectedCaseId, setSelectedCaseId] = useState(null);
    const [isCreating, setIsCreating] = useState(false);

    const selectedCase = useMemo(() => cases.find(c => c.id === selectedCaseId), [cases, selectedCaseId]);

    const handleServerUpdate = async (updatedCase) => {
        const url = isCreating ? '/api/admin/case/create' : '/api/admin/case/update';
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(updatedCase)
            });
            
            if (res.ok) {
                onUpdate();
                setIsCreating(false);
                if (isCreating) setSelectedCaseId(updatedCase.id);
                alert('Кейс успешно сохранен!');
            } else {
                alert('Ошибка сервера при сохранении');
            }
        } catch (err) { 
            console.error(err);
            alert('Ошибка соединения'); 
        }
    };

    const startCreate = () => {
        setSelectedCaseId(null);
        setIsCreating(true);
    };

    return (
        <div className="case-manager-layout">
            <div className="case-list-sidebar">
                <button className="save-fab" style={{marginBottom:10, background:'#4CAF50'}} onClick={startCreate}>
                    + СОЗДАТЬ КЕЙС
                </button>
                <div style={{overflowY:'auto', maxHeight:'calc(100% - 60px)'}}>
                    {cases.map(c => (
                        <div 
                            key={c.id} 
                            className={`admin-case-item ${selectedCaseId === c.id ? 'active' : ''}`} 
                            onClick={() => {setSelectedCaseId(c.id); setIsCreating(false);}}
                        >
                            <img src={c.image} alt={c.name} />
                            <div>
                                <div style={{fontWeight:'500', color:'#fff', fontSize:'14px'}}>{c.name}</div>
                                <div style={{fontSize:'12px', color:'#ffc107'}}>{c.price > 0 ? c.price : 'Бесплатно'}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="case-editor-area">
                {(selectedCase || isCreating) ? (
                    <CaseEditor 
                        key={selectedCase ? selectedCase.id : 'new'}
                        caseItem={selectedCase || { 
                            id: `case_${Date.now()}`, 
                            name: 'Новый кейс', 
                            price: 100, 
                            image: '/images/case.png', 
                            prizeIds: [], 
                            tag: 'common', 
                            isPromo: false 
                        }} 
                        onSave={handleServerUpdate} 
                        allPrizes={allPrizes}
                        isNew={isCreating}
                    />
                ) : (
                    <div style={{
                        display:'flex', justifyContent:'center', alignItems:'center', 
                        height:'100%', color:'#888', flexDirection:'column'
                    }}>
                        <h3>Выберите кейс для редактирования</h3>
                        <p>или создайте новый</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const CaseEditor = ({ caseItem, onSave, allPrizes, isNew }) => {
    const [formData, setFormData] = useState({ ...caseItem });
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPrizeIds, setSelectedPrizeIds] = useState(caseItem.prizeIds || []);

    // Фильтрация предметов для добавления (исключаем уже добавленные)
    const availablePrizes = allPrizes.filter(p => 
        !selectedPrizeIds.includes(p.id) && 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSave = () => {
        if (!formData.id || !formData.name) return alert('Заполните ID и название');
        onSave({ ...formData, prizeIds: selectedPrizeIds });
    };

    return (
        <div className="admin-section">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #3a4552', paddingBottom:'15px', marginBottom:'20px'}}>
                <h2 style={{margin:0}}>{isNew ? 'Создание кейса' : `Редактирование: ${formData.name}`}</h2>
                <button className="save-fab" style={{width:'auto', padding:'10px 20px', margin:0}} onClick={handleSave}>
                    СОХРАНИТЬ
                </button>
            </div>

            <div className="editor-row">
                <div className="editor-col">
                    <label>Название кейса</label>
                    <input 
                        type="text" className="admin-input" 
                        value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} 
                    />
                </div>
                <div className="editor-col">
                    <label>Уникальный ID {isNew ? '' : '(нельзя изменить)'}</label>
                    <input 
                        type="text" className="admin-input" 
                        disabled={!isNew} 
                        value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} 
                    />
                </div>
            </div>

            <div className="editor-row">
                <div className="editor-col">
                    <label>Цена открытия</label>
                    <input 
                        type="number" className="admin-input" 
                        value={formData.price} onChange={e => setFormData({...formData, price: parseInt(e.target.value)})} 
                    />
                </div>
                <div className="editor-col">
                    <label>Ссылка на картинку</label>
                    <div style={{display:'flex', gap:'10px'}}>
                        <input 
                            type="text" className="admin-input" 
                            value={formData.image} onChange={e => setFormData({...formData, image: e.target.value})} 
                        />
                        <img src={formData.image} alt="" style={{width:40, height:40, objectFit:'contain', background:'#212a31', borderRadius:4}} />
                    </div>
                </div>
            </div>

            <div className="editor-row">
                <div className="editor-col">
                    <label>Редкость (Тег)</label>
                    <select 
                        className="admin-input" 
                        value={formData.tag || 'common'} 
                        onChange={e => setFormData({...formData, tag: e.target.value})}
                    >
                        <option value="common">Обычный (Серый)</option>
                        <option value="rare">Редкий (Синий/Красный)</option>
                        <option value="legendary">Легендарный (Золотой)</option>
                        <option value="limited">Лимит (Оранжевый)</option>
                        <option value="promo">Промо (Фиолетовый)</option>
                    </select>
                </div>
                <div className="editor-col" style={{display:'flex', alignItems:'center', paddingTop:'25px'}}>
                    <label style={{display:'flex', alignItems:'center', gap:'10px', cursor:'pointer'}}>
                        <input 
                            type="checkbox" 
                            style={{width:20, height:20}} 
                            checked={formData.isPromo} 
                            onChange={e => setFormData({...formData, isPromo: e.target.checked})} 
                        />
                        <span>Это Промо-кейс (открытие по коду)</span>
                    </label>
                </div>
            </div>

            <h4 style={{marginTop:'20px', marginBottom:'10px'}}>Содержимое ({selectedPrizeIds.length} предм.)</h4>
            <div className="item-picker-container">
                {/* ЛЕВАЯ КОЛОНКА: ЧТО В КЕЙСЕ */}
                <div className="picker-column">
                    <div className="picker-header" style={{color:'#4CAF50'}}>ДОБАВЛЕНО</div>
                    <div className="picker-list">
                        {selectedPrizeIds.length === 0 && <div style={{padding:10, color:'#666', textAlign:'center'}}>Пусто</div>}
                        {selectedPrizeIds.map(id => {
                            const item = allPrizes.find(p => p.id === id);
                            if (!item) return null;
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

                {/* ПРАВАЯ КОЛОНКА: ЧТО МОЖНО ДОБАВИТЬ */}
                <div className="picker-column">
                    <div className="picker-header" style={{color:'#00aaff'}}>ДОСТУПНО</div>
                    <input 
                        type="text" placeholder="Поиск предмета..." className="admin-input" 
                        style={{padding:'8px', marginBottom:'10px', fontSize:'14px'}} 
                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)} 
                    />
                    <div className="picker-list">
                        {availablePrizes.map(item => (
                            <div key={item.id} className="picker-item" style={{opacity: 0.8}}>
                                <img src={item.image} alt="" />
                                <span>{item.name}</span>
                                <small style={{color:'#888'}}>{item.value}</small>
                                <button className="action-btn-small btn-add" onClick={() => setSelectedPrizeIds(prev => [...prev, item.id])}>+</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==================================================
// 3. МЕНЕДЖЕР ПОЛЬЗОВАТЕЛЕЙ
// ==================================================
const UserManager = () => {
    const [searchId, setSearchId] = useState('');
    const [foundUser, setFoundUser] = useState(null);
    const [statusMsg, setStatusMsg] = useState('');
    const [newBalance, setNewBalance] = useState('');

    const findUser = async () => {
        if (!searchId) return;
        setStatusMsg('Поиск...');
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
            alert('Баланс успешно обновлен!');
        } catch (err) {
            alert('Ошибка обновления');
        }
    };

    return (
        <div className="admin-section">
            <h3>Управление балансом</h3>
            <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                <input 
                    className="admin-input" 
                    placeholder="Введите Telegram ID" 
                    value={searchId}
                    onChange={e => setSearchId(e.target.value)}
                />
                <button className="upgrade-button" style={{width:'auto'}} onClick={findUser}>Найти</button>
            </div>
            {statusMsg && <p style={{color:'#f44336'}}>{statusMsg}</p>}

            {foundUser && (
                <div style={{background: '#212a31', padding: '20px', borderRadius: '12px', border:'1px solid #3a4552'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'15px', marginBottom:'15px', paddingBottom:'15px', borderBottom:'1px solid #3a4552'}}>
                        <img src={foundUser.photo_url || '/images/profile.png'} style={{width:50, height:50, borderRadius:'50%'}} alt=""/>
                        <div>
                            <div style={{fontWeight:'bold', fontSize:18}}>{foundUser.first_name}</div>
                            <div style={{color:'#888'}}>@{foundUser.username} (ID: {foundUser.id})</div>
                        </div>
                    </div>
                    
                    <div className="admin-form-group">
                        <label>Текущий баланс:</label>
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
                    
                    <div style={{marginTop:'15px', fontSize:'12px', color:'#888'}}>
                        Всего пополнений: {foundUser.total_top_up} stars
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPage;
