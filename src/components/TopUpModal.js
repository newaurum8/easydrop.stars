import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import {
    useTonConnectUI,
    useTonWallet,
    TonConnectButton,
} from '@tonconnect/ui-react';
import { toNano } from '@ton/core';

const TopUpModal = () => {
    const { closeTopUpModal, user } = useContext(AppContext);
    const [activeTab, setActiveTab] = useState('stars');
    const [amount, setAmount] = useState(''); // Единый стейт для суммы

    const wallet = useTonWallet();
    const [tonConnectUI] = useTonConnectUI();

    // 1. Оплата Звездами (Stars)
    const handleTopUpStars = async () => {
        if (!user || !amount || amount <= 0) return alert('Введите корректную сумму');
        
        try {
            const response = await fetch('/api/create-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: parseInt(amount), userId: user.id }),
            });
            const data = await response.json();
            
            if (data.invoiceLink) {
                // Открываем нативный инвойс Telegram
                window.Telegram.WebApp.openInvoice(data.invoiceLink, (status) => {
                    if (status === 'paid') {
                        alert('Оплата прошла успешно! Баланс скоро обновится.');
                        closeTopUpModal();
                        window.location.reload(); // Перезагрузка для обновления баланса
                    }
                });
            } else {
                alert('Ошибка создания счета');
            }
        } catch (error) {
            console.error(error);
            alert('Ошибка сервера');
        }
    };

    // 2. Оплата TON
    const handleTopUpTon = async () => {
        if (!wallet) return alert('Подключите кошелек!');
        if (!amount || amount <= 0) return alert('Введите сумму');

        // Адрес кошелька администратора (куда идут деньги)
        const RECIPIENT_WALLET = 'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ'; 

        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 600, // 10 минут
            messages: [
                {
                    address: RECIPIENT_WALLET,
                    amount: toNano(amount).toString(), // Конвертация в нанотоны
                    // ВАЖНО: Передаем ID пользователя в комментарии
                    payload: undefined // TonConnectUI сам сформирует payload из body, если нужно текстовое сообщение
                },
            ],
        };

        try {
            // Отправляем транзакцию через кошелек пользователя
            const result = await tonConnectUI.sendTransaction(transaction);

            // Отправляем BOC (подпись транзакции) на наш сервер для верификации и зачисления
            await fetch('/api/verify-ton-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    boc: result.boc, 
                    userId: user.id,
                    amount: parseFloat(amount) // Передаем сумму, чтобы сервер знал сколько начислять
                }),
            });

            alert('Транзакция отправлена! Ожидайте зачисления (1-2 минуты).');
            closeTopUpModal();
        } catch (error) {
            console.error('TON Error:', error);
            alert('Отмена или ошибка транзакции.');
        }
    };

    return (
        <div className="top-up-modal">
            <div className="top-up-modal-content">
                <button onClick={closeTopUpModal} className="close-modal-btn">&times;</button>
                <h2>Пополнение баланса</h2>
                
                <div className="top-up-tabs">
                    <button 
                        className={`top-up-tab ${activeTab === 'stars' ? 'active' : ''}`} 
                        onClick={() => { setActiveTab('stars'); setAmount(''); }}
                    >
                        <img src="/images/stars.png" alt="" className="star-icon small" /> Stars
                    </button>
                    <button 
                        className={`top-up-tab ${activeTab === 'ton' ? 'active' : ''}`} 
                        onClick={() => { setActiveTab('ton'); setAmount(''); }}
                    >
                        <img src="/images/ton.png" alt="TON" className="star-icon small" style={{width:20}} /> TON
                    </button>
                </div>

                <div className="tab-panel">
                    {activeTab === 'ton' && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '15px' }}>
                            <TonConnectButton />
                        </div>
                    )}
                    
                    <label>
                        {activeTab === 'stars' ? 'Количество звезд' : 'Сумма в TON'}
                    </label>
                    <input 
                        type="number" 
                        value={amount} 
                        onChange={(e) => setAmount(e.target.value)} 
                        placeholder={activeTab === 'stars' ? "100" : "0.5"}
                        className="admin-input" // Используем стиль из прошлого шага
                        style={{marginBottom: '15px'}}
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
                        <p className="ton-calculation">
                            Курс: 1 TON = 10,000 внутренней валюты
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TopUpModal;
