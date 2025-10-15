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
    const [starsAmount, setStarsAmount] = useState(500);
    const [tonAmount, setTonAmount] = useState(0.1);

    const wallet = useTonWallet();
    const [tonConnectUI] = useTonConnectUI();

    const handleTopUpStars = async () => {
        // Ваша логика для пополнения через Telegram Stars
        if (!user) {
            alert('Пользователь не определен.');
            return;
        }
        try {
            const response = await fetch('/api/create-invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: starsAmount, userId: user.id }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            window.Telegram.WebApp.openInvoice(data.invoiceLink, (status) => {
                if (status === 'paid') {
                    alert('Оплата прошла успешно! Звезды будут зачислены.');
                    closeTopUpModal();
                } else {
                    alert('Произошла ошибка или оплата была отменена.');
                }
            });
        } catch (error) {
            alert(`Ошибка: ${error.message}`);
        }
    };

    const handleTopUpTon = async () => {
        if (!wallet) {
            alert('Пожалуйста, сначала подключите кошелек.');
            return;
        }

        // ВАЖНО: Замените на адрес ВАШЕГО кошелька для приема платежей
        const recipientWallet = 'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJKZ';

        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 600, // 10 минут
            messages: [
                {
                    address: recipientWallet,
                    amount: toNano(tonAmount).toString(),
                },
            ],
        };

        try {
            const result = await tonConnectUI.sendTransaction(transaction);

            // Отправляем boc на бэкенд для безопасной проверки
            await fetch('/api/verify-ton-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ boc: result.boc, userId: user.id }),
            });

            alert('Транзакция успешно отправлена! Средства будут зачислены после подтверждения в сети.');
            closeTopUpModal();

        } catch (error) {
            console.error('Ошибка при отправке транзакции:', error);
            alert('Произошла ошибка при отправке транзакции.');
        }
    };

    return (
        <div className="top-up-modal">
            <div className="top-up-modal-content">
                <button onClick={closeTopUpModal} className="close-modal-btn">&times;</button>
                <h2>Top Up Balance</h2>
                <div className="top-up-tabs">
                    <button className={`top-up-tab ${activeTab === 'stars' ? 'active' : ''}`} onClick={() => setActiveTab('stars')}>
                        <img src="/images/stars.png" alt="Stars" className="star-icon small" /> Stars
                    </button>
                    <button className={`top-up-tab ${activeTab === 'ton' ? 'active' : ''}`} onClick={() => setActiveTab('ton')}>
                        <img src="/images/ton.png" alt="TON" className="star-icon small" /> TON
                    </button>
                </div>

                {activeTab === 'stars' && (
                    <div className="tab-panel">
                        <label htmlFor="stars-amount">Enter amount</label>
                        <input id="stars-amount" type="number" value={starsAmount} onChange={(e) => setStarsAmount(parseInt(e.target.value))} placeholder="500" />
                        <button className="top-up-action-btn" onClick={handleTopUpStars}>Top up with Stars</button>
                    </div>
                )}

                {activeTab === 'ton' && (
                     <div className="tab-panel">
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                            <TonConnectButton />
                        </div>
                        <label htmlFor="ton-amount">Enter amount (TON)</label>
                         <input id="ton-amount" type="number" step="0.1" value={tonAmount} onChange={(e) => setTonAmount(parseFloat(e.target.value))} placeholder="0.1" disabled={!wallet} />
                        <button className="top-up-action-btn" onClick={handleTopUpTon} disabled={!wallet || !tonAmount || tonAmount <= 0}>
                            {wallet ? `Top up ${tonAmount} TON` : 'Connect wallet to proceed'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TopUpModal;
