import React, { useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { AppContext } from '../context/AppContext';
import { Link } from 'react-router-dom';
import '../styles/admin.css';

const AdminPage = () => {
    const { ALL_CASES, ALL_PRIZES, refreshConfig } = useContext(AppContext);
    
    // Пытаемся восстановить пароль из памяти браузера
    const [password, setPassword] = useState(localStorage.getItem('admin_pass') || '');
    const [isAuthorized, setIsAuthorized] = useState(!!localStorage.getItem('admin_pass'));
    const [activeTab, setActiveTab] = useState('items');

    // === ФУНКЦИЯ-ОБЕРТКА ДЛЯ ЗАПРОСОВ ===
    // Она автоматически добавляет пароль в заголовки
    const adminFetch = useCallback(async (url, options = {}) => {
        const headers = options.headers || {};
        headers['x-admin-password'] = password; // <-- КЛЮЧЕВОЙ МОМЕНТ

        // Если отправляем не FormData (файлы), то добавляем Content-Type
        if (!(options.body instanceof FormData) && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        const res = await fetch(url, { ...options, headers });

        // Если сервер ответил "Доступ запрещен", выходим
        if (res.status === 403) {
            setIsAuthorized(false);
            localStorage.removeItem('admin_pass');
            alert("Ошибка доступа: Неверный пароль админа");
            throw new Error("Forbidden");
        }
        
        return res;
    }, [password]);

    const handleLogin = () => {
        if (!password) return alert("Введите пароль");
        localStorage.setItem('admin_pass', password);
        setIsAuthorized(true);
        // Можно сразу попробовать обновить конфиг, чтобы проверить пароль
        refreshConfig(); 
    };

    const handleLogout = () => {
        localStorage.removeItem('admin_pass');
        setPassword('');
        setIsAuthorized(false);
    };

    // --- ЭКРАН ВХОДА ---
    if (!isAuthorized) {
        return (
            <div className="login-wrapper">
                <div className="mobile-restriction">
                    <h2>Только для ПК</h2>
                    <p>Админ-панель недоступна на мобильных устройствах.</p>
                    <Link to="/" className="mobile-back-btn">На главную</Link>
                </div>

                <div className="login-card">
                    <h2 style={{margin:'0 0 20px 0', color:'#fff'}}>EasyDrop Admin</h2>
                    <input 
                        type="password" 
                        className="modern-input"
                        placeholder="Пароль доступа (.env)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{marginBottom:'15px', textAlign:'center'}}
                    />
                    <button 
                        className="modern-button primary full-width" 
                        onClick={handleLogin}
                    >
                        Войти в панель
                    </button>
                    <Link to="/" style={{display:'block', marginTop:'20px', color:'#58a6ff', fontSize:'13px', textDecoration:'none'}}>
                        ← Вернуться на сайт
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="mobile-restriction">
                <h2>Только для ПК</h2>
                <p>Пожалуйста, зайдите с компьютера для управления проектом.</p>
                <Link to="/" className="mobile-back-btn">На главную</Link>
            </div>

            <div className="admin-layout">
                <aside className="admin-sidebar">
                    <div className="sidebar-header">
                        <h1>EasyDrop</h1>
                        <span>SECURE</span>
                    </div>
                    <nav className="sidebar-nav">
                        <button className={`nav-btn ${activeTab === 'items' ? 'active' : ''}`} onClick={() => setActiveTab('items')}>
                            💎 Предметы
                        </button>
                        <button className={`nav-btn ${activeTab === 'cases' ? 'active' : ''}`} onClick={() => setActiveTab('cases')}>
                            🎒 Кейсы
                        </button>
                        <button className={`nav-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
                            👥 Пользователи
                        </button>
                    </nav>
                    <div className="sidebar-footer">
                        <button onClick={handleLogout} className="nav-btn logout">Выйти</button>
                        <Link to="/" className="nav-btn">На сайт</Link>
                    </div>
                </aside>

                <main className="admin-main">
                    {activeTab === 'items' && <ItemManager prizes={ALL_PRIZES} onUpdate={refreshConfig} api={adminFetch} />}
                    {activeTab === 'cases' && <CaseManager cases={ALL_CASES} allPrizes={ALL_PRIZES} onUpdate={refreshConfig} api={adminFetch} />}
                    {activeTab === 'users' && <UserManager api={adminFetch} />}
                </main>
            </div>
        </>
    );
};

// ==================================================
// 1. МЕНЕДЖЕР ПРЕДМЕТОВ
// ==================================================
const ItemManager = ({ prizes, onUpdate, api }) => {
    const [selectedItemId, setSelectedItemId] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    
    const selectedItem = useMemo(() => prizes.find(p => p.id === selectedItemId), [prizes, selectedItemId]);

    const handleServerUpdate = async (formData) => {
        const url = isCreating ? '/api/admin/prize/create' : '/api/admin/prize/update';
        try {
            // Используем api вместо fetch, он сам добавит пароль
            const res = await api(url, { method: 'POST', body: formData });
            if(res.ok) { 
                onUpdate(); 
                setIsCreating(false); 
                alert('Предмет сохранен!'); 
            } else { 
                alert('Ошибка при сохранении'); 
            }
        } catch(e) { console.error(e); }
    };

    return (
        <div className="cases-layout">
            <div className="cases-sidebar">
                <div className="cases-sidebar-header">
                    <button className="modern-button primary full-width" onClick={() => {setSelectedItemId(null); setIsCreating(true);}}>
                        + Добавить предмет
                    </button>
                </div>
                <div className="cases-list">
                    {prizes.map(p => (
                        <div 
                            key={p.id} 
                            className={`case-list-item ${selectedItemId === p.id ? 'active' : ''}`} 
                            onClick={() => {setSelectedItemId(p.id); setIsCreating(false);}}
                        >
                            <img src={p.image} alt="" />
                            <div className="case-list-info">
                                <span className="case-name">{p.name}</span>
                                <span className="case-meta">{p.value} stars</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="cases-content">
                {(selectedItem || isCreating) ? (
                    <ItemEditor 
                        key={selectedItem ? selectedItem.id : 'new'}
                        item={selectedItem || { name: 'Новый предмет', value: 100, chance: 1, image: '/images/case/item.png' }} 
                        onSave={handleServerUpdate} 
                        isNew={isCreating}
                    />
                ) : (
                    <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#8b949e'}}>
                        Выберите предмет из списка слева
                    </div>
                )}
            </div>
        </div>
    );
};

const ItemEditor = ({ item, onSave, isNew }) => {
    const [formData, setFormData] = useState({ ...item });
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(item.image);

    useEffect(() => { return () => { if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl); }; }, [previewUrl]);
    
    useEffect(() => { 
        setFormData({...item}); 
        setPreviewUrl(item.image); 
        setSelectedFile(null); 
    }, [item]);

    const handleFile = (e) => {
        if (e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
            setPreviewUrl(URL.createObjectURL(e.target.files[0]));
        }
    };

    const handleSave = () => {
        const data = new FormData();
        if(!isNew) data.append('id', formData.id);
        data.append('name', formData.name);
        data.append('value', Number(formData.value) || 0);
        data.append('chance', Number(formData.chance) || 0);
        data.append('existingImage', formData.image);
        if(selectedFile) data.append('imageFile', selectedFile);
        onSave(data);
    };

    return (
        <div className="editor-wrapper">
            <div className="editor-header-row">
                <h2>{isNew ? 'Создание предмета' : 'Редактирование'}</h2>
                <button className="modern-button primary" onClick={handleSave}>Сохранить</button>
            </div>

            <div className="editor-form-grid">
                <div className="image-upload-section">
                    <div className="img-preview-box">
                        <img src={previewUrl} alt="Preview" />
                    </div>
                    <label className="modern-button secondary" style={{width:'100%', textAlign:'center', display:'block'}}>
                        Загрузить фото
                        <input type="file" hidden accept="image/*" onChange={handleFile} />
                    </label>
                </div>

                <div className="fields-section">
                    <div className="form-group full-row">
                        <label>Название</label>
                        <input className="modern-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label>Цена (Stars)</label>
                        <input type="number" className="modern-input" value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} />
                    </div>
                    <div className="form-group">
                        <label>Базовый шанс (%)</label>
                        <input type="number" className="modern-input" value={formData.chance} onChange={e => setFormData({...formData, chance: e.target.value})} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// ==================================================
// 2. МЕНЕДЖЕР КЕЙСОВ
// ==================================================
const CaseManager = ({ cases, allPrizes, onUpdate, api }) => {
    const [selectedCaseId, setSelectedCaseId] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const selectedCase = useMemo(() => cases.find(c => c.id === selectedCaseId), [cases, selectedCaseId]);

    const handleServerUpdate = async (formData) => {
        const url = isCreating ? '/api/admin/case/create' : '/api/admin/case/update';
        try {
            const res = await api(url, { method: 'POST', body: formData });
            
            // В `api` (adminFetch) мы не ставили .json() автоматически, так как нужно обрабатывать ошибки.
            // Но здесь мы знаем, что если не выбросило ошибку, значит 200 OK (или 500, который надо прочитать).
            
            const responseText = await res.text();

            if (res.ok) { 
                onUpdate(); 
                setIsCreating(false); 
                if(isCreating) {
                    try {
                        const d = JSON.parse(responseText); 
                        if(d && d.id) setSelectedCaseId(d.id); 
                    } catch(e) {} 
                } 
                alert('Кейс сохранен успешно!'); 
            } else {
                let errorMsg = responseText;
                try {
                    const json = JSON.parse(responseText);
                    if (json.error) errorMsg = json.error;
                } catch (e) {}
                alert(`ОШИБКА: ${errorMsg}`);
            }
        } catch(e) { 
            console.error(e); 
        }
    };

    return (
        <div className="cases-layout">
            <div className="cases-sidebar">
                <div className="cases-sidebar-header">
                    <button className="modern-button primary full-width" onClick={() => {setSelectedCaseId(null); setIsCreating(true);}}>
                        + Добавить кейс
                    </button>
                </div>
                <div className="cases-list">
                    {cases.map(c => (
                        <div 
                            key={c.id} 
                            className={`case-list-item ${selectedCaseId === c.id ? 'active' : ''}`} 
                            onClick={() => {setSelectedCaseId(c.id); setIsCreating(false);}}
                        >
                            <img src={c.image} alt="" />
                            <div className="case-list-info">
                                <span className="case-name">{c.name}</span>
                                <span className="case-meta">{c.isPromo ? 'PROMO' : `${c.price} stars`}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="cases-content">
                {(selectedCase || isCreating) ? (
                    <CaseEditor 
                        key={selectedCase ? selectedCase.id : 'new'}
                        caseItem={selectedCase || { name: 'Новый кейс', price: 100, image: '/images/case.png', prizeIds: [], tag: 'common', isPromo: false, promoCode: '', maxActivations: 0 }} 
                        onSave={handleServerUpdate} 
                        allPrizes={allPrizes}
                        isNew={isCreating}
                    />
                ) : (
                    <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#8b949e'}}>
                        Выберите кейс из списка слева
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
    const [selectedPrizeIds, setSelectedPrizeIds] = useState(() => (caseItem.prizeIds || []).map(i => typeof i === 'string' ? { id: i, chance: 0 } : i));

    useEffect(() => { return () => { if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl); }; }, [previewUrl]);
    
    useEffect(() => {
        setFormData({...caseItem}); 
        setPreviewUrl(caseItem.image); 
        setSelectedFile(null);
        setSelectedPrizeIds((caseItem.prizeIds || []).map(i => typeof i === 'string' ? { id: i, chance: 0 } : i));
    }, [caseItem]);

    const handleFile = (e) => {
        if (e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
            setPreviewUrl(URL.createObjectURL(e.target.files[0]));
        }
    };

    const handleSave = () => {
        const data = new FormData();
        if(!isNew && formData.id) data.append('id', formData.id);
        
        data.append('name', formData.name);
        data.append('price', Number(formData.price) || 0);
        data.append('tag', formData.tag);
        data.append('isPromo', formData.isPromo);
        data.append('promoCode', formData.promoCode || '');
        data.append('maxActivations', Number(formData.maxActivations) || 0);
        data.append('prizeIds', JSON.stringify(selectedPrizeIds));
        data.append('existingImage', formData.image);
        if(selectedFile) data.append('imageFile', selectedFile);
        
        onSave(data);
    };

    const availablePrizes = allPrizes.filter(p => !selectedPrizeIds.some(s => s.id === p.id) && p.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="editor-wrapper">
            <div className="editor-header-row">
                <h2>{isNew ? 'Создание' : 'Редактирование'}</h2>
                <button className="modern-button primary" onClick={handleSave}>Сохранить изменения</button>
            </div>

            <div className="editor-form-grid">
                <div className="image-upload-section">
                    <div className="img-preview-box">
                        <img src={previewUrl} alt="Preview" />
                    </div>
                    <label className="modern-button secondary" style={{width:'100%', textAlign:'center', display:'block'}}>
                        Загрузить обложку
                        <input type="file" hidden accept="image/*" onChange={handleFile} />
                    </label>
                </div>

                <div className="fields-section">
                    <div className="form-group full-row">
                        <label>Название кейса</label>
                        <input className="modern-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                    </div>
                    
                    <div className="form-group">
                        <label>Цена</label>
                        <input 
                            type="number" 
                            className="modern-input" 
                            value={formData.price} 
                            onChange={e => setFormData({...formData, price: e.target.value})} 
                            disabled={formData.isPromo} 
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Редкость</label>
                        <select className="modern-input" value={formData.tag || 'common'} onChange={e => setFormData({...formData, tag: e.target.value})}>
                            <option value="common">Обычный</option>
                            <option value="rare">Редкий</option>
                            <option value="epic">Эпик</option>
                            <option value="legendary">Легендарный</option>
                            <option value="promo">Промо</option>
                        </select>
                    </div>

                    <div className="form-group full-row">
                        <div className="toggle-row">
                            <label className="switch">
                                <input type="checkbox" checked={formData.isPromo} onChange={e => setFormData({...formData, isPromo: e.target.checked})} />
                                <span className="slider"></span>
                            </label>
                            <span style={{fontSize:13}}>Это промо-кейс (бесплатный по коду)</span>
                        </div>
                    </div>

                    {formData.isPromo && (
                        <div className="form-group full-row">
                            <label>Промокод</label>
                            <input className="modern-input" placeholder="CODE2024" value={formData.promoCode || ''} onChange={e => setFormData({...formData, promoCode: e.target.value})} />
                        </div>
                    )}

                    <div className="form-group full-row">
                        <label>Лимит открытий (0 = безлимит)</label>
                        <input 
                            type="number" 
                            className="modern-input" 
                            value={formData.maxActivations} 
                            onChange={e => setFormData({...formData, maxActivations: e.target.value})} 
                        />
                    </div>
                </div>
            </div>

            <div className="item-picker-layout">
                <div className="picker-col">
                    <div className="picker-head"><span>В КЕЙСЕ ({selectedPrizeIds.length})</span></div>
                    <div className="picker-list">
                        {selectedPrizeIds.map(p => {
                            const item = allPrizes.find(ap => ap.id === p.id);
                            if(!item) return null;
                            return (
                                <div key={p.id} className="picker-item">
                                    <img src={item.image} alt="" />
                                    <div className="picker-info"><div className="picker-name">{item.name}</div></div>
                                    <input 
                                        className="chance-input" 
                                        value={p.chance} 
                                        type="number"
                                        onChange={e => setSelectedPrizeIds(prev => prev.map(x => x.id === p.id ? {...x, chance: parseFloat(e.target.value) || 0} : x))} 
                                    />
                                    <span style={{fontSize:12, color:'#8b949e'}}>%</span>
                                    <button className="mini-btn remove" onClick={() => setSelectedPrizeIds(prev => prev.filter(x => x.id !== p.id))}>&times;</button>
                                </div>
                            )
                        })}
                    </div>
                </div>
                <div className="picker-col">
                    <div className="picker-head search-head"><span>Добавить</span><input className="modern-input" style={{width:100, padding:'2px 6px', fontSize:11}} placeholder="Поиск..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
                    <div className="picker-list">
                        {availablePrizes.map(item => (
                            <div key={item.id} className="picker-item"><img src={item.image} alt="" /><div className="picker-info"><div className="picker-name">{item.name}</div><div className="picker-sub">База: {item.chance}%</div></div><button className="mini-btn add" onClick={() => setSelectedPrizeIds([...selectedPrizeIds, {id:item.id, chance:item.chance}])}>+</button></div>
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
const UserManager = ({ api }) => {
    const [searchId, setSearchId] = useState('');
    const [user, setUser] = useState(null);
    const [balance, setBalance] = useState('');

    const find = async () => {
        if(!searchId) return;
        try {
            const res = await api(`/api/admin/user/${searchId}`);
            if(res.ok) { 
                const u = await res.json(); 
                setUser(u); 
                setBalance(u.balance); 
            }
            else { 
                alert('Пользователь не найден'); 
                setUser(null); 
            }
        } catch (e) { console.error(e); }
    };

    const save = async () => {
        if(!user) return;
        try {
            await api('/api/admin/user/balance', { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, // тут api() сам пароль добавит
                body: JSON.stringify({id: user.id, amount: balance, type: 'set'}) 
            });
            alert('Баланс обновлен'); 
            find();
        } catch (e) { console.error(e); }
    };

    return (
        <div className="admin-panel small-panel">
            <div className="panel-header"><h2>Пользователи</h2></div>
            <div style={{padding:'20px'}}>
                <div style={{display:'flex', gap:10, marginBottom:20}}>
                    <input className="modern-input" placeholder="ID пользователя" value={searchId} onChange={e => setSearchId(e.target.value)} />
                    <button className="modern-button primary" onClick={find}>Найти</button>
                </div>
                {user && (
                    <div className="user-card-admin">
                        <div className="user-head">
                            <img src={user.photo_url || '/images/profile.png'} alt="" />
                            <div>
                                <h3>{user.first_name}</h3>
                                <span>@{user.username || 'no_username'}</span>
                            </div>
                        </div>
                        <div className="balance-edit">
                            <label>Баланс Stars (перезапись):</label>
                            <div className="balance-row">
                                <input type="number" className="modern-input" value={balance} onChange={e => setBalance(e.target.value)} />
                                <button className="modern-button success" onClick={save}>Сохранить</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPage;
