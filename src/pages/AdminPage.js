import React, { useContext, useState, useMemo, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { Link } from 'react-router-dom';
import '../styles/admin.css';

const SECRET_PASSWORD = "admin"; 

const AdminPage = () => {
    const { ALL_CASES, ALL_PRIZES, refreshConfig } = useContext(AppContext);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [password, setPassword] = useState('');
    const [activeTab, setActiveTab] = useState('items');

    // --- АВТОРИЗАЦИЯ ---
    if (!isAuthorized) {
        return (
            <div className="login-wrapper">
                {/* Заглушка для мобильных */}
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
                        placeholder="Пароль доступа"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{marginBottom:'15px', textAlign:'center'}}
                    />
                    <button 
                        className="modern-button primary full-width" 
                        onClick={() => password === SECRET_PASSWORD ? setIsAuthorized(true) : alert('Неверно')}
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
                        <span>Control Panel</span>
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
                        <Link to="/" className="nav-btn logout">Выйти</Link>
                    </div>
                </aside>

                <main className="admin-main">
                    {activeTab === 'items' && <ItemManager prizes={ALL_PRIZES} onUpdate={refreshConfig} />}
                    {activeTab === 'cases' && <CaseManager cases={ALL_CASES} allPrizes={ALL_PRIZES} onUpdate={refreshConfig} />}
                    {activeTab === 'users' && <UserManager />}
                </main>
            </div>
        </>
    );
};

// ==================================================
// 1. МЕНЕДЖЕР ПРЕДМЕТОВ
// ==================================================
const ItemManager = ({ prizes, onUpdate }) => {
    const [editId, setEditId] = useState(null);
    const [formData, setFormData] = useState({});
    const [searchQuery, setSearchQuery] = useState('');

    const filtered = prizes.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

    const startEdit = (item) => { setEditId(item.id); setFormData({ value: item.value, chance: item.chance }); };
    const saveItem = async () => {
        await fetch('/api/admin/prize/update', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ id: editId, ...formData }) });
        setEditId(null); onUpdate();
    };

    return (
        <div className="admin-panel">
            <div className="panel-header">
                <h2>База предметов ({prizes.length})</h2>
                <input className="modern-input search" placeholder="Поиск..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className="table-container">
                <div className="table-header-row">
                    <span>Img</span><span>Название</span><span>Цена</span><span>Шанс</span><span>Action</span>
                </div>
                <div className="table-body">
                    {filtered.map(item => (
                        <div key={item.id} className="table-row">
                            <img src={item.image} className="row-img" alt="" />
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
                                        <button className="icon-btn danger" onClick={() => setEditId(null)}>✕</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="row-value">{item.value.toLocaleString()}</div>
                                    <div>{item.chance}%</div>
                                    <button className="modern-button secondary" style={{fontSize:11, padding:'4px 8px'}} onClick={() => startEdit(item)}>Edit</button>
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
            const res = await fetch(url, { method: 'POST', body: formData });
            if(res.ok) { onUpdate(); setIsCreating(false); if(isCreating) { const d = await res.json(); setSelectedCaseId(d.id); } alert('Сохранено'); }
        } catch(e) { console.error(e); }
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
                        <div key={c.id} className={`case-list-item ${selectedCaseId === c.id ? 'active' : ''}`} onClick={() => {setSelectedCaseId(c.id); setIsCreating(false);}}>
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
        setFormData({...caseItem}); setPreviewUrl(caseItem.image); setSelectedFile(null);
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
        if(!isNew) data.append('id', formData.id);
        data.append('name', formData.name);
        data.append('price', formData.price);
        data.append('tag', formData.tag);
        data.append('isPromo', formData.isPromo);
        data.append('promoCode', formData.promoCode || '');
        data.append('maxActivations', formData.maxActivations || 0);
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
                        <input type="number" className="modern-input" value={formData.price} onChange={e => setFormData({...formData, price: parseInt(e.target.value)})} disabled={formData.isPromo} />
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
                            <span style={{fontSize:13}}>Это промо-кейс</span>
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
                        <input type="number" className="modern-input" value={formData.maxActivations || 0} onChange={e => setFormData({...formData, maxActivations: parseInt(e.target.value)})} />
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
                                    <input className="chance-input" value={p.chance} onChange={e => setSelectedPrizeIds(prev => prev.map(x => x.id === p.id ? {...x, chance: e.target.value} : x))} /><span style={{fontSize:12, color:'#8b949e'}}>%</span>
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
const UserManager = () => {
    const [searchId, setSearchId] = useState('');
    const [user, setUser] = useState(null);
    const [balance, setBalance] = useState('');

    const find = async () => {
        if(!searchId) return;
        try {
            const res = await fetch(`/api/admin/user/${searchId}`);
            if(res.ok) { const u = await res.json(); setUser(u); setBalance(u.balance); }
            else { alert('Не найден'); setUser(null); }
        } catch (e) { alert('Ошибка'); }
    };

    const save = async () => {
        if(!user) return;
        await fetch('/api/admin/user/balance', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id: user.id, amount: balance, type: 'set'}) });
        alert('Обновлено'); find();
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
                            <label>Баланс Stars:</label>
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
