import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../context/AppContext';
import { Link } from 'react-router-dom';

// --- Редактор одного предмета (Карточка) ---
const PrizeEditor = ({ prize, onSave, onDelete }) => {
    const [name, setName] = useState(prize.name);
    const [value, setValue] = useState(prize.value);
    const [image, setImage] = useState(prize.image);
    const [chance, setChance] = useState(prize.chance);

    const handleSave = () => {
        onSave(prize.id, { ...prize, name, value: Number(value), image, chance: Number(chance) });
    };

    return (
        <div className="admin-card prize-editor">
            <img src={image} alt={name} className="admin-card-img" />
            <div className="admin-card-body">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" />
                <input type="text" value={image} onChange={(e) => setImage(e.target.value)} placeholder="URL Картинки" />
                <div className="admin-form-row">
                    <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ценность" />
                    <input type="number" value={chance} onChange={(e) => setChance(e.target.value)} placeholder="Шанс" />
                </div>
            </div>
            <div className="admin-card-footer">
                <button onClick={handleSave} className="admin-button success">Сохранить</button>
                <button onClick={() => onDelete(prize.id)} className="admin-button danger small-btn">Удалить</button>
            </div>
        </div>
    );
};

// --- Вкладка "База Предметов" ---
const ItemManagement = () => {
    const { ALL_PRIZES, setAllPrizes, setAllCases } = useContext(AppContext); // <-- resetAdminData здесь не нужен

    const handleUpdatePrize = (prizeId, updatedData) => {
        setAllPrizes(prev => prev.map(p => (p.id === prizeId ? updatedData : p)));
    };

    const handleAddNewPrize = () => {
        const newId = `new_prize_${Date.now()}`;
        const newPrize = {
            id: newId,
            name: 'Новый Предмет',
            image: '/images/case/item.png',
            value: 100,
            chance: 50
        };
        setAllPrizes(prev => [newPrize, ...prev]);
    };
    
    const handleDeletePrize = (prizeId) => {
        if (!window.confirm(`Вы уверены, что хотите удалить этот предмет? Он будет удален из ВСЕХ кейсов.`)) return;

        setAllPrizes(prev => prev.filter(p => p.id !== prizeId));
        setAllCases(prevCases => 
            prevCases.map(c => ({
                ...c,
                prizeIds: c.prizeIds.filter(id => id !== prizeId)
            }))
        );
    };

    return (
        <div className="admin-tab-content">
            <div className="admin-tab-header">
                <h2>База Предметов ({ALL_PRIZES.length})</h2>
                <button onClick={handleAddNewPrize} className="admin-button success">
                    + Добавить новый предмет
                </button>
            </div>
            <div className="admin-grid">
                {ALL_PRIZES.map(prize => (
                    <PrizeEditor 
                        key={prize.id} 
                        prize={prize} 
                        onSave={handleUpdatePrize}
                        onDelete={handleDeletePrize}
                    />
                ))}
            </div>
        </div>
    );
};


// --- Редактор одного кейса (Правая колонка) ---
const CaseEditor = ({ caseItem, allPrizes, onSave, onClear }) => {
    const [name, setName] = useState(caseItem.name);
    const [price, setPrice] = useState(caseItem.price);
    const [prizeIds, setPrizeIds] = useState(new Set(caseItem.prizeIds));
    const [filter, setFilter] = useState('');

    const handleSave = () => {
        onSave(caseItem.id, {
            ...caseItem,
            name,
            price: Number(price),
            prizeIds: Array.from(prizeIds),
        });
    };

    const togglePrize = (prizeId) => {
        setPrizeIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(prizeId)) {
                newSet.delete(prizeId);
            } else {
                newSet.add(prizeId);
            }
            return newSet;
        });
    };
    
    const filteredAvailablePrizes = useMemo(() => {
        return allPrizes.filter(p => 
            !prizeIds.has(p.id) &&
            p.name.toLowerCase().includes(filter.toLowerCase())
        );
    }, [prizeIds, allPrizes, filter]);

    const prizesInCase = useMemo(() => {
         return allPrizes.filter(p => prizeIds.has(p.id));
    }, [prizeIds, allPrizes]);


    return (
        <div className="case-editor-main">
            <h3>Редактирование: {caseItem.name}</h3>
            <div className="admin-form-row">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Название кейса" />
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Цена" />
            </div>
            
            <div className="admin-item-picker">
                {/* --- Колонка 1: Призы в кейсе --- */}
                <div className="item-picker-col">
                    <h4>Призы в кейсе ({prizesInCase.length})</h4>
                    <div className="item-picker-list">
                        {prizesInCase.length > 0 ? prizesInCase.map(prize => (
                            <div key={prize.id} className="item-picker-item">
                                <img src={prize.image} alt={prize.name} />
                                <span>{prize.name} ({prize.value})</span>
                                <button onClick={() => togglePrize(prize.id)} className="admin-button danger small-btn">
                                    &ndash;
                                </button>
                            </div>
                        )) : <p>В этом кейсе пока нет предметов.</p>}
                    </div>
                </div>

                {/* --- Колонка 2: База предметов --- */}
                <div className="item-picker-col">
                    <h4>Добавить из базы ({filteredAvailablePrizes.length})</h4>
                    <input 
                        type="text" 
                        value={filter} 
                        onChange={(e) => setFilter(e.target.value)} 
                        placeholder="Поиск по названию..." 
                        className="item-picker-search"
                    />
                    <div className="item-picker-list">
                        {filteredAvailablePrizes.length > 0 ? filteredAvailablePrizes.map(prize => (
                             <div key={prize.id} className="item-picker-item">
                                <img src={prize.image} alt={prize.name} />
                                <span>{prize.name} ({prize.value})</span>
                                <button onClick={() => togglePrize(prize.id)} className="admin-button success small-btn">
                                    +
                                </button>
                            </div>
                        )) : <p>Нет доступных предметов.</p>}
                    </div>
                </div>
            </div>

            <div className="case-editor-footer">
                <button onClick={handleSave} className="admin-button success large">Сохранить</button>
                <button onClick={onClear} className="admin-button">Закрыть</button>
            </div>
        </div>
    );
};

