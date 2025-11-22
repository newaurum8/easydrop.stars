import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { useTonConnectUI, useTonWallet, TonConnectButton } from '@tonconnect/ui-react';
import { toNano } from '@ton/core';

const TopUpModal = () => {
    const { closeTopUpModal, user } = useContext(AppContext);
    const [activeTab, setActiveTab] = useState('stars');
    const [amount, setAmount] = useState('');
    const wallet = useTonWallet();
    const [tonConnectUI] = useTonConnectUI();
    
    // Состояние: открыто ли окно подключения кошелька (TonConnect)
    const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);

    // --- СЛЕЖИМ ЗА ОКНОМ TON CONNECT ---
    useEffect(() => {
        // Подписываемся на изменение состояния модального окна TonConnect
        const unsubscribe = tonConnectUI.onModalStateChange((state) => {
            // state может быть объектом { status: 'opened' } или просто 'opened' в зависимости от версии
            const isOpen = state && (state.status === 'opened' || state === 'opened');
            setIsConnectionModalOpen(isOpen);
        });

        return () => {
            // Отписываемся при размонтировании (если функция возвращает unsubscribe)
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, [tonConnectUI]);

    // Оплата Stars
    const handleTopUpStars = async () => {
        if (!user || !amount || amount <= 0) return alert('Введите корректную сумму');
        
        try {
            const res = await fetch('/api/create-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: parseInt(amount), userId: user.id }),
            });
            const data = await res.json();
            
            if (data.invoiceLink) {
                window.Telegram.WebApp.openInvoice(data.invoiceLink, (status) => {
                    if (status === 'paid') {
                        alert('Оплата прошла успешно! Баланс скоро обновится.');
                        closeTopUpModal();
                        window.location.reload();
                    }
                });
            } else {
                alert('Ошибка создания счета: ' + (data.error || 'Unknown error'));
            }
        } catch (e) { 
            alert('Ошибка соединения: ' + e.message); 
        }
    };

    // Оплата TON
    const handleTopUpTon = async () => {
        if (!wallet) return alert('Пожалуйста, подключите кошелек');
        
        const val = parseFloat(amount);
        if (!val || val <= 0) return alert('Введите корректную сумму');
        
        // ВАЖНО: Адрес вашего кошелька для приема средств
        const RECIPIENT_WALLET = 'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ'; 

        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 600, 
            messages: [
                {
                    address: RECIPIENT_WALLET,
                    amount: toNano(val).toString(),
                }
            ]
        };

        try {
            const result = await tonConnectUI.sendTransaction(transaction);
            
            await fetch('/api/verify-ton-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    boc: result.boc, 
                    userId: user.id, 
                    amount: val 
                }),
            });

            alert('Транзакция отправлена! Средства зачислятся после проверки.');
            closeTopUpModal();
        } catch (e) { 
            console.error(e);
        }
    };

    // --- СКРЫВАЕМ НАШЕ ОКНО, ЕСЛИ ОТКРЫТО ОКНО ПОДКЛЮЧЕНИЯ КОШЕЛЬКА ---
    if (isConnectionModalOpen) {
        return null; 
    }

    return (
        <div className="top-up-modal">
            <div className="top-up-modal-content">
                <button onClick={closeTopUpModal} className="close-modal-btn">&times;</button>
                <h2>Пополнение баланса</h2>
                
                {/* Вкладки */}
                <div className="top-up-tabs">
                    <button 
                        className={`top-up-tab ${activeTab === 'stars' ? 'active' : ''}`} 
                        onClick={() => {setActiveTab('stars'); setAmount('')}}
                    >
                        <img src="/images/stars.png" alt="" className="star-icon small" /> Stars
                    </button>
                    <button 
                        className={`top-up-tab ${activeTab === 'ton' ? 'active' : ''}`} 
                        onClick={() => {setActiveTab('ton'); setAmount('')}}
                    >
                        <img src="/images/ton.png" alt="" className="star-icon small" style={{width:20}} /> TON
                    </button>
                </div>

                <div className="tab-panel">
                    {/* Кнопка подключения кошелька (только для TON) */}
                    {activeTab === 'ton' && (
                        <div style={{display:'flex', justifyContent:'center', marginBottom:15}}>
                            <TonConnectButton />
                        </div>
                    )}
                    
                    <label>
                        {activeTab === 'stars' ? 'Количество звезд' : 'Сумма TON'}
                    </label>
                    <input 
                        type="number" 
                        className="admin-input" 
                        style={{marginBottom:15}} 
                        value={amount} 
                        onChange={e => setAmount(e.target.value)} 
                        placeholder={activeTab === 'stars' ? "100" : "0.5"} 
                    />
                    
                    {activeTab === 'stars' ? (
                        <button className="upgrade-button" onClick={handleTopUpStars}>
                            Купить за Stars
                        </button>
                    ) : (
                        <button 
                            className="upgrade-button" 
                            onClick={handleTopUpTon} 
                            disabled={!wallet} 
                            style={{opacity: wallet ? 1 : 0.5}}
                        >
                            {wallet ? `Оплатить ${amount || 0} TON` : 'Подключите кошелек'}
                        </button>
                    )}
                    
                    {activeTab === 'ton' && (
                         <p style={{textAlign:'center', fontSize:'12px', color:'#888', marginTop:'10px'}}>
                            Курс: 1 TON = 10,000 внутренней валюты
                         </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TopUpModal;
