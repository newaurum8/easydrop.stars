import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';

const TopUpModal = () => {
    const { closeTopUpModal, updateBalance, user } = useContext(AppContext);
    const [activeTab, setActiveTab] = useState('stars');
    const [starsAmount, setStarsAmount] = useState(500);
    const [tonAmount, setTonAmount] = useState(0.1);
    const [tonRate] = useState(140);
    const [isLoading, setIsLoading] = useState(false); // Состояние для отслеживания загрузки

    const handleStarsChange = (e) => {
        const value = parseInt(e.target.value, 10);
        setStarsAmount(isNaN(value) ? 0 : value);
    };

    const handleTonChange = (e) => {
        const value = parseFloat(e.target.value);
        setTonAmount(isNaN(value) ? 0 : value);
    };

    const handleTopUpStars = async () => {
        if (starsAmount <= 0 || !user) {
            alert('Пожалуйста, введите корректное количество звезд.');
            return;
        }

        setIsLoading(true);
        const tg = window.Telegram?.WebApp;

        if (!tg) {
            alert('API Telegram WebApp не найдено.');
            setIsLoading(false);
            return;
        }

        try {
            // 1. Отправляем запрос на НАШ бэкенд для создания инвойса
            const response = await fetch('/api/create-invoice', { // <-- Новый эндпоинт
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: starsAmount,
                    userId: user.id,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Не удалось создать счет.');
            }

            // 2. Открываем полученную от бэкенда ссылку на инвойс
            tg.openInvoice(data.invoiceLink, (status) => {
                if (status === 'paid') {
                    // Важно: не начисляйте баланс здесь.
                    // Баланс должен начисляться на бэкенде после получения webhook от Telegram.
                    // Здесь мы можем просто показать пользователю сообщение и обновить его баланс,
                    // сделав еще один запрос на сервер, чтобы получить актуальное значение.
                    tg.HapticFeedback.notificationOccurred('success');
                    alert('Оплата прошла успешно! Звезды скоро будут зачислены.');
                    updateBalance(starsAmount); // Временно обновляем на клиенте для UX
                    closeTopUpModal();
                } else if (status === 'cancelled') {
                    tg.HapticFeedback.notificationOccurred('warning');
                    alert('Оплата отменена.');
                } else {
                    tg.HapticFeedback.notificationOccurred('error');
                    alert('Произошла ошибка при оплате.');
                }
            });

        } catch (error) {
            console.error('Ошибка при создании инвойса:', error);
            alert(`Произошла ошибка: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConnectWallet = () => alert('Логика подключения кошелька в разработке...');
    const handleTopUpTon = () => alert('Пополнение через TON временно недоступно.');

    const calculatedStars = Math.floor(tonAmount * tonRate);
    const bonusStars = Math.floor(calculatedStars * 0.1);

    return (
        <div className="top-up-modal">
            <div className="top-up-modal-content">
                <button onClick={closeTopUpModal} className="close-modal-btn">&times;</button>
                <h2>Top Up Balance</h2>
                <div className="top-up-tabs">
                    <button
                        className={`top-up-tab ${activeTab === 'stars' ? 'active' : ''}`}
                        onClick={() => setActiveTab('stars')}
                    >
                        <img src="/images/stars.png" alt="Stars" className="star-icon small" />
                        Stars
                    </button>
                    <button
                        className={`top-up-tab ${activeTab === 'ton' ? 'active' : ''}`}
                        onClick={() => setActiveTab('ton')}
                    >
                        <img src="/images/ton.png" alt="TON" className="star-icon small" />
                        TON
                        <span className="ton-bonus">+10%</span>
                    </button>
                </div>

                {activeTab === 'stars' && (
                    <div className="tab-panel">
                        <label htmlFor="stars-amount">Enter amount</label>
                        <input
                            id="stars-amount"
                            type="number"
                            value={starsAmount}
                            onChange={handleStarsChange}
                            placeholder="500"
                        />
                        <button className="top-up-action-btn" onClick={handleTopUpStars} disabled={isLoading}>
                            {isLoading ? 'Создание счета...' : 'Top up with Stars'}
                        </button>
                    </div>
                )}

                {activeTab === 'ton' && (
                     <div className="tab-panel">
                        <button className="top-up-action-btn connect-wallet-btn" onClick={handleConnectWallet}>
                            <img src="/images/ton.png" alt="TON" className="star-icon small" />
                            Connect Wallet
                        </button>
                        <label htmlFor="ton-amount">Enter amount</label>
                         <input
                            id="ton-amount"
                            type="number"
                            step="0.1"
                            value={tonAmount}
                            onChange={handleTonChange}
                            placeholder="0.1"
                        />
                        <div className="ton-calculation">
                           ≈{calculatedStars.toLocaleString()} stars + {bonusStars.toLocaleString()} bonus stars
                        </div>
                        <button className="top-up-action-btn" onClick={handleTopUpTon}>
                            Top up with TON
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TopUpModal;
