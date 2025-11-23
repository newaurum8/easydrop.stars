import React, { useContext, useState, useMemo } from 'react';
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
                <Link to="/" className="back-button" style={{margin:0, border:'1px solid #00aaff', padding:'8px 16px', borderRadius:'8px', textDecoration:'none'}}>
                    В приложение
                </Link>
            </header>

            <div className="admin-tabs">
                <button 
                    className={`admin-tab-button ${activeTab === 'items' ? 'active' : ''}`}
                    onClick={() => setActiveTab('items')}
                >
                    💎 Предметы (База)
                </button>
                <button 
                    className={`admin-tab-button ${activeTab === 'cases' ? 'active' : ''}`}
                    onClick={() => setActiveTab('cases')}
                >
                    🎒 Кейсы и Шансы
                </button>
                <button 
                    className={`admin-tab-button ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    👥 Пользователи
                </button>
            </div>

            <div className="admin-content">
                {activeTab === 'items' && <ItemManager prizes={ALL_PRIZES} onUpdate={refreshConfig} />}
                {activeTab === 'cases' && <CaseManager cases={ALL_CASES} allPrizes={ALL_PRIZES} onUpdate={refreshConfig} />}
                {activeTab === 'users' && <UserManager />}
            </div>
        </div>
    );
};

// ==================================================
// 1. МЕНЕДЖЕР ПРЕДМЕТОВ (БАЗОВЫЕ ЦЕНЫ)
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
                onUpdate(); 
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
            <h3>База предметов</h3>
            <p style={{fontSize:12, color:'#888', marginBottom:10}}>Здесь настраивается цена и "стандартный" шанс. Шанс в конкретном кейсе настраивается во вкладке "Кейсы".</p>
            <input 
                type="text" 
                className="admin-input" 
                placeholder="Поиск предметов..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{marginBottom: '15px'}}
            />
            
            <div style={{maxHeight: '600px', overflowY: 'auto'}}>
                <div className="items-table-header">
                    <span>Фото</span><span>Название</span><span>Цена</span><span>Баз. Шанс</span><span>Действие</span>
                </div>
                {filteredPrizes.map(item => (
                    <div key={item.id} className="admin-table-row">
                        <img src={item.image} alt="" style={{width:40, height:40, objectFit:'contain'}} />
                        
                        <div style={{flex:1, minWidth: '100px'}}>
                            <div style={{fontWeight:'bold', fontSize:'14px'}}>{item.name}</div>
                            <div style={{fontSize:'11px', color:'#888'}}>{item.id}</div>
                        </div>
                        
                        {editId === item.id ? (
                            <>
                                <input 
                                    type="number" 
                                    className="admin-input-small" 
                                    value={formData.value} 
                                    onChange={e => setFormData({...formData, value: Number(e.target.value)})} 
                                />
                                <input 
                                    type="number" 
                                    className="admin-input-small" 
                                    value={formData.chance} 
                                    onChange={e => setFormData({...formData, chance: Number(e.target.value)})} 
                                />
                                <div style={{display:'flex', gap:'2px'}}>
                                    <button className="action-btn-small btn-add" onClick={saveItem} title="Сохранить">✓</button>
                                    <button className="action-btn-small btn-remove" onClick={cancelEdit} title="Отмена">✕</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{color:'#ffc107'}}>{item.value.toLocaleString()}</div>
                                <div>{item.chance}</div>
                                <button className="admin-button-small" onClick={() => startEdit(item)}>Edit</button>
                            </>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// ==================================================
// 2. МЕНЕДЖЕР КЕЙСОВ (ОБНОВЛЕННЫЙ)
// ==================================================
const CaseManager = ({ cases, allPrizes, onUpdate }) => {
    const [selectedCaseId, setSelectedCaseId] = useState(null);
    const [isCreating, setIsCreating] = useState(false);

    const selectedCase = useMemo(() => cases.find(c => c.id === selectedCaseId), [cases, selectedCaseId]);

    const handleServerUpdate = async (formData) => {
        const url = isCreating ? '/api/admin/case/create' : '/api/admin/case/update';
        try {
            // ВАЖНО: Не устанавливаем Content-Type вручную при отправке FormData, браузер сделает это сам с boundary
            const res = await fetch(url, {
                method: 'POST',
                body: formData 
            });
            
            if (res.ok) {
                onUpdate();
                setIsCreating(false);
                if (isCreating) {
                    const newCase = await res.json();
                    setSelectedCaseId(newCase.id);
                }
                alert('Кейс успешно сохранен!');
            } else {
                const err = await res.json();
                alert('Ошибка сервера: ' + (err.error || 'Unknown'));
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
                                <div style={{fontSize:'12px', color:'#ffc107'}}>
                                    {c.maxActivations > 0 
                                        ? `Лимит: ${c.currentActivations || 0}/${c.maxActivations}` 
                                        : (c.price > 0 ? c.price : 'Бесплатно')}
                                </div>
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
                            name: 'Новый кейс', 
                            price: 100, 
                            image: '/images/case.png', 
                            prizeIds: [], 
                            tag: 'common', 
                            isPromo: false,
                            promoCode: '',
                            maxActivations: 0,
                            currentActivations: 0
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
    const [selectedFile, setSelectedFile] = useState(null); // Для новой картинки
    
    // selectedPrizeIds хранит { id, chance }
    const [selectedPrizeIds, setSelectedPrizeIds] = useState(() => {
        const items = caseItem.prizeIds || [];
        return items.map(item => 
            typeof item === 'string' ? { id: item, chance: 0 } : item
        );
    });

    const availablePrizes = allPrizes.filter(p => 
        !selectedPrizeIds.some(added => added.id === p.id) && 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleSave = () => {
        if (!formData.name) return alert('Название обязательно');
        if (formData.isPromo && !formData.promoCode) return alert('Укажите промокод!');

        // Собираем FormData
        const data = new FormData();
        if (!isNew) data.append('id', formData.id);
        
        data.append('name', formData.name);
        data.append('price', formData.price);
        data.append('tag', formData.tag);
        data.append('isPromo', formData.isPromo);
        data.append('promoCode', formData.promoCode || '');
        data.append('maxActivations', formData.maxActivations || 0);
        data.append('prizeIds', JSON.stringify(selectedPrizeIds));
        
        // Передаем путь к текущей картинке на случай, если новую не загрузили
        data.append('existingImage', formData.image); 

        // Если выбрали новый файл, добавляем его
        if (selectedFile) {
            data.append('imageFile', selectedFile);
        }

        onSave(data);
    };

    const updateChance = (id, newVal) => {
        setSelectedPrizeIds(prev => prev.map(item => 
            item.id === id ? { ...item, chance: parseFloat(newVal) || 0 } : item
        ));
    };

    const addItem = (item) => {
        setSelectedPrizeIds(prev => [...prev, { id: item.id, chance: item.chance }]);
    };

    const removeItem = (id) => {
        setSelectedPrizeIds(prev => prev.filter(item => item.id !== id));
    };

    return (
        <div className="admin-section">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #3a4552', paddingBottom:'15px', marginBottom:'20px'}}>
                <h2 style={{margin:0}}>{isNew ? 'Создание кейса' : `Редактирование: ${formData.name}`}</h2>
                <button className="save-fab" style={{width:'auto', padding:'10px 20px', margin:0}} onClick={handleSave}>
                    СОХРАНИТЬ
                </button>
            </div>

            <div className="editor-grid">
                <div>
                    <label>Название</label>
                    <input 
                        type="text" className="admin-input" 
                        value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} 
                    />
                </div>
                
                {/* ID показываем только если это редактирование, но не даем менять */}
                {!isNew && (
                    <div>
                        <label>ID (Readonly)</label>
                        <input 
                            type="text" className="admin-input" 
                            disabled 
                            value={formData.id} 
                        />
                    </div>
                )}
                
                <div>
                    <label>Цена</label>
                    <input 
                        type="number" className="admin-input" 
                        value={formData.price} onChange={e => setFormData({...formData, price: parseInt(e.target.value)})}
                        disabled={formData.isPromo} // Если промо, цена не важна (обычно 0)
                    />
                </div>
                
                {/* Загрузка картинки */}
                <div>
                    <label>Картинка (Файл)</label>
                    <input 
                        type="file" 
                        accept="image/*"
                        className="admin-input" 
                        onChange={handleFileChange}
                    />
                    <div style={{marginTop: 5, fontSize: 12, color: '#888'}}>
                        Текущая: {selectedFile ? selectedFile.name : formData.image}
                    </div>
                </div>

                <div>
                    <label>Редкость (стиль)</label>
                    <select 
                        className="admin-input" 
                        value={formData.tag || 'common'} 
                        onChange={e => setFormData({...formData, tag: e.target.value})}
                    >
                        <option value="common">Обычный</option>
                        <option value="rare">Редкий</option>
                        <option value="epic">Эпик</option>
                        <option value="legendary">Легендарный</option>
                        <option value="limited">Лимит</option>
                        <option value="promo">Промо</option>
                    </select>
                </div>

                {/* Блок настроек Промо и Лимитов */}
                <div style={{
                    gridColumn: '1 / -1', 
                    background: '#212a31', 
                    padding: '15px', 
                    borderRadius: '8px', 
                    border: '1px solid #3a4552',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '20px'
                }}>
                    <div>
                        <label style={{display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', marginBottom: '10px', fontWeight: 'bold', color: '#ffc107'}}>
                            <input 
                                type="checkbox" 
                                style={{width:20, height:20}} 
                                checked={formData.isPromo} 
                                onChange={e => setFormData({...formData, isPromo: e.target.checked})} 
                            />
                            <span>Это Промо-кейс?</span>
                        </label>
                        
                        {formData.isPromo && (
                            <div>
                                <label>Промокод для открытия:</label>
                                <input 
                                    type="text" 
                                    className="admin-input" 
                                    placeholder="Введите код (например: FREE)" 
                                    value={formData.promoCode || ''} 
                                    onChange={e => setFormData({...formData, promoCode: e.target.value})} 
                                />
                            </div>
                        )}
                    </div>

                    <div>
                        <label style={{display:'block', marginBottom:'5px'}}>Лимит прокрутов (Всего):</label>
                        <input 
                            type="number" 
                            className="admin-input" 
                            placeholder="0 = Безлимит" 
                            value={formData.maxActivations || 0} 
                            onChange={e => setFormData({...formData, maxActivations: parseInt(e.target.value)})} 
                        />
                        <small style={{color:'#888', display:'block', marginTop:5}}>
                            {!isNew && `Текущих активаций: ${formData.currentActivations || 0}`}
                            {isNew && "Кейс исчезнет после исчерпания лимита."}
                        </small>
                    </div>
                </div>
            </div>

            <h4 style={{marginTop:'20px', marginBottom:'10px'}}>Содержимое ({selectedPrizeIds.length} предм.)</h4>
            <div className="item-picker-container">
                {/* ЛЕВАЯ КОЛОНКА: ЧТО В КЕЙСЕ */}
                <div className="picker-column">
                    <div className="picker-header" style={{color:'#4CAF50'}}>В КЕЙСЕ (Настройте шанс)</div>
                    <div className="picker-list">
                        {selectedPrizeIds.length === 0 && <div style={{padding:10, color:'#666', textAlign:'center'}}>Пусто</div>}
                        {selectedPrizeIds.map(prizeConfig => {
                            const item = allPrizes.find(p => p.id === prizeConfig.id);
                            if (!item) return null;
                            return (
                                <div key={prizeConfig.id} className="picker-item">
                                    <button className="action-btn-small btn-remove" onClick={() => removeItem(prizeConfig.id)}>−</button>
                                    <img src={item.image} alt="" />
                                    <div className="picker-info">
                                        <span>{item.name}</span>
                                        <div style={{display:'flex', alignItems:'center', gap:'5px', marginTop:'4px'}}>
                                            <small style={{color:'#8a99a8'}}>Шанс:</small>
                                            <input 
                                                type="number" 
                                                className="admin-input-small"
                                                style={{width:'60px', borderColor: '#00aaff'}}
                                                value={prizeConfig.chance}
                                                onChange={(e) => updateChance(prizeConfig.id, e.target.value)}
                                            />
                                            <small>%</small>
                                        </div>
                                    </div>
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
                            <div key={item.id} className="picker-item" style={{opacity: 0.8}} onClick={() => addItem(item)}>
                                <img src={item.image} alt="" />
                                <div className="picker-info">
                                    <span>{item.name}</span>
                                    <small style={{color:'#888'}}>Баз. шанс: {item.chance}%</small>
                                </div>
                                <button className="action-btn-small btn-add">+</button>
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
            setStatusMsg('Пользователь не найден');
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
                </div>
            )}
        </div>
    );
};

export default AdminPage;
