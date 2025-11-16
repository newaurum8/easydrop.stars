import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../context/AppContext';

// Компонент для редактирования одного кейса
const CaseEditor = ({ caseItem, allPrizes, onSave }) => {
    const [name, setName] = useState(caseItem.name);
    const [price, setPrice] = useState(caseItem.price);
    // Храним ID призов в состоянии
    const [prizeIds, setPrizeIds] = useState(new Set(caseItem.prizeIds));
    const [itemToAdd, setItemToAdd] = useState('');

    const handleSave = () => {
        onSave(caseItem.id, {
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

    const handleAddItem = () => {
        if (itemToAdd && !prizeIds.has(itemToAdd)) {
            togglePrize(itemToAdd);
            setItemToAdd('');
        }
    };
    
    // Призы, которые в этом кейсе
    const currentPrizes = useMemo(() => {
        return allPrizes.filter(p => prizeIds.has(p.id));
    }, [prizeIds, allPrizes]);

    // Призы, которых нет в этом кейсе
    const availablePrizes = useMemo(() => {
         return allPrizes.filter(p => !prizeIds.has(p.id));
    }, [prizeIds, allPrizes]);

    return (
        <div className="admin-item">
            <h4>Редактор кейса: {caseItem.name}</h4>
            <div className="admin-form">
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Название кейса"
                />
                <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Цена"
                />
            </div>
            
            <h5>Призы в кейсе ({currentPrizes.length})</h5>
            <div className="admin-item-list compact">
                {currentPrizes.map(prize => (
                    <div key={prize.id} className="admin-prize-chip">
                        <span>{prize.name} (Value: {prize.value})</span>
                        <button onClick={() => togglePrize(prize.id)}>&times;</button>
                    </div>
                ))}
            </div>

            <h5>Добавить приз</h5>
            <div className="admin-form">
                <select value={itemToAdd} onChange={(e) => setItemToAdd(e.target.value)}>
                    <option value="">-- Выберите итем --</option>
                    {availablePrizes.map(prize => (
                        <option key={prize.id} value={prize.id}>
                            {prize.name} (Value: {prize.value})
                        </option>
                    ))}
                </select>
                <button onClick={handleAddItem} className="admin-button small">Добавить</button>
            </div>
            
            <button onClick={handleSave} className="admin-button">Сохранить кейс</button>
        </div>
    );
};

// Компонент для редактирования одного предмета
const PrizeEditor = ({ prize, onSave, onDelete }) => {
    const [name, setName] = useState(prize.name);
    const [value, setValue] = useState(prize.value);
    const [image, setImage] = useState(prize.image);
    const [chance, setChance] = useState(prize.chance);

    const handleSave = () => {
        onSave(prize.id, {
            name,
            value: Number(value),
            image,
            chance: Number(chance),
        });
    };

    return (
        <div className="admin-item compact">
            <img src={image} alt="" style={{width: '40px', height: '40px', borderRadius: '4px'}} />
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" />
            <input type="text" value={image} onChange={(e) => setImage(e.target.value)} placeholder="Image URL" />
            <input type="number" value={chance} onChange={(e) => setChance(e.target.value)} placeholder="Chance" />
            <button onClick={handleSave} className="admin-button small">Save</button>
            <button onClick={() => onDelete(prize.id)} className="admin-button small danger">X</button>
        </div>
    );
};

// Основная страница админки
const AdminPage = () => {
    const { ALL_CASES, setAllCases, ALL_PRIZES, setAllPrizes } = useContext(AppContext);
    const [editingCaseId, setEditingCaseId] = useState(null);

    // --- Логика для управления кейсами ---
    const handleUpdateCase = (caseId, updatedData) => {
        setAllCases(prevCases =>
            prevCases.map(c => (c.id === caseId ? { ...c, ...updatedData } : c))
        );
        setEditingCaseId(null); // Закрываем редактор
    };

    // --- Логика для управления предметами ---
    const handleUpdatePrize = (prizeId, updatedData) => {
        setAllPrizes(prevPrizes =>
            prevPrizes.map(p => (p.id === prizeId ? { ...p, ...updatedData } : p))
        );
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
        // 1. Удаляем приз из общей базы
        setAllPrizes(prev => prev.filter(p => p.id !== prizeId));
        // 2. Удаляем ID этого приза из ВСЕХ кейсов
        setAllCases(prevCases => 
            prevCases.map(c => ({
                ...c,
                prizeIds: c.prizeIds.filter(id => id !== prizeId)
            }))
        );
    };

    return (
        <div className="admin-page">
            <h2>Панель Администратора</h2>

            {/* --- Секция управления кейсами --- */}
            <section className="admin-section">
                <h3>Управление Кейсами ({ALL_CASES.length})</h3>
                <div className="admin-item-list">
                    {ALL_CASES.map(caseItem => (
                        <div key={caseItem.id}>
                            {editingCaseId === caseItem.id ? (
                                <CaseEditor 
                                    caseItem={caseItem} 
                                    allPrizes={ALL_PRIZES} 
                                    onSave={handleUpdateCase}
                                />
                            ) : (
                                <div className="admin-item">
                                    <img src={caseItem.image} alt="" style={{width: '50px', height: '50px'}} />
                                    <span>{caseItem.name}</span>
                                    <span>{caseItem.price} <img src="/images/stars.png" alt="star" className="star-icon small" /></span>
                                    <span>{caseItem.prizeIds.length} предметов</span>
                                    <button onClick={() => setEditingCaseId(caseItem.id)} className="admin-button">Редактировать</button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* --- Секция управления итемами --- */}
            <section className="admin-section">
                <h3>Общая База Предметов ({ALL_PRIZES.length})</h3>
                <button onClick={handleAddNewPrize} className="admin-button" style={{marginBottom: '10px'}}>
                    Добавить новый предмет
                </button>
                <div className="admin-item-list">
                    {ALL_PRIZES.map(prize => (
                        <PrizeEditor 
                            key={prize.id} 
                            prize={prize} 
                            onSave={handleUpdatePrize}
                            onDelete={handleDeletePrize}
                        />
                    ))}
                </div>
            </section>
        </div>
    );
};

export default AdminPage;