// --- Вкладка "Управление Кейсами" (Master-Detail) ---
const CaseManagement = () => {
    const { ALL_CASES, setAllCases, ALL_PRIZES } = useContext(AppContext);
    const [selectedCaseId, setSelectedCaseId] = useState(null);

    const handleUpdateCase = (caseId, updatedData) => {
        setAllCases(prevCases =>
            prevCases.map(c => (c.id === caseId ? updatedData : c))
        );
        setSelectedCaseId(null); // Закрываем редактор
    };

    const selectedCase = useMemo(() => {
        return ALL_CASES.find(c => c.id === selectedCaseId);
    }, [selectedCaseId, ALL_CASES]);

    return (
        <div className="admin-tab-content case-management-layout">
            {/* --- Левая колонка: Список кейсов --- */}
            <div className="case-list-sidebar">
                <h3>Все Кейсы ({ALL_CASES.length})</h3>
                <div className="case-list">
                    {ALL_CASES.map(caseItem => (
                        <div 
                            key={caseItem.id} 
                            className={`case-list-item ${selectedCaseId === caseItem.id ? 'active' : ''}`}
                            onClick={() => setSelectedCaseId(caseItem.id)}
                        >
                            <img src={caseItem.image} alt={caseItem.name} />
                            <div className="case-list-item-info">
                                <strong>{caseItem.name}</strong>
                                <span>{caseItem.price} <small>STARS</small></span>
                            </div>
                            <span className="case-list-item-count">{caseItem.prizeIds.length} п.</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* --- Правая колонка: Редактор или Заглушка --- */}
            {selectedCase ? (
                <CaseEditor 
                    key={selectedCase.id} // Ключ для сброса состояния при выборе другого кейса
                    caseItem={selectedCase}
                    allPrizes={ALL_PRIZES}
                    onSave={handleUpdateCase}
                    onClear={() => setSelectedCaseId(null)}
                />
            ) : (
                <div className="case-editor-placeholder">
                    <h2>Выберите кейс из списка слева для редактирования</h2>
                </div>
            )}
        </div>
    );
};


// --- Главный компонент страницы AdminPage ---
const AdminPage = () => {
    const [activeTab, setActiveTab] = useState('cases'); // 'cases' или 'items'
    // --- ДОБАВЛЕНО: Получаем функцию сброса ---
    const { resetAdminData } = useContext(AppContext);

    return (
        <div className="admin-container">
            <header className="admin-header">
                <h1>Панель Администратора</h1>
                <div>
                    {/* --- ДОБАВЛЕНО: Кнопка сброса --- */}
                    <button onClick={resetAdminData} className="admin-button danger" style={{marginRight: '10px'}}>
                        Сбросить настройки
                    </button>
                    <Link to="/" className="admin-button">&larr; Вернуться в приложение</Link>
                </div>
            </header>

            <nav className="admin-tabs">
                <button 
                    className={`admin-tab-button ${activeTab === 'cases' ? 'active' : ''}`}
                    onClick={() => setActiveTab('cases')}
                >
                    Управление Кейсами
                </button>
                <button 
                    className={`admin-tab-button ${activeTab === 'items' ? 'active' : ''}`}
                    onClick={() => setActiveTab('items')}
                >
                    База Предметов
                </button>
            </nav>

            <main className="admin-content">
                {activeTab === 'cases' ? (
                    <CaseManagement />
                ) : (
                    <ItemManagement />
                )}
            </main>
        </div>
    );
};

export default AdminPage;
