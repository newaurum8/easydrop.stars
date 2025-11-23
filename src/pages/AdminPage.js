import React, { useContext, useState, useMemo, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { Link } from 'react-router-dom';
import '../styles/admin.css';

const SECRET_PASSWORD = "admin"; // Пароль для входа

const AdminPage = () => {
    const { ALL_CASES, ALL_PRIZES, refreshConfig } = useContext(AppContext);

    const [isAuthorized, setIsAuthorized] = useState(false);
    const [password, setPassword] = useState('');
    const [activeTab, setActiveTab] = useState('items');

    // --- АВТОРИЗАЦИЯ ---
    if (!isAuthorized) {
        return (
            <div className="app-container" style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh'}}>
                <div className="admin-login-card">
                    <h2>Админ-панель</h2>
                    <input 
                        type="password" 
                        className="modern-input"
                        placeholder="Введите пароль"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <button 
                        className="modern-button primary full-width" 
                        style={{marginTop: '15px'}}
                        onClick={() => password === SECRET_PASSWORD ? setIsAuthorized(true) : alert('Неверный пароль')}
                    >
                        Войти
                    </button>
                    <Link to="/" className="back-link">Вернуться в приложение</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-layout">
            <aside className="admin-sidebar">
                <div className="sidebar-header">
                    <h1>EasyDrop</h1>
                    <span>Admin</span>
                </div>
                <nav className="sidebar-nav">
                    <button 
                        className={`nav-btn ${activeTab === 'items' ? 'active' : ''}`}
                        onClick={() => setActiveTab('items')}
                    >
                        💎 Предметы
                    </button>
                    <button 
                        className={`nav-btn ${activeTab === 'cases' ? 'active' : ''}`}
                        onClick={() => setActiveTab('cases')}
                    >
                        🎒 Кейсы
                    </button>
                    <button 
                        className={`nav-btn ${activeTab === 'users' ? 'active' : ''}`}
                        onClick={() => setActiveTab('users')}
                    >
                        👥 Пользователи
                    </button>
                </nav>
                <div className="sidebar-footer">
                    <Link to="/" className="nav-btn logout">← В приложение</Link>
                </div>
            </aside>

            <main className="admin-main">
                {activeTab === 'items' && <ItemManager prizes={ALL_PRIZES} onUpdate={refreshConfig} />}
                {activeTab === 'cases' && <CaseManager cases={ALL_CASES} allPrizes={ALL_PRIZES} onUpdate={refreshConfig} />}
                {activeTab === 'users' && <UserManager />}
            </main>
        </div>
    );
};

// ==================================================
// 1. МЕНЕДЖЕР ПРЕДМЕТОВ
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
            if (res.ok) { setEditId(null); onUpdate(); } 
            else { alert('Ошибка при сохранении'); }
        } catch (e) { console.error(e); alert('Ошибка соединения'); }
    };

    return (
        <div className="admin-panel">
            <div className="panel-header">
                <h2>База предметов</h2>
                <input 
                    type="text" 
                    className="modern-input search" 
                    placeholder="🔍 Поиск предмета..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>
            
            <div className="table-container">
                <div className="table-header-row">
                    <span>Фото</span><span>Название</span><span>Цена</span><span>Баз. Шанс</span><span>Действие</span>
                </div>
                <div className="table-body">
                    {filteredPrizes.map(item => (
                        <div key={item.id} className="table-row">
                            <img src={item.image} alt="" className="row-img" />
                            <div className="row-info">
                                <div className="row-title">{item.name}</div>
                                <div className="row-subtitle">{item.id}</div>
                            </div>
                            
                            {editId === item.id ? (
                                <>
                                    <input type="number" className="modern-input small" value={formData.value} onChange={e => setFormData({...formData, value: Number(e.target.value)})} />
                                    <input type="number" className="modern-input small" value={formData.chance} onChange={e => setFormData({...formData, chance: Number(e.target.value)})} />
                                    <div className="row-actions">
                                        <button className="icon-btn success" onClick={saveItem}>✓</button>
                                        <button className="icon-btn danger" onClick={cancelEdit}>✕</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="row-value">{item.value.toLocaleString()}</div>
                                    <div>{item.chance}</div>
                                    <button className="modern-button small secondary" onClick={() => startEdit(item)}>Edit</button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
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

    const handleServerUpdate = async (formData) => {
        const url = isCreating ? '/api/admin/case/create' : '/api/admin/case/update';
        try {
            // FormData сама выставляет нужный Content-Type с boundary
            const res = await fetch(url, { method: 'POST', body: formData });
            if (res.ok) {
                onUpdate();
                setIsCreating(false);
                if (isCreating) {
                    const newCase = await res.json();
                    setSelectedCaseId(newCase.id);
                }
                alert('Успешно сохранено!');
            } else {
                const err = await res.json();
                alert('Ошибка: ' + (err.error || 'Unknown'));
            }
        } catch (err) { console.error(err); alert('Ошибка соединения'); }
    };

    return (
        <div className="cases-layout">
            <div className="cases-sidebar">
                <button className="modern-button primary full-width" onClick={() => {setSelectedCaseId(null); setIsCreating(true);}}>
                    + Новый кейс
                </button>
                <div className="cases-list">
                    {cases.map(c => (
                        <div 
                            key={c.id} 
                            className={`case-list-item ${selectedCaseId === c.id ? 'active' : ''}`} 
                            onClick={() => {setSelectedCaseId(c.id); setIsCreating(false);}}
                        >
                            <img src={c.image} alt={c.name} />
                            <div className="case-list-info">
                                <div className="case-list-name">{c.name}</div>
                                <div className="case-list-meta">
                                    {c.isPromo ? <span className="badge promo">Promo</span> : <span className="badge price">{c.price}</span>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="cases-content">
                {(selectedCase || isCreating) ? (
                    <CaseEditor 
                        key={selectedCase ? selectedCase.id : 'new'}
                        caseItem={selectedCase || { 
                            name: 'Новый кейс', price: 100, image: '/images/case.png', prizeIds: [], 
                            tag: 'common', isPromo: false, promoCode: '', maxActivations: 0, currentActivations: 0
                        }} 
                        onSave={handleServerUpdate} 
                        allPrizes={allPrizes}
                        isNew={isCreating}
                    />
                ) : (
                    <div className="empty-selection">
                        <h3>Выберите кейс для настройки</h3>
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
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(caseItem.image);
    
    const [selectedPrizeIds, setSelectedPrizeIds] = useState(() => {
        const items = caseItem.prizeIds || [];
        return items.map(item => typeof item === 'string' ? { id: item, chance: 0 } : item);
    });

    // Очистка URL объекта при размонтировании или смене картинки
    useEffect(() => {
        return () => {
            if (previewUrl && previewUrl.startsWith('blob:')) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    // Обновление preview при выборе кейса из списка
    useEffect(() => {
        setFormData({...caseItem});
        setPreviewUrl(caseItem.image);
        setSelectedFile(null);
        setSelectedPrizeIds(() => {
            const items = caseItem.prizeIds || [];
            return items.map(item => typeof item === 'string' ? { id: item, chance: 0 } : item);
        });
    }, [caseItem]);

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const availablePrizes = allPrizes.filter(p => 
        !selectedPrizeIds.some(added => added.id === p.id) && 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSave = () => {
        if (!formData.name) return alert('Введите название');
        if (formData.isPromo && !formData.promoCode) return alert('Введите промокод');

        const data = new FormData();
        if (!isNew) data.append('id', formData.id);
        data.append('name', formData.name);
        data.append('price', formData.price);
        data.append('tag', formData.tag);
        data.append('isPromo', formData.isPromo);
        data.append('promoCode', formData.promoCode || '');
        data.append('maxActivations', formData.maxActivations || 0);
        data.append('prizeIds', JSON.stringify(selectedPrizeIds));
        data.append('existingImage', formData.image); 
        if (selectedFile) data.append('imageFile', selectedFile);

        onSave(data);
    };

    const updateChance = (id, val) => setSelectedPrizeIds(prev => prev.map(i => i.id === id ? { ...i, chance: parseFloat(val) || 0 } : i));
    const addItem = (item) => setSelectedPrizeIds(prev => [...prev, { id: item.id, chance: item.chance }]);
    const removeItem = (id) => setSelectedPrizeIds(prev => prev.filter(i => i.id !== id));

    return (
        <div className="editor-container">
            <div className="editor-header">
                <h2>{isNew ? 'Создание кейса' : `Настройка: ${formData.name}`}</h2>
                <button className="modern-button success" onClick={handleSave}>Сохранить изменения</button>
            </div>

            <div className="editor-grid">
                {/* Блок 1: Основное */}
                <div className="editor-card">
                    <h3>Основное</h3>
                    <div className="form-group">
                        <label>Название</label>
                        <input type="text" className="modern-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Цена</label>
                            <input type="number" className="modern-input" value={formData.price} onChange={e => setFormData({...formData, price: parseInt(e.target.value)})} disabled={formData.isPromo} />
                        </div>
                        <div className="form-group">
                            <label>Редкость</label>
                            <select className="modern-input" value={formData.tag || 'common'} onChange={e => setFormData({...formData, tag: e.target.value})}>
                                <option value="common">Обычный</option>
                                <option value="rare">Редкий</option>
                                <option value="epic">Эпик</option>
                                <option value="legendary">Легендарный</option>
                                <option value="limited">Лимит</option>
                                <option value="promo">Промо</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Блок 2: Визуал */}
                <div className="editor-card visual-card">
                    <h3>Изображение</h3>
                    <div className="image-uploader">
                        <div className="image-preview">
                            <img src={previewUrl} alt="Preview" />
                        </div>
                        <label className="upload-btn">
                            Загрузить файл
                            <input type="file" accept="image/*" hidden onChange={handleFileChange} />
                        </label>
                    </div>
                </div>

                {/* Блок 3: Промо и Лимиты */}
                <div className="editor-card full-width">
                    <div className="settings-grid">
                        <div className="setting-item">
                            <label className="toggle-switch">
                                <input type="checkbox" checked={formData.isPromo} onChange={e => setFormData({...formData, isPromo: e.target.checked})} />
                                <span className="toggle-slider"></span>
                            </label>
                            <span className="setting-label">Промо-кейс</span>
                        </div>

                        {formData.isPromo && (
                            <div className="form-group">
                                <label>Промокод</label>
                                <input type="text" className="modern-input" placeholder="CODE123" value={formData.promoCode || ''} onChange={e => setFormData({...formData, promoCode: e.target.value})} />
                            </div>
                        )}

                        <div className="form-group">
                            <label>Лимит прокрутов (0 = бесконечно)</label>
                            <input type="number" className="modern-input" value={formData.maxActivations || 0} onChange={e => setFormData({...formData, maxActivations: parseInt(e.target.value)})} />
                            {!isNew && formData.maxActivations > 0 && (
                                <small className="hint">Использовано: {formData.currentActivations}</small>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Пикер предметов */}
            <div className="item-picker-layout">
                <div className="picker-col">
                    <div className="picker-head">
                        <span>Содержимое ({selectedPrizeIds.length})</span>
                        <small>Настройте шанс выпадения</small>
                    </div>
                    <div className="picker-body">
                        {selectedPrizeIds.length === 0 && <div className="empty-text">Кейс пуст</div>}
                        {selectedPrizeIds.map(pc => {
                            const item = allPrizes.find(p => p.id === pc.id);
                            if(!item) return null;
                            return (
                                <div key={pc.id} className="picker-item">
                                    <button className="remove-btn" onClick={() => removeItem(pc.id)}>−</button>
                                    <img src={item.image} alt="" />
                                    <div className="p-info">
                                        <b>{item.name}</b>
                                        <div className="chance-input-wrapper">
                                            <input type="number" value={pc.chance} onChange={(e) => updateChance(pc.id, e.target.value)} />
                                            <span>%</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="picker-col">
                    <div className="picker-head search-head">
                        <span>Добавить предмет</span>
                        <input type="text" placeholder="Поиск..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>
                    <div className="picker-body">
                        {availablePrizes.map(item => (
                            <div key={item.id} className="picker-item available" onClick={() => addItem(item)}>
                                <img src={item.image} alt="" />
                                <div className="p-info">
                                    <b>{item.name}</b>
                                    <small>База: {item.chance}%</small>
                                </div>
                                <button className="add-btn">+</button>
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
    const [newBalance, setNewBalance] = useState('');

    const findUser = async () => {
        if(!searchId) return;
        try {
            const res = await fetch(`/api/admin/user/${searchId}`);
            if(res.ok) {
                const data = await res.json();
                setFoundUser(data);
                setNewBalance(data.balance);
            } else {
                alert('Пользователь не найден');
                setFoundUser(null);
            }
        } catch (e) { alert('Ошибка'); }
    };

    const saveBalance = async () => {
        if(!foundUser) return;
        await fetch('/api/admin/user/balance', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id: foundUser.id, amount: newBalance, type: 'set' })
        });
        alert('Баланс обновлен');
        findUser();
    };

    return (
        <div className="admin-panel small-panel">
            <h2>Управление пользователями</h2>
            <div className="search-user-row">
                <input className="modern-input" placeholder="ID пользователя" value={searchId} onChange={e => setSearchId(e.target.value)} />
                <button className="modern-button primary" onClick={findUser}>Найти</button>
            </div>
            
            {foundUser && (
                <div className="user-card-admin">
                    <div className="user-head">
                        <img src={foundUser.photo_url || '/images/profile.png'} alt="" />
                        <div>
                            <h3>{foundUser.first_name}</h3>
                            <span>@{foundUser.username || 'no_username'}</span>
                        </div>
                    </div>
                    <div className="balance-edit">
                        <label>Баланс Stars:</label>
                        <div className="balance-row">
                            <input type="number" className="modern-input" value={newBalance} onChange={e => setNewBalance(e.target.value)} />
                            <button className="modern-button success" onClick={saveBalance}>Сохранить</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPage;
