import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import { useTonConnectUI, useTonWallet, TonConnectButton } from '@tonconnect/ui-react';
import { toNano } from '@ton/core';
import '../styles/modals.css'; // Убедитесь, что стили подключены

const TopUpModal = () => {
    const { closeTopUpModal, user } = useContext(AppContext);
    const [activeTab, setActiveTab] = useState('stars');
    const [amount, setAmount] = useState('');
    const wallet = useTonWallet();
    const [tonConnectUI] = useTonConnectUI();
    const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);

    // Пресеты для быстрого выбора
    const PRESETS = {
        stars: [50, 100, 500, 1000],
        ton: [0.5, 1, 5, 10]
    };

    useEffect(() => {
        const unsubscribe = tonConnectUI.onModalStateChange((state) => {
            setIsConnectionModalOpen(state && (state.status === 'opened' || state === 'opened'));
        });
        return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
    }, [tonConnectUI]);

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
                        closeTopUpModal();
                        window.location.reload();
                    }
                });
            } else {
                alert('Ошибка: ' + (data.error || 'Unknown error'));
            }
        } catch (e) { alert('Ошибка сети: ' + e.message); }
    };

    const handleTopUpTon = async () => {
        if (!wallet) return alert('Подключите кошелек');
        const val = parseFloat(amount);
        if (!val || val <= 0) return alert('Введите корректную сумму');
        
        const RECIPIENT_WALLET = 'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ'; 

        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 600, 
            messages: [{ address: RECIPIENT_WALLET, amount: toNano(val).toString() }]
        };

        try {
            const result = await tonConnectUI.sendTransaction(transaction);
            await fetch('/api/verify-ton-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ boc: result.boc, userId: user.id, amount: val }),
            });
            alert('Транзакция отправлена! Ожидайте зачисления.');
            closeTopUpModal();
        } catch (e) { console.error(e); }
    };

    if (isConnectionModalOpen) return null;

    // Курс и иконка для кнопки
    const isStars = activeTab === 'stars';
    const rateText = isStars ? '1 Stars = 50 звёзд' : '1 TON = 3000 Stars'; // Подстройте курс под себя
    const btnColor = isStars ? 'btn-gold' : 'btn-blue';

    return (
        <div className="custom-modal-overlay">
            <div className="payment-modal">
                <div className="payment-header">
                    <h3>Пополнение</h3>
                    <button onClick={closeTopUpModal} className="close-btn-cross">×</button>
                </div>
                
                {/* Табы */}
                <div className="payment-tabs">
                    <button 
                        className={`pay-tab ${activeTab === 'stars' ? 'active-stars' : ''}`} 
                        onClick={() => {setActiveTab('stars'); setAmount('')}}
                    >
                        <img src="/images/stars.png" alt="" className="tab-icon" />
                        <span>Stars</span>
                    </button>
                    <button 
                        className={`pay-tab ${activeTab === 'ton' ? 'active-ton' : ''}`} 
                        onClick={() => {setActiveTab('ton'); setAmount('')}}
                    >
                        <img src="/images/ton.png" alt="" className="tab-icon ton-fix" />
                        <span>TON</span>
                    </button>
                </div>

                {/* Основной контент */}
                <div className="payment-body">
                    {activeTab === 'ton' && !wallet && (
                        <div className="connect-wallet-wrap">
                            <TonConnectButton />
                        </div>
                    )}

                    <div className="input-label">
                        {isStars ? 'Количество звезд' : 'Сумма TON'}
                    </div>

                    <div className={`amount-input-wrapper ${isStars ? 'focus-gold' : 'focus-blue'}`}>
                        <input 
                            type="number" 
                            className="amount-input"
                            value={amount} 
                            onChange={e => setAmount(e.target.value)} 
                            placeholder="0" 
                            autoFocus
                        />
                        <span className="currency-suffix">{isStars ? 'STR' : 'TON'}</span>
                    </div>

                    {/* Быстрые кнопки */}
                    <div className="quick-amounts">
                        {PRESETS[activeTab].map(val => (
                            <button 
                                key={val} 
                                className="quick-chip" 
                                onClick={() => setAmount(val)}
                            >
                                +{val}
                            </button>
                        ))}
                    </div>
                    
                    <div className="rate-info">{rateText}</div>

                    <button 
                        className={`pay-action-btn ${btnColor}`}
                        onClick={isStars ? handleTopUpStars : handleTopUpTon}
                        disabled={activeTab === 'ton' && !wallet}
                    >
                        {isStars ? 'Купить' : (wallet ? 'Оплатить' : 'Подключите Wallet')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TopUpModal;
